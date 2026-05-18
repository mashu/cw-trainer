import { trainingSettingsSchema } from '@/lib/validators';
import type { TrainingSettings } from '@/types';

const DIGITS_LEVEL_MIN = 1;
const DIGITS_LEVEL_MAX = 10;
const MIXED_LETTERS_PERCENT_MIN = 0;
const MIXED_LETTERS_PERCENT_MAX = 100;
const SLIDING_WINDOW_INDEX_MIN = 1;
const SLIDING_WINDOW_INDEX_MAX = 40;
const AUDIO_REALISM_LEVEL_MIN = 0;
const AUDIO_REALISM_LEVEL_MAX = 1;
const QSB_RATE_MIN = 0.03;
const QSB_RATE_MAX = 1.5;
const RECEIVER_GAIN_MIN = 0;
const RECEIVER_GAIN_MAX = 20;
const RECEIVER_EXCITATION_RATE_MIN = 0.1;
const RECEIVER_EXCITATION_RATE_MAX = 500;
const RECEIVER_RESONANCE_MIN = 0.5;
const RECEIVER_RESONANCE_MAX = 240;
const RECEIVER_DECAY_MIN = 0.5;
const RECEIVER_DECAY_MAX = 0.9999;
const RECEIVER_OFFSET_MIN = -1000;
const RECEIVER_OFFSET_MAX = 1000;
const RECEIVER_OFFSET_MOD_DEPTH_MIN = 0;
const RECEIVER_OFFSET_MOD_DEPTH_MAX = 1000;
const RECEIVER_OFFSET_MOD_RATE_MIN = 0;
const RECEIVER_OFFSET_MOD_RATE_MAX = 20;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const clampNumber = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const normalizeFiniteNumber = (
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number => (isFiniteNumber(value) ? clampNumber(value, min, max) : fallback);

/**
 * Repairs common "intermediate" invalid states (e.g. max < min) that can be
 * persisted during blur-driven autosave. This keeps settings stable across
 * desktop/mobile event ordering differences without weakening the Zod schema.
 */
const repairTrainingSettingsCandidate = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const repaired: Record<string, unknown> = { ...(value as Record<string, unknown>) };

  // Keep ordered min/max pairs consistent
  if (isFiniteNumber(repaired['sideToneMin']) && isFiniteNumber(repaired['sideToneMax'])) {
    if (repaired['sideToneMax'] < repaired['sideToneMin']) {
      repaired['sideToneMax'] = repaired['sideToneMin'];
    }
  }

  if (isFiniteNumber(repaired['minGroupSize']) && isFiniteNumber(repaired['maxGroupSize'])) {
    if (repaired['maxGroupSize'] < repaired['minGroupSize']) {
      repaired['maxGroupSize'] = repaired['minGroupSize'];
    }
  }

  if (isFiniteNumber(repaired['charWpmMin']) && isFiniteNumber(repaired['charWpmMax'])) {
    if (repaired['charWpmMax'] < repaired['charWpmMin']) {
      repaired['charWpmMax'] = repaired['charWpmMin'];
    }
  }

  if (isFiniteNumber(repaired['effectiveWpmMin']) && isFiniteNumber(repaired['effectiveWpmMax'])) {
    if (repaired['effectiveWpmMax'] < repaired['effectiveWpmMin']) {
      repaired['effectiveWpmMax'] = repaired['effectiveWpmMin'];
    }
  }

  const volMin = repaired['volumeMin'];
  const volMax = repaired['volumeMax'];
  if (typeof volMin === 'number' && typeof volMax === 'number') {
    const vMin = Math.max(0.1, Math.min(1, volMin));
    const vMax = Math.max(0.1, Math.min(1, volMax));
    repaired['volumeMin'] = vMin;
    repaired['volumeMax'] = vMax;
    if (vMax < vMin) repaired['volumeMax'] = vMin;
  }

  // Enforce link invariants (link flags imply equality)
  if (repaired['linkGroupSize'] === true && isFiniteNumber(repaired['minGroupSize'])) {
    repaired['maxGroupSize'] = repaired['minGroupSize'];
  }

  if (repaired['linkCharWpm'] === true && isFiniteNumber(repaired['charWpmMin'])) {
    repaired['charWpmMax'] = repaired['charWpmMin'];
  }

  if (repaired['linkEffectiveWpm'] === true && isFiniteNumber(repaired['effectiveWpmMin'])) {
    repaired['effectiveWpmMax'] = repaired['effectiveWpmMin'];
  }

  if (repaired['linkVolume'] === true && isFiniteNumber(repaired['volumeMin'])) {
    repaired['volumeMax'] = repaired['volumeMin'];
  }

  return repaired;
};

