import type { TrainingSettings } from '@/components/ui/forms/TrainingSettingsForm';

export const serializeSettings = (s: TrainingSettings): string => {
  const stable = {
    kochLevel: s.kochLevel,
    charSetMode: s.charSetMode || 'koch',
    digitsLevel:
      typeof s.digitsLevel === 'number' ? Math.max(1, Math.min(10, s.digitsLevel)) : undefined,
    customSet: Array.isArray(s.customSet)
      ? Array.from(
          new Set(
            s.customSet.map((c) => (c || '').toString().trim().toUpperCase()).filter(Boolean),
          ),
        )
      : undefined,
    customSequence: Array.isArray(s.customSequence) && s.customSequence.length > 0
      ? [...s.customSequence]
      : undefined,
    sideToneMin: s.sideToneMin,
    sideToneMax: s.sideToneMax,
    steepness: s.steepness,
    sessionDuration: s.sessionDuration,
    charsPerGroup: s.charsPerGroup,
    numGroups: s.numGroups,
    charWpmMin: s.charWpmMin,
    charWpmMax: s.charWpmMax,
    linkCharWpm: !!s.linkCharWpm,
    effectiveWpmMin: s.effectiveWpmMin,
    effectiveWpmMax: s.effectiveWpmMax,
    linkEffectiveWpm: !!s.linkEffectiveWpm,
    linkCharToEffective: !!s.linkCharToEffective,
    extraWordSpaceMultiplier: s.extraWordSpaceMultiplier ?? 1,
    groupTimeout: s.groupTimeout,
    minGroupSize: s.minGroupSize,
    maxGroupSize: s.maxGroupSize,
    linkGroupSize: !!s.linkGroupSize,
    envelopeSmoothing: s.envelopeSmoothing ?? 0,
    autoAdjustKoch: !!s.autoAdjustKoch,
    autoAdjustThreshold: typeof s.autoAdjustThreshold === 'number' ? s.autoAdjustThreshold : 90,
    autoAdjustBelowThresholdCount: typeof s.autoAdjustBelowThresholdCount === 'number' ? s.autoAdjustBelowThresholdCount : 0,
    autoAdjustAboveThresholdCount: typeof s.autoAdjustAboveThresholdCount === 'number' ? s.autoAdjustAboveThresholdCount : 0,
    errorWeightStrength: typeof s.errorWeightStrength === 'number' ? s.errorWeightStrength : 0,
  };
  return JSON.stringify(stable);
};

type LegacyTrainingSettings = Partial<TrainingSettings> & {
  wpm?: number;
  charWpm?: number; // Legacy single WPM field
  effectiveWpm?: number; // Legacy single WPM field
  linkSpeeds?: boolean; // Legacy link field
  sideTone?: number;
  customSet?: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => (typeof entry === 'string' ? entry : String(entry ?? '')).trim().toUpperCase())
    .filter((entry) => entry.length > 0);
};

