import type { TrainingSettings } from '@/types';

/**
 * Shape used by ICRTrainer and NewLetterPlayer for audio/character-pool options
 * derived from store TrainingSettings.
 */
export type SharedAudioFromSettings = {
  kochLevel: number;
  charSetMode?: 'koch' | 'digits' | 'custom' | 'mixed';
  digitsLevel?: number;
  mixedLettersPercent?: number;
  customSet?: string[];
  customSequence?: string[];
  slidingWindowStart?: number;
  slidingWindowEnd?: number;
  charWpmMin: number;
  charWpmMax: number;
  effectiveWpmMin: number;
  effectiveWpmMax: number;
  sideToneMin: number;
  sideToneMax: number;
  volumeMin: number;
  volumeMax: number;
  linkVolume: boolean;
  steepness: number;
  envelopeSmoothing: number;
  qsbEnabled?: boolean;
  qsbDepth?: number;
  qsbRateHz?: number;
  qrnEnabled?: boolean;
  qrnLevel?: number;
  qrmEnabled?: boolean;
  qrmLevel?: number;
  qrmProfile?: TrainingSettings['qrmProfile'];
};

/**
 * Maps store TrainingSettings to the shared audio/player props shape.
 * Clamps WPM values to at least 1 for safe playback.
 */
export function settingsToSharedAudioProps(
  settings: TrainingSettings,
): SharedAudioFromSettings {
  return {
    kochLevel: settings.kochLevel,
    ...(settings.charSetMode !== undefined ? { charSetMode: settings.charSetMode } : {}),
    ...(settings.digitsLevel !== undefined ? { digitsLevel: settings.digitsLevel } : {}),
    ...(settings.mixedLettersPercent !== undefined ? { mixedLettersPercent: settings.mixedLettersPercent } : {}),
    ...(settings.customSet && settings.customSet.length > 0
      ? { customSet: [...settings.customSet] }
      : {}),
    ...(settings.customSequence && settings.customSequence.length > 0
      ? { customSequence: [...settings.customSequence] }
      : {}),
    ...(settings.slidingWindowStart !== undefined ? { slidingWindowStart: settings.slidingWindowStart } : {}),
    ...(settings.slidingWindowEnd !== undefined ? { slidingWindowEnd: settings.slidingWindowEnd } : {}),
    charWpmMin: Math.max(1, settings.charWpmMin),
    charWpmMax: Math.max(1, settings.charWpmMax),
    effectiveWpmMin: Math.max(1, settings.effectiveWpmMin),
    effectiveWpmMax: Math.max(1, settings.effectiveWpmMax),
    sideToneMin: settings.sideToneMin,
    sideToneMax: settings.sideToneMax,
    volumeMin: settings.volumeMin,
    volumeMax: settings.volumeMax,
    linkVolume: settings.linkVolume,
    steepness: settings.steepness,
    envelopeSmoothing: settings.envelopeSmoothing,
    qsbEnabled: settings.qsbEnabled,
    qsbDepth: settings.qsbDepth,
    qsbRateHz: settings.qsbRateHz,
    qrnEnabled: settings.qrnEnabled,
    qrnLevel: settings.qrnLevel,
    qrmEnabled: settings.qrmEnabled,
    qrmLevel: settings.qrmLevel,
    qrmProfile: settings.qrmProfile,
  };
}
