import {
  AUDIO_DISCONNECT_DELAY_MS,
  ENVELOPE_SAMPLE_RATE,
  DEFAULT_TARGET_GAIN,
  DEFAULT_SAMPLE_RATE,
  MIN_SAMPLE_RATE,
  PCM_INT16_MIN,
  PCM_INT16_MAX,
} from './constants';
import { clampExtraSpacingMultiplier } from './extraSpacing';
import { MORSE_CODE } from './morseConstants';

export interface AudioSettings {
  // Farnsworth support - supports both fixed WPM and ranges
  charWpm?: number; // character element speed (fixed, for backward compatibility)
  charWpmMin?: number; // minimum character WPM for random selection
  charWpmMax?: number; // maximum character WPM for random selection
  effectiveWpm?: number; // overall perceived speed via extended spacing (fixed)
  effectiveWpmMin?: number; // minimum effective WPM for random selection
  effectiveWpmMax?: number; // maximum effective WPM for random selection
  /** Scales standard word-space timing (between words in Player; see also group gap in training). */
  extraWordSpaceMultiplier?: number;
  // Tone & envelope
  sideTone: number;
  steepness: number;
  envelopeSmoothing?: number; // 0..1
  // Volume (loudness) 0.1–1.0. When linkVolume or min===max, fixed; else sampled per symbol for weak-signal training.
  volumeMin?: number;
  volumeMax?: number;
  linkVolume?: boolean;
}

/**
 * Pick a random value within a range (inclusive).
 * If min === max, returns that value.
 */
function pickRandomInRange(min: number, max: number): number {
  if (min === max) return min;
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return lo + Math.random() * (hi - lo);
}

/**
 * Resolve the character WPM from settings, supporting both fixed and range values.
 */
function resolveCharWpm(settings: AudioSettings): number {
  // If range is specified, use it
  if (settings.charWpmMin !== undefined && settings.charWpmMax !== undefined) {
    return Math.max(1, pickRandomInRange(settings.charWpmMin, settings.charWpmMax));
  }
  // Fall back to fixed charWpm
  return Math.max(1, settings.charWpm ?? 20);
}

/**
 * Resolve the effective WPM from settings, supporting both fixed and range values.
 * Farnsworth spacing stretches gaps between characters, so the effective speed can
 * never exceed the character speed. Without this clamp, effective > 3× character WPM
 * makes the inter-character gap (3 effective dits) shorter than the element gap
 * (1 character dit), driving the scheduling cursor backwards and overlapping tones.
 */
function resolveEffectiveWpm(settings: AudioSettings, charWpm: number): number {
  // If range is specified, use it
  if (settings.effectiveWpmMin !== undefined && settings.effectiveWpmMax !== undefined) {
    return Math.min(charWpm, Math.max(1, pickRandomInRange(settings.effectiveWpmMin, settings.effectiveWpmMax)));
  }
  // Fall back to fixed effectiveWpm or charWpm
  return Math.min(charWpm, Math.max(1, settings.effectiveWpm ?? charWpm));
}

/**
 * Resolve volume multiplier for one symbol (0.1–1.0). When linked or min===max, fixed; else random in range.
 */
function resolveVolume(settings: AudioSettings): number {
  const min = Math.max(0.1, Math.min(1, settings.volumeMin ?? 1));
  const max = Math.max(0.1, Math.min(1, settings.volumeMax ?? 1));
  if (settings.linkVolume === true || min === max) return min;
  return pickRandomInRange(min, max);
}

/**
 * Call synchronously from a click/touch handler before any `await`.
 * iOS (including Chrome, which uses WebKit) ties AudioContext unlock to user
 * activation; resuming only after async gaps (delays, wake lock, countdown)
 * can leave audio permanently silent in stricter clients.
 */
export function resumeAudioContextFromUserGesture(ctx: AudioContext): void {
  if (ctx.state === 'suspended') {
    void ctx.resume();
  }
}

export const ensureContext = async (ctx: AudioContext): Promise<void> => {
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {
      // Ignore resume errors
    }
  }
};

export async function playMorseCode(
  ctx: AudioContext,
  text: string,
  settings: AudioSettings,
  shouldStop: () => boolean
): Promise<{ durationSec: number; startTime: number }> {
  const { durationSec, startTime } = await playMorseCodeControlled(ctx, text, settings, shouldStop);
  return { durationSec, startTime };
}