export const normalizeSettings = (raw: unknown, fallback: TrainingSettings): TrainingSettings => {
  const candidate: LegacyTrainingSettings = isRecord(raw) ? (raw as LegacyTrainingSettings) : {};

  const legacyWpm =
    typeof candidate.wpm === 'number' && Number.isFinite(candidate.wpm) ? candidate.wpm : undefined;
  const legacySideTone =
    typeof candidate.sideTone === 'number' && Number.isFinite(candidate.sideTone)
      ? candidate.sideTone
      : undefined;

  // Support legacy single charWpm/effectiveWpm fields
  const legacyCharWpm =
    typeof candidate.charWpm === 'number' ? candidate.charWpm : undefined;
  const legacyEffectiveWpm =
    typeof candidate.effectiveWpm === 'number' ? candidate.effectiveWpm : undefined;

  // Resolve charWpmMin/Max with fallback to legacy fields
  const charWpmMin =
    typeof candidate.charWpmMin === 'number'
      ? candidate.charWpmMin
      : (legacyCharWpm ?? legacyWpm ?? fallback.charWpmMin);
  const charWpmMax =
    typeof candidate.charWpmMax === 'number'
      ? candidate.charWpmMax
      : (legacyCharWpm ?? legacyWpm ?? fallback.charWpmMax);
  const linkCharWpm =
    typeof candidate.linkCharWpm === 'boolean'
      ? candidate.linkCharWpm
      : (typeof candidate.linkSpeeds === 'boolean' ? candidate.linkSpeeds : charWpmMin === charWpmMax);

  // Resolve effectiveWpmMin/Max with fallback to legacy fields
  const effectiveWpmMin =
    typeof candidate.effectiveWpmMin === 'number'
      ? candidate.effectiveWpmMin
      : (legacyEffectiveWpm ?? legacyWpm ?? fallback.effectiveWpmMin);
  const effectiveWpmMax =
    typeof candidate.effectiveWpmMax === 'number'
      ? candidate.effectiveWpmMax
      : (legacyEffectiveWpm ?? legacyWpm ?? fallback.effectiveWpmMax);
  const linkEffectiveWpm =
    typeof candidate.linkEffectiveWpm === 'boolean'
      ? candidate.linkEffectiveWpm
      : (typeof candidate.linkSpeeds === 'boolean' ? candidate.linkSpeeds : effectiveWpmMin === effectiveWpmMax);
  
  // Determine if char and effective speeds should be linked
  // Default to true if both min values match AND both max values match (no Farnsworth spacing)
  const linkCharToEffective =
    typeof candidate.linkCharToEffective === 'boolean'
      ? candidate.linkCharToEffective
      : (charWpmMin === effectiveWpmMin && charWpmMax === effectiveWpmMax);

  const sideToneMin =
    typeof candidate.sideToneMin === 'number'
      ? candidate.sideToneMin
      : (legacySideTone ?? fallback.sideToneMin);
  const sideToneMax =
    typeof candidate.sideToneMax === 'number'
      ? candidate.sideToneMax
      : (legacySideTone ?? fallback.sideToneMax);

  const normalizedCustomSet = toStringArray(candidate.customSet);
  const normalizedCustomSequence = Array.isArray(candidate.customSequence) && candidate.customSequence.length > 0
    ? candidate.customSequence.map((c) => (typeof c === 'string' ? c : String(c ?? '')).trim()).filter((c) => c.length > 0)
    : undefined;

  const finalCustomSequence = normalizedCustomSequence ?? fallback.customSequence;

  // Resolve linkGroupSize
  const minGroupSize =
    typeof candidate.minGroupSize === 'number' ? candidate.minGroupSize : fallback.minGroupSize;
  const maxGroupSize =
    typeof candidate.maxGroupSize === 'number' ? candidate.maxGroupSize : fallback.maxGroupSize;
  const linkGroupSize =
    typeof candidate.linkGroupSize === 'boolean'
      ? candidate.linkGroupSize
      : minGroupSize === maxGroupSize;

  return {
    kochLevel: typeof candidate.kochLevel === 'number' ? candidate.kochLevel : fallback.kochLevel,
    charSetMode:
      candidate.charSetMode === 'digits' ||
      candidate.charSetMode === 'custom' ||
      candidate.charSetMode === 'koch'
        ? candidate.charSetMode
        : (fallback.charSetMode ?? 'koch'),
    digitsLevel:
      typeof candidate.digitsLevel === 'number'
        ? Math.max(1, Math.min(10, candidate.digitsLevel))
        : (fallback.digitsLevel ?? 10),
    customSet:
      normalizedCustomSet.length > 0
        ? normalizedCustomSet
        : Array.isArray(fallback.customSet)
          ? fallback.customSet
          : [],
    ...(finalCustomSequence ? { customSequence: finalCustomSequence } : {}),
    sideToneMin,
    sideToneMax,
    steepness: typeof candidate.steepness === 'number' ? candidate.steepness : fallback.steepness,
    sessionDuration:
      typeof candidate.sessionDuration === 'number'
        ? candidate.sessionDuration
        : fallback.sessionDuration,
    charsPerGroup:
      typeof candidate.charsPerGroup === 'number'
        ? candidate.charsPerGroup
        : fallback.charsPerGroup,
    numGroups: typeof candidate.numGroups === 'number' ? candidate.numGroups : fallback.numGroups,
    charWpmMin,
    charWpmMax,
    linkCharWpm,
    effectiveWpmMin,
    effectiveWpmMax,
    linkEffectiveWpm,
    linkCharToEffective,
    extraWordSpaceMultiplier: Math.max(
      0.1,
      typeof candidate.extraWordSpaceMultiplier === 'number'
        ? candidate.extraWordSpaceMultiplier
        : (fallback.extraWordSpaceMultiplier ?? 1),
    ),
    groupTimeout:
      typeof candidate.groupTimeout === 'number' ? candidate.groupTimeout : fallback.groupTimeout,
    minGroupSize,
    maxGroupSize,
    linkGroupSize,
    envelopeSmoothing:
      typeof candidate.envelopeSmoothing === 'number'
        ? candidate.envelopeSmoothing
        : (fallback.envelopeSmoothing ?? 0),
    autoAdjustKoch:
      typeof candidate.autoAdjustKoch === 'boolean'
        ? candidate.autoAdjustKoch
        : Boolean(fallback.autoAdjustKoch),
    autoAdjustThreshold:
      typeof candidate.autoAdjustThreshold === 'number'
        ? candidate.autoAdjustThreshold
        : (fallback.autoAdjustThreshold ?? 90),
    autoAdjustBelowThresholdCount:
      typeof candidate.autoAdjustBelowThresholdCount === 'number'
        ? candidate.autoAdjustBelowThresholdCount
        : (fallback.autoAdjustBelowThresholdCount ?? 0),
    autoAdjustAboveThresholdCount:
      typeof candidate.autoAdjustAboveThresholdCount === 'number'
        ? candidate.autoAdjustAboveThresholdCount
        : (fallback.autoAdjustAboveThresholdCount ?? 0),
    errorWeightStrength:
      typeof candidate.errorWeightStrength === 'number'
        ? Math.max(0, Math.min(5, candidate.errorWeightStrength))
        : (fallback.errorWeightStrength ?? 0),
  };
};