const normalizeCharSetMode = (
  mode: unknown,
  fallback: TrainingSettings['charSetMode'],
): TrainingSettings['charSetMode'] => {
  if (mode === 'koch' || mode === 'digits' || mode === 'custom' || mode === 'mixed') {
    return mode;
  }

  return fallback;
};

const normalizeCustomSet = (customSet: unknown, fallback: readonly string[]): readonly string[] => {
  if (!Array.isArray(customSet)) {
    return fallback;
  }

  const unique = new Set<string>();
  customSet.forEach((value) => {
    if (typeof value === 'string' && value.trim().length > 0) {
      unique.add(value.trim().toUpperCase());
    }
  });
  return Array.from(unique.values());
};

const normalizeCustomSequence = (customSequence: unknown, fallback: readonly string[] | undefined): readonly string[] | undefined => {
  if (!Array.isArray(customSequence) || customSequence.length === 0) {
    return fallback;
  }

  const normalized = customSequence
    .map((value) => (typeof value === 'string' ? value.trim() : String(value ?? '').trim()))
    .filter((value) => value.length > 0);
  
  return normalized.length > 0 ? normalized : fallback;
};

const normalizeEchoKeyerMode = (
  mode: unknown,
  fallback: TrainingSettings['echoKeyerMode'],
): TrainingSettings['echoKeyerMode'] => {
  if (mode === 'manual' || mode === 'iambic-b') {
    return mode;
  }
  return fallback ?? 'manual';
};

const normalizeQrmProfile = (
  profile: unknown,
  fallback: TrainingSettings['qrmProfile'],
): TrainingSettings['qrmProfile'] => {
  if (profile === 'whistle' || profile === 'ringing' || profile === 'mixed') {
    return profile;
  }
  return fallback;
};

