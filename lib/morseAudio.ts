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
  const { durationSec } = await playMorseCodeControlled(ctx, text, settings, shouldStop);
  return durationSec;
}

export async function playMorseCodeControlled(
  ctx: AudioContext,
  text: string,
  settings: AudioSettings,
  shouldStop: () => boolean
): Promise<{ durationSec: number; stop: () => void }> {
  if (shouldStop()) return { durationSec: 0, stop: () => {} };

  await ensureContext(ctx);

  // Determine timing based on Farnsworth
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

  // Master group gain to enable fast fade-out stop
  const groupGain = ctx.createGain();
  groupGain.gain.setValueAtTime(1, ctx.currentTime);
  groupGain.connect(ctx.destination);
  let stopped = false;
  const stop = () => {
    try {
      const now = ctx.currentTime;
      groupGain.gain.cancelScheduledValues(now);
      groupGain.gain.setTargetAtTime(0, now, 0.01);
      stopped = true;
      // Best-effort disconnect later (only if context is still open)
      const DISCONNECT_DELAY_MS = 100;
      setTimeout(() => { 
        try { 
          if (ctx.state !== 'closed') {
            groupGain.disconnect(); 
          }
        } catch (e) {
          // Context may already be closed or disconnected
          console.debug('[morseAudio] Cleanup: AudioContext already closed or disconnected', e);
        } 
      }, DISCONNECT_DELAY_MS);
    } catch (e) {
      console.error('[morseAudio] Error stopping audio playback', e);
    }
  };

  let currentTime = ctx.currentTime;
  const startTime = ctx.currentTime;

  for (let i = 0; i < text.length; i++) {
    if (stopped || shouldStop()) break;
    const rawChar = text[i];
    if (rawChar === ' ') {
      const additional = Math.max(0, wordSpace - charSpace);
      currentTime += additional;
      continue;
    }
    const char = rawChar.toUpperCase();
    const morse = MORSE_CODE[char];
    if (!morse) continue;
    for (let j = 0; j < morse.length; j++) {
      if (stopped || shouldStop()) { break; }
      const symbol = morse[j];
      const duration = symbol === '.' ? dotDuration : dashDuration;

      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.value = settings.sideTone;

      oscillator.connect(gainNode);
      gainNode.connect(groupGain);

      const targetGain = 0.3;
      const smoothing = Math.max(0, Math.min(1, settings.envelopeSmoothing ?? 0));
      if (smoothing === 0) {
        gainNode.gain.setValueAtTime(0, currentTime);
        gainNode.gain.linearRampToValueAtTime(targetGain, currentTime + riseTime);
        gainNode.gain.setValueAtTime(targetGain, currentTime + duration - riseTime);
        gainNode.gain.linearRampToValueAtTime(0, currentTime + duration);
      } else {
        const ENVELOPE_SAMPLE_RATE = 256;
        const attackSteps = Math.max(2, Math.floor(ENVELOPE_SAMPLE_RATE * Math.min(riseTime, duration / 2)));
        const sustainSteps = Math.max(0, Math.floor(ENVELOPE_SAMPLE_RATE * Math.max(0, duration - 2 * riseTime)));
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
          gainNode.gain.linearRampToValueAtTime(targetGain, currentTime + riseTime);
          gainNode.gain.setValueAtTime(targetGain, currentTime + duration - riseTime);
          gainNode.gain.linearRampToValueAtTime(0, currentTime + duration);
        }
      }

      oscillator.start(currentTime);
      oscillator.stop(currentTime + duration);

      currentTime += duration + symbolSpace;
    }
    // Add character space after each character
    // Note: After the last character, we don't add charSpace since group gaps
    // handle spacing between groups. This ensures accurate timing and proper spacing.
    const isLastChar = (i === text.length - 1);
    if (!isLastChar) {
      currentTime += charSpace - symbolSpace;
    }
  }

  // Return duration: this is the actual audio duration without any trailing space
  // The trailing space after the last character is handled by group gaps in the trainer
  return { durationSec: currentTime - startTime, stop };
}


export interface RenderWavOptions extends AudioSettings {
  sampleRate?: number; // default 44100
}

function writePcm16Wav(samples: Float32Array, sampleRate: number): Blob {
  const numChannels = 1;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  let offset = 0;
  // RIFF header
  view.setUint32(offset, 0x52494646, false); offset += 4; // 'RIFF'
  view.setUint32(offset, 36 + dataSize, true); offset += 4; // chunk size
  view.setUint32(offset, 0x57415645, false); offset += 4; // 'WAVE'
  // fmt chunk
  view.setUint32(offset, 0x666d7420, false); offset += 4; // 'fmt '
  view.setUint32(offset, 16, true); offset += 4; // PCM chunk size
  view.setUint16(offset, 1, true); offset += 2; // audio format PCM
  view.setUint16(offset, numChannels, true); offset += 2;
  view.setUint32(offset, sampleRate, true); offset += 4;
  view.setUint32(offset, byteRate, true); offset += 4;
  view.setUint16(offset, blockAlign, true); offset += 2;
  view.setUint16(offset, 8 * bytesPerSample, true); offset += 2; // bits per sample
  // data chunk
  view.setUint32(offset, 0x64617461, false); offset += 4; // 'data'
  view.setUint32(offset, dataSize, true); offset += 4;

  // PCM samples
  let idx = 44;
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    const pcm = clamped < 0 
      ? Math.round(clamped * 0x8000) 
      : Math.round(clamped * 0x7FFF);
    view.setInt16(idx, pcm, true);
    idx += 2;
  }

  return new Blob([view], { type: 'audio/wav' });
}

