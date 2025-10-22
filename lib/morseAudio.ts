import { MORSE_CODE } from './morseConstants';

export interface AudioSettings {
  // Farnsworth support
  charWpm?: number; // character element speed
  effectiveWpm?: number; // overall perceived speed via extended spacing
  extraWordSpaceMultiplier?: number; // >=1.0, scales word gap; default 1.0
  // Tone & envelope
  sideTone: number;
  steepness: number;
  envelopeSmoothing?: number; // 0..1
}

export const ensureContext = async (ctx: AudioContext) => {
  if (ctx.state === 'suspended') {
    try { await ctx.resume(); } catch {}
  }
};

export async function playMorseCode(
  ctx: AudioContext,
  text: string,
  settings: AudioSettings,
  shouldStop: () => boolean
): Promise<number> {
  if (shouldStop()) return 0;

  await ensureContext(ctx);

  // Determine timing based on Farnsworth or legacy single WPM
  const resolvedCharWpm = Math.max(1, settings.charWpm ?? 20);
  const resolvedEffWpm = Math.max(1, settings.effectiveWpm ?? resolvedCharWpm);
  const extraWordSpaceMultiplier = Math.max(1, settings.extraWordSpaceMultiplier ?? 1);

  const dotChar = 1.2 / resolvedCharWpm; // seconds
  const dotEff = 1.2 / resolvedEffWpm; // seconds

  const dotDuration = dotChar;
  const dashDuration = dotChar * 3;
  const symbolSpace = dotChar; // element gap stays at character WPM
  const charSpace = dotEff * 3; // inter-character gap at effective pace
  const wordSpace = dotEff * 7 * extraWordSpaceMultiplier; // inter-word gap at effective pace (scaled)
  const riseTime = settings.steepness / 1000;

  let currentTime = ctx.currentTime;

  for (let i = 0; i < text.length; i++) {
    if (shouldStop()) return 0;
    const rawChar = text[i];
    // Handle explicit spaces as word gaps; adjust on top of prior charSpace
    if (rawChar === ' ') {
      // Add the extra needed to reach a full word gap (beyond the char gap already added previously)
      const additional = Math.max(0, wordSpace - charSpace);
      currentTime += additional;
      continue;
    }
    const char = rawChar.toUpperCase();
    const morse = MORSE_CODE[char];
    if (!morse) continue;
    for (let j = 0; j < morse.length; j++) {
      if (shouldStop()) return 0;
      const symbol = morse[j];
      const duration = symbol === '.' ? dotDuration : dashDuration;

      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.value = settings.sideTone;

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      const targetGain = 0.3;
      const smoothing = Math.max(0, Math.min(1, settings.envelopeSmoothing ?? 0));
      if (smoothing === 0) {
        // Linear envelope (current behavior)
        gainNode.gain.setValueAtTime(0, currentTime);
        gainNode.gain.linearRampToValueAtTime(targetGain, currentTime + riseTime);
        gainNode.gain.setValueAtTime(targetGain, currentTime + duration - riseTime);
        gainNode.gain.linearRampToValueAtTime(0, currentTime + duration);
      } else {
        // Smooth envelope using setValueCurveAtTime with cosine-eased attack/decay
        const sampleRate = 256; // higher control point density for smoother curve
        const attackSteps = Math.max(2, Math.floor(sampleRate * Math.min(riseTime, duration / 2)));
        const sustainSteps = Math.max(0, Math.floor(sampleRate * Math.max(0, duration - 2 * riseTime)));
        const decaySteps = attackSteps;
        const totalSteps = attackSteps + sustainSteps + decaySteps;
        const curve = new Float32Array(Math.max(2, totalSteps));
        let idx = 0;
        for (let i = 0; i < attackSteps; i++) {
          const t = i / (attackSteps - 1);
          const linear = t;
          const cosine = (1 - Math.cos(Math.PI * t)) / 2;
          const blend = linear * (1 - smoothing) + cosine * smoothing;
          curve[idx++] = targetGain * blend;
        }
        for (let i = 0; i < sustainSteps; i++) {
          curve[idx++] = targetGain;
        }
        for (let i = 0; i < decaySteps; i++) {
          const t = i / (decaySteps - 1);
          const linear = 1 - t;
          const cosine = (1 + Math.cos(Math.PI * t)) / 2;
          const blend = linear * (1 - smoothing) + cosine * smoothing;
          curve[idx++] = targetGain * blend;
        }
        gainNode.gain.cancelScheduledValues(currentTime);
        gainNode.gain.setValueAtTime(0, currentTime);
        try {
          gainNode.gain.setValueCurveAtTime(curve, currentTime, duration);
        } catch {
          // Fallback to linear ramps if setValueCurveAtTime is not supported
          gainNode.gain.linearRampToValueAtTime(targetGain, currentTime + riseTime);
          gainNode.gain.setValueAtTime(targetGain, currentTime + duration - riseTime);
          gainNode.gain.linearRampToValueAtTime(0, currentTime + duration);
        }
      }

      oscillator.start(currentTime);
      oscillator.stop(currentTime + duration);

      currentTime += duration + symbolSpace;
    }
    currentTime += charSpace - symbolSpace;
  }

  return currentTime - ctx.currentTime;
}