export const normalizeTrainingSettings = (
  raw: unknown,
  fallback: TrainingSettings,
): TrainingSettings => {
  if (!raw || typeof raw !== 'object') {
    return fallback;
  }

  const candidate = raw as Record<string, unknown>;
  const normalizedDigits =
    typeof candidate['digitsLevel'] === 'number'
      ? Math.min(Math.max(Math.trunc(candidate['digitsLevel']), DIGITS_LEVEL_MIN), DIGITS_LEVEL_MAX)
      : fallback.digitsLevel;

  const normalizedMixedLettersPercent =
    typeof candidate['mixedLettersPercent'] === 'number'
      ? Math.min(Math.max(Math.trunc(candidate['mixedLettersPercent']), MIXED_LETTERS_PERCENT_MIN), MIXED_LETTERS_PERCENT_MAX)
      : (fallback as { mixedLettersPercent?: number }).mixedLettersPercent ?? 70;

  const merged = {
    ...fallback,
    ...candidate,
    charSetMode: normalizeCharSetMode(candidate['charSetMode'], fallback.charSetMode),
    digitsLevel: normalizedDigits,
    mixedLettersPercent: normalizedMixedLettersPercent,
    customSet: normalizeCustomSet(candidate['customSet'], fallback.customSet),
    customSequence: normalizeCustomSequence(candidate['customSequence'], fallback.customSequence),
    echoKeyerMode: normalizeEchoKeyerMode(candidate['echoKeyerMode'], fallback.echoKeyerMode),
    qsbEnabled:
      typeof candidate['qsbEnabled'] === 'boolean'
        ? candidate['qsbEnabled']
        : fallback.qsbEnabled,
    qsbDepth: normalizeFiniteNumber(
      candidate['qsbDepth'],
      fallback.qsbDepth,
      AUDIO_REALISM_LEVEL_MIN,
      AUDIO_REALISM_LEVEL_MAX,
    ),
    qsbRateHz: normalizeFiniteNumber(
      candidate['qsbRateHz'],
      fallback.qsbRateHz,
      QSB_RATE_MIN,
      QSB_RATE_MAX,
    ),
    qrnEnabled:
      typeof candidate['qrnEnabled'] === 'boolean'
        ? candidate['qrnEnabled']
        : fallback.qrnEnabled,
    qrnLevel: normalizeFiniteNumber(
      candidate['qrnLevel'],
      fallback.qrnLevel,
      AUDIO_REALISM_LEVEL_MIN,
      AUDIO_REALISM_LEVEL_MAX,
    ),
    qrmEnabled:
      typeof candidate['qrmEnabled'] === 'boolean'
        ? candidate['qrmEnabled']
        : fallback.qrmEnabled,
    qrmLevel: normalizeFiniteNumber(
      candidate['qrmLevel'],
      fallback.qrmLevel,
      AUDIO_REALISM_LEVEL_MIN,
      AUDIO_REALISM_LEVEL_MAX,
    ),
    qrmProfile: normalizeQrmProfile(candidate['qrmProfile'], fallback.qrmProfile),
    receiverBackgroundGain: normalizeFiniteNumber(
      candidate['receiverBackgroundGain'],
      fallback.receiverBackgroundGain,
      RECEIVER_GAIN_MIN,
      RECEIVER_GAIN_MAX,
    ),
    receiverBackgroundExcitationRate: normalizeFiniteNumber(
      candidate['receiverBackgroundExcitationRate'],
      fallback.receiverBackgroundExcitationRate,
      RECEIVER_EXCITATION_RATE_MIN,
      RECEIVER_EXCITATION_RATE_MAX,
    ),
    receiverBackgroundResonance: normalizeFiniteNumber(
      candidate['receiverBackgroundResonance'],
      fallback.receiverBackgroundResonance,
      RECEIVER_RESONANCE_MIN,
      RECEIVER_RESONANCE_MAX,
    ),
    receiverBackgroundDecay: normalizeFiniteNumber(
      candidate['receiverBackgroundDecay'],
      fallback.receiverBackgroundDecay,
      RECEIVER_DECAY_MIN,
      RECEIVER_DECAY_MAX,
    ),
    receiverBackgroundOffsetHz: normalizeFiniteNumber(
      candidate['receiverBackgroundOffsetHz'],
      fallback.receiverBackgroundOffsetHz,
      RECEIVER_OFFSET_MIN,
      RECEIVER_OFFSET_MAX,
    ),
    receiverBackgroundOffsetModDepthHz: normalizeFiniteNumber(
      candidate['receiverBackgroundOffsetModDepthHz'],
      fallback.receiverBackgroundOffsetModDepthHz,
      RECEIVER_OFFSET_MOD_DEPTH_MIN,
      RECEIVER_OFFSET_MOD_DEPTH_MAX,
    ),
    receiverBackgroundOffsetModRateHz: normalizeFiniteNumber(
      candidate['receiverBackgroundOffsetModRateHz'],
      fallback.receiverBackgroundOffsetModRateHz,
      RECEIVER_OFFSET_MOD_RATE_MIN,
      RECEIVER_OFFSET_MOD_RATE_MAX,
    ),
    autoAdjustKoch:
      typeof candidate['autoAdjustKoch'] === 'boolean'
        ? candidate['autoAdjustKoch']
        : fallback.autoAdjustKoch,
    echoAutoAdjustKoch:
      typeof candidate['echoAutoAdjustKoch'] === 'boolean'
        ? candidate['echoAutoAdjustKoch']
        : fallback.echoAutoAdjustKoch,
    echoAutoAdjustThreshold:
      typeof candidate['echoAutoAdjustThreshold'] === 'number'
        ? candidate['echoAutoAdjustThreshold']
        : fallback.echoAutoAdjustThreshold,
    echoAutoAdjustBelowThresholdCount:
      typeof candidate['echoAutoAdjustBelowThresholdCount'] === 'number'
        ? candidate['echoAutoAdjustBelowThresholdCount']
        : fallback.echoAutoAdjustBelowThresholdCount,
    echoAutoAdjustAboveThresholdCount:
      typeof candidate['echoAutoAdjustAboveThresholdCount'] === 'number'
        ? candidate['echoAutoAdjustAboveThresholdCount']
        : fallback.echoAutoAdjustAboveThresholdCount,
    linkCharWpm:
      typeof candidate['linkCharWpm'] === 'boolean' ? candidate['linkCharWpm'] : fallback.linkCharWpm,
    linkEffectiveWpm:
      typeof candidate['linkEffectiveWpm'] === 'boolean' ? candidate['linkEffectiveWpm'] : fallback.linkEffectiveWpm,
    linkGroupSize:
      typeof candidate['linkGroupSize'] === 'boolean' ? candidate['linkGroupSize'] : fallback.linkGroupSize,
  };

  const parseResult = trainingSettingsSchema.safeParse(repairTrainingSettingsCandidate(merged));
  if (parseResult.success) {
    const parsed = parseResult.data;
    // Convert to domain type, conditionally including customSequence only when it has a value
    const { customSequence, ...restParsed } = parsed;
    return {
      ...restParsed,
      customSet: parsed.customSet ?? [],
      ...(customSequence && customSequence.length > 0
        ? { customSequence: customSequence as readonly string[] }
        : {}),
    } as TrainingSettings;
  }

  // Log validation errors for debugging
  console.warn('[settings] Validation failed when normalizing settings:', parseResult.error);
  console.warn('[settings] Merged data that failed validation:', merged);
  console.warn('[settings] Candidate data (from Firestore/localStorage):', candidate);
  
  // Try to preserve valid values from candidate even if validation fails
  // This prevents losing user data due to schema changes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const partialResult: any = {
    ...fallback,
  };
  
  // Preserve numeric values if they're valid
  if (typeof candidate['kochLevel'] === 'number') partialResult.kochLevel = candidate['kochLevel'];
  if (typeof candidate['charWpmMin'] === 'number') partialResult.charWpmMin = candidate['charWpmMin'];
  if (typeof candidate['charWpmMax'] === 'number') partialResult.charWpmMax = candidate['charWpmMax'];
  if (typeof candidate['effectiveWpmMin'] === 'number') partialResult.effectiveWpmMin = candidate['effectiveWpmMin'];
  if (typeof candidate['effectiveWpmMax'] === 'number') partialResult.effectiveWpmMax = candidate['effectiveWpmMax'];
  if (typeof candidate['numGroups'] === 'number') partialResult.numGroups = candidate['numGroups'];
  if (typeof candidate['sessionDuration'] === 'number') partialResult.sessionDuration = candidate['sessionDuration'];
  if (typeof candidate['charsPerGroup'] === 'number') partialResult.charsPerGroup = candidate['charsPerGroup'];
  if (typeof candidate['groupTimeout'] === 'number') partialResult.groupTimeout = candidate['groupTimeout'];
  if (typeof candidate['minGroupSize'] === 'number') partialResult.minGroupSize = candidate['minGroupSize'];
  if (typeof candidate['maxGroupSize'] === 'number') partialResult.maxGroupSize = candidate['maxGroupSize'];
  if (typeof candidate['sideToneMin'] === 'number') partialResult.sideToneMin = candidate['sideToneMin'];
  if (typeof candidate['sideToneMax'] === 'number') partialResult.sideToneMax = candidate['sideToneMax'];
  if (typeof candidate['volumeMin'] === 'number') partialResult.volumeMin = Math.max(0.1, Math.min(1, candidate['volumeMin']));
  if (typeof candidate['volumeMax'] === 'number') partialResult.volumeMax = Math.max(0.1, Math.min(1, candidate['volumeMax']));
  if (typeof candidate['linkVolume'] === 'boolean') partialResult.linkVolume = candidate['linkVolume'];
  if (typeof candidate['steepness'] === 'number') partialResult.steepness = candidate['steepness'];
  if (typeof candidate['extraWordSpaceMultiplier'] === 'number') partialResult.extraWordSpaceMultiplier = candidate['extraWordSpaceMultiplier'];
  if (typeof candidate['envelopeSmoothing'] === 'number') partialResult.envelopeSmoothing = candidate['envelopeSmoothing'];
  if (typeof candidate['qsbEnabled'] === 'boolean') partialResult.qsbEnabled = candidate['qsbEnabled'];
  if (isFiniteNumber(candidate['qsbDepth'])) {
    partialResult.qsbDepth = clampNumber(candidate['qsbDepth'], AUDIO_REALISM_LEVEL_MIN, AUDIO_REALISM_LEVEL_MAX);
  }
  if (isFiniteNumber(candidate['qsbRateHz'])) {
    partialResult.qsbRateHz = clampNumber(candidate['qsbRateHz'], QSB_RATE_MIN, QSB_RATE_MAX);
  }
  if (typeof candidate['qrnEnabled'] === 'boolean') partialResult.qrnEnabled = candidate['qrnEnabled'];
  if (isFiniteNumber(candidate['qrnLevel'])) {
    partialResult.qrnLevel = clampNumber(candidate['qrnLevel'], AUDIO_REALISM_LEVEL_MIN, AUDIO_REALISM_LEVEL_MAX);
  }
  if (typeof candidate['qrmEnabled'] === 'boolean') partialResult.qrmEnabled = candidate['qrmEnabled'];
  if (isFiniteNumber(candidate['qrmLevel'])) {
    partialResult.qrmLevel = clampNumber(candidate['qrmLevel'], AUDIO_REALISM_LEVEL_MIN, AUDIO_REALISM_LEVEL_MAX);
  }
  partialResult.qrmProfile = normalizeQrmProfile(candidate['qrmProfile'], fallback.qrmProfile);
  if (isFiniteNumber(candidate['receiverBackgroundGain'])) {
    partialResult.receiverBackgroundGain = clampNumber(candidate['receiverBackgroundGain'], RECEIVER_GAIN_MIN, RECEIVER_GAIN_MAX);
  }
  if (isFiniteNumber(candidate['receiverBackgroundExcitationRate'])) {
    partialResult.receiverBackgroundExcitationRate = clampNumber(
      candidate['receiverBackgroundExcitationRate'],
      RECEIVER_EXCITATION_RATE_MIN,
      RECEIVER_EXCITATION_RATE_MAX,
    );
  }
  if (isFiniteNumber(candidate['receiverBackgroundResonance'])) {
    partialResult.receiverBackgroundResonance = clampNumber(
      candidate['receiverBackgroundResonance'],
      RECEIVER_RESONANCE_MIN,
      RECEIVER_RESONANCE_MAX,
    );
  }
  if (isFiniteNumber(candidate['receiverBackgroundDecay'])) {
    partialResult.receiverBackgroundDecay = clampNumber(candidate['receiverBackgroundDecay'], RECEIVER_DECAY_MIN, RECEIVER_DECAY_MAX);
  }
  if (isFiniteNumber(candidate['receiverBackgroundOffsetHz'])) {
    partialResult.receiverBackgroundOffsetHz = clampNumber(candidate['receiverBackgroundOffsetHz'], RECEIVER_OFFSET_MIN, RECEIVER_OFFSET_MAX);
  }
  if (isFiniteNumber(candidate['receiverBackgroundOffsetModDepthHz'])) {
    partialResult.receiverBackgroundOffsetModDepthHz = clampNumber(
      candidate['receiverBackgroundOffsetModDepthHz'],
      RECEIVER_OFFSET_MOD_DEPTH_MIN,
      RECEIVER_OFFSET_MOD_DEPTH_MAX,
    );
  }
  if (isFiniteNumber(candidate['receiverBackgroundOffsetModRateHz'])) {
    partialResult.receiverBackgroundOffsetModRateHz = clampNumber(
      candidate['receiverBackgroundOffsetModRateHz'],
      RECEIVER_OFFSET_MOD_RATE_MIN,
      RECEIVER_OFFSET_MOD_RATE_MAX,
    );
  }
  if (typeof candidate['autoAdjustThreshold'] === 'number') partialResult.autoAdjustThreshold = candidate['autoAdjustThreshold'];
  if (typeof candidate['autoAdjustBelowThresholdCount'] === 'number') partialResult.autoAdjustBelowThresholdCount = candidate['autoAdjustBelowThresholdCount'];
  if (typeof candidate['autoAdjustAboveThresholdCount'] === 'number') partialResult.autoAdjustAboveThresholdCount = candidate['autoAdjustAboveThresholdCount'];
  if (typeof candidate['echoAutoAdjustThreshold'] === 'number') partialResult.echoAutoAdjustThreshold = candidate['echoAutoAdjustThreshold'];
  if (typeof candidate['echoAutoAdjustBelowThresholdCount'] === 'number') {
    partialResult.echoAutoAdjustBelowThresholdCount = candidate['echoAutoAdjustBelowThresholdCount'];
  }
  if (typeof candidate['echoAutoAdjustAboveThresholdCount'] === 'number') {
    partialResult.echoAutoAdjustAboveThresholdCount = candidate['echoAutoAdjustAboveThresholdCount'];
  }

  partialResult.charSetMode = normalizeCharSetMode(candidate['charSetMode'], fallback.charSetMode);
  partialResult.digitsLevel = normalizedDigits;
  if (typeof candidate['mixedLettersPercent'] === 'number') {
    partialResult.mixedLettersPercent = Math.min(MIXED_LETTERS_PERCENT_MAX, Math.max(MIXED_LETTERS_PERCENT_MIN, Math.trunc(candidate['mixedLettersPercent'])));
  } else if ((fallback as { mixedLettersPercent?: number }).mixedLettersPercent !== undefined) {
    partialResult.mixedLettersPercent = (fallback as { mixedLettersPercent?: number }).mixedLettersPercent;
  }
  partialResult.customSet = normalizeCustomSet(candidate['customSet'], fallback.customSet);
  const normalizedSeq = normalizeCustomSequence(candidate['customSequence'], fallback.customSequence);
  if (normalizedSeq) partialResult.customSequence = normalizedSeq;
  partialResult.echoKeyerMode = normalizeEchoKeyerMode(
    candidate['echoKeyerMode'],
    fallback.echoKeyerMode,
  );
  partialResult.autoAdjustKoch = typeof candidate['autoAdjustKoch'] === 'boolean' ? candidate['autoAdjustKoch'] : fallback.autoAdjustKoch;
  partialResult.echoAutoAdjustKoch =
    typeof candidate['echoAutoAdjustKoch'] === 'boolean'
      ? candidate['echoAutoAdjustKoch']
      : fallback.echoAutoAdjustKoch;
  partialResult.linkCharWpm = typeof candidate['linkCharWpm'] === 'boolean' ? candidate['linkCharWpm'] : fallback.linkCharWpm;
  partialResult.linkEffectiveWpm = typeof candidate['linkEffectiveWpm'] === 'boolean' ? candidate['linkEffectiveWpm'] : fallback.linkEffectiveWpm;
  partialResult.linkGroupSize = typeof candidate['linkGroupSize'] === 'boolean' ? candidate['linkGroupSize'] : fallback.linkGroupSize;
  if (typeof candidate['errorWeightStrength'] === 'number') partialResult.errorWeightStrength = candidate['errorWeightStrength'];
  if (typeof candidate['slidingWindowStart'] === 'number') {
    partialResult.slidingWindowStart = Math.min(SLIDING_WINDOW_INDEX_MAX, Math.max(SLIDING_WINDOW_INDEX_MIN, Math.trunc(candidate['slidingWindowStart'])));
  }
  if (typeof candidate['slidingWindowEnd'] === 'number') {
    partialResult.slidingWindowEnd = Math.min(SLIDING_WINDOW_INDEX_MAX, Math.max(SLIDING_WINDOW_INDEX_MIN, Math.trunc(candidate['slidingWindowEnd'])));
  }
  // Backward compat: old slidingWindowSize → treat as full range (start=1, end=40)
  if (typeof candidate['slidingWindowSize'] === 'number' && candidate['slidingWindowStart'] === undefined && candidate['slidingWindowEnd'] === undefined) {
    partialResult.slidingWindowStart = 1;
    partialResult.slidingWindowEnd = 40;
  }

  // Validate the partial result
  const partialParseResult = trainingSettingsSchema.safeParse(repairTrainingSettingsCandidate(partialResult));
  if (partialParseResult.success) {
    const parsed = partialParseResult.data;
    const { customSequence: finalCustomSequence, ...restParsed } = parsed;
    return {
      ...restParsed,
      customSet: parsed.customSet ?? [],
      ...(finalCustomSequence && finalCustomSequence.length > 0
        ? { customSequence: finalCustomSequence as readonly string[] }
        : {}),
    } as TrainingSettings;
  }
  
  // If even partial validation fails, return fallback but log the issue
  console.error('[settings] Even partial normalization failed, using fallback. This indicates a serious data corruption issue.');
  return fallback;
};

export const serializeTrainingSettings = (settings: TrainingSettings): string => {
  const stable = trainingSettingsSchema.parse(settings);
  return JSON.stringify(stable);
};

export const hasSettingsChanged = (
  current: TrainingSettings,
  previous: TrainingSettings | null,
): boolean => {
  if (!previous) {
    return true;
  }

  return serializeTrainingSettings(current) !== serializeTrainingSettings(previous);
};