export function renderMorseToWavBlob(text: string, options: RenderWavOptions): Blob {
  const sampleRate = Math.max(8000, Math.floor(options.sampleRate ?? 44100));
  const resolvedCharWpm = Math.max(1, options.charWpm ?? 20);
  const resolvedEffWpm = Math.max(1, options.effectiveWpm ?? resolvedCharWpm);
  const extraWordSpaceMultiplier = Math.max(1, options.extraWordSpaceMultiplier ?? 1);

  const dotChar = 1.2 / resolvedCharWpm; // seconds
  const dotEff = 1.2 / resolvedEffWpm; // seconds

  const dotDuration = dotChar;
  const dashDuration = dotChar * 3;
  const symbolSpace = dotChar;
  const charSpace = dotEff * 3;
  const wordSpace = dotEff * 7 * extraWordSpaceMultiplier;
  const riseTime = options.steepness / 1000;

  // First pass: compute total duration
  let totalSec = 0;
  for (let i = 0; i < text.length; i++) {
    const rawChar = text[i];
    if (rawChar === ' ') {
      totalSec += Math.max(0, wordSpace - charSpace);
      continue;
    }
    const char = rawChar.toUpperCase();
    const morse = MORSE_CODE[char];
    if (!morse) continue;
    for (let j = 0; j < morse.length; j++) {
      const symbol = morse[j];
      const duration = symbol === '.' ? dotDuration : dashDuration;
      totalSec += duration + symbolSpace;
    }
    // Skip charSpace after the last character to match playMorseCodeControlled behavior
    const isLastChar = (i === text.length - 1);
    if (!isLastChar) {
      totalSec += charSpace - symbolSpace;
    }
  }

  const totalSamples = Math.max(1, Math.ceil(totalSec * sampleRate));
  const output = new Float32Array(totalSamples);

  // Envelope config consistent with live playback
  const targetGain = 0.3;
  const smoothing = Math.max(0, Math.min(1, options.envelopeSmoothing ?? 0));

  // Helper to apply one tone segment
  const applySegment = (startSample: number, durationSec: number) => {
    const freq = options.sideTone;
    const segmentSamples = Math.max(1, Math.floor(durationSec * sampleRate));
    const attackSamples = Math.max(1, Math.floor(Math.min(riseTime, durationSec / 2) * sampleRate));
    const decaySamples = attackSamples;
    const sustainSamples = Math.max(0, segmentSamples - attackSamples - decaySamples);
    for (let n = 0; n < segmentSamples; n++) {
      const t = n / sampleRate;
      const phase = 2 * Math.PI * freq * t;
      let env = targetGain;
      if (smoothing === 0) {
        if (n < attackSamples) {
          env = targetGain * (n / attackSamples);
        } else if (n >= attackSamples + sustainSamples) {
          const d = n - (attackSamples + sustainSamples);
          env = targetGain * (1 - d / Math.max(1, decaySamples));
        }
      } else {
        // cosine-smoothed attack/sustain/decay
        if (n < attackSamples) {
          const tt = n / Math.max(1, attackSamples - 1);
          env = targetGain * (1 - Math.cos(Math.PI * tt)) / 2;
        } else if (n < attackSamples + sustainSamples) {
          env = targetGain;
        } else {
          const d = n - (attackSamples + sustainSamples);
          const tt = d / Math.max(1, decaySamples - 1);
          env = targetGain * (1 + Math.cos(Math.PI * tt)) / 2;
        }
      }
      const idx = startSample + n;
      if (idx < output.length) {
        output[idx] += Math.sin(phase) * env;
      }
    }
    return segmentSamples;
  };

  // Second pass: synthesize
  let cursor = 0;
  const spaceToSamples = (sec: number) => Math.floor(sec * sampleRate);
  for (let i = 0; i < text.length; i++) {
    const rawChar = text[i];
    if (rawChar === ' ') {
      cursor += spaceToSamples(Math.max(0, wordSpace - charSpace));
      continue;
    }
    const char = rawChar.toUpperCase();
    const morse = MORSE_CODE[char];
    if (!morse) continue;
    for (let j = 0; j < morse.length; j++) {
      const symbol = morse[j];
      const duration = symbol === '.' ? dotDuration : dashDuration;
      cursor += applySegment(cursor, duration);
      cursor += spaceToSamples(symbolSpace);
    }
    // Skip charSpace after the last character to match playMorseCodeControlled behavior
    const isLastChar = (i === text.length - 1);
    if (!isLastChar) {
      cursor += spaceToSamples(charSpace - symbolSpace);
    }
  }

  return writePcm16Wav(output, sampleRate);
}

