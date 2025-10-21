import { MORSE_CODE } from './morseConstants';

export interface AudioSettings {
  wpm: number;
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

  const dotDuration = 1.2 / settings.wpm;
  const dashDuration = dotDuration * 3;
  const symbolSpace = dotDuration;
  const charSpace = dotDuration * 3;
  const riseTime = settings.steepness / 1000;

  let currentTime = ctx.currentTime;

  for (let i = 0; i < text.length; i++) {
    if (shouldStop()) return 0;
    const char = text[i].toUpperCase();
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