export async function playMorseCodeControlled(
  ctx: AudioContext,
  text: string,
  settings: AudioSettings,
  shouldStop: () => boolean,
  outputNode?: AudioNode,
  onStopReady?: (stop: () => void) => void,
): Promise<{
  durationSec: number;
  startTime: number;
  stop: () => void;
  /** Character speed this playback actually used (ranges are sampled per call). */
  resolvedCharWpm: number;
  /** Effective (Farnsworth) speed this playback actually used. */
  resolvedEffectiveWpm: number;
}> {
  // Determine timing based on Farnsworth (supports random ranges)
  const resolvedCharWpm = resolveCharWpm(settings);
  const resolvedEffWpm = resolveEffectiveWpm(settings, resolvedCharWpm);

  if (shouldStop())
    return {
      durationSec: 0,
      startTime: ctx.currentTime,
      stop: () => {},
      resolvedCharWpm,
      resolvedEffectiveWpm: resolvedEffWpm,
    };

  await ensureContext(ctx);
  const extraWordSpaceMultiplier = clampExtraSpacingMultiplier(settings.extraWordSpaceMultiplier);

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
  groupGain.connect(outputNode ?? ctx.destination);
  let stopped = false;
  const stop = () => {
    try {
      const now = ctx.currentTime;
      groupGain.gain.cancelScheduledValues(now);
      groupGain.gain.setTargetAtTime(0, now, 0.01);
      stopped = true;
      // Best-effort disconnect later (only if context is still open)
      setTimeout(() => { 
        try { 
          if (ctx.state !== 'closed') {
            groupGain.disconnect(); 
          }
        } catch (e) {
          // Context may already be closed or disconnected
          console.debug('[morseAudio] Cleanup: AudioContext already closed or disconnected', e);
        } 
      }, AUDIO_DISCONNECT_DELAY_MS);
    } catch (e) {
      console.error('[morseAudio] Error stopping audio playback', e);
    }
  };
  onStopReady?.(stop);

  let currentTime = ctx.currentTime;
  const startTime = ctx.currentTime;

  for (let i = 0; i < text.length; i++) {
    if (stopped || shouldStop()) break;
    const rawChar = text[i];
    if (rawChar === undefined) continue;
    if (rawChar === ' ') {
      const additional = Math.max(0, wordSpace - charSpace);
      currentTime += additional;
      continue;
    }
    // Only handle single characters - prosigns no longer supported
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

      const volume = resolveVolume(settings);
      const targetGain = DEFAULT_TARGET_GAIN * volume;
      const smoothing = Math.max(0, Math.min(1, settings.envelopeSmoothing ?? 0));
      if (smoothing === 0) {
        gainNode.gain.setValueAtTime(0, currentTime);
        gainNode.gain.linearRampToValueAtTime(targetGain, currentTime + riseTime);
        gainNode.gain.setValueAtTime(targetGain, currentTime + duration - riseTime);
        gainNode.gain.linearRampToValueAtTime(0, currentTime + duration);
      } else {
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

  // Return duration and the actual start time (AudioContext) used for scheduling,
  // so callers can compute precise end time (startTime + durationSec) for reaction timing.
  return {
    durationSec: currentTime - startTime,
    startTime,
    stop,
    resolvedCharWpm,
    resolvedEffectiveWpm: resolvedEffWpm,
  };
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
    const sample = samples[i];
    if (sample === undefined) continue;
    const clamped = Math.max(-1, Math.min(1, sample));
    const pcm = clamped < 0 
      ? Math.round(clamped * -PCM_INT16_MIN) 
      : Math.round(clamped * PCM_INT16_MAX);
    view.setInt16(idx, pcm, true);
    idx += 2;
  }

  return new Blob([view], { type: 'audio/wav' });
}

export function renderMorseToWavBlob(text: string, options: RenderWavOptions): Blob {
  const sampleRate = Math.max(MIN_SAMPLE_RATE, Math.floor(options.sampleRate ?? DEFAULT_SAMPLE_RATE));
  const resolvedCharWpm = resolveCharWpm(options);
  const resolvedEffWpm = resolveEffectiveWpm(options, resolvedCharWpm);
  const extraWordSpaceMultiplier = clampExtraSpacingMultiplier(options.extraWordSpaceMultiplier);

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
    if (rawChar === undefined) continue;
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
  const targetGain = DEFAULT_TARGET_GAIN;
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
        const current = output[idx];
        if (typeof current === 'number') {
          output[idx] = current + Math.sin(phase) * env;
        }
      }
    }
    return segmentSamples;
  };

  // Second pass: synthesize
  let cursor = 0;
  const spaceToSamples = (sec: number) => Math.floor(sec * sampleRate);
  for (let i = 0; i < text.length; i++) {
    const rawChar = text[i];
    if (rawChar === undefined) continue;
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

