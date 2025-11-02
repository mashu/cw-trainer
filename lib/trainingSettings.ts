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
    sideToneMin: s.sideToneMin,
    sideToneMax: s.sideToneMax,
    steepness: s.steepness,
    sessionDuration: s.sessionDuration,
    charsPerGroup: s.charsPerGroup,
    numGroups: s.numGroups,
    charWpm: s.charWpm,
    effectiveWpm: s.effectiveWpm,
    linkSpeeds: !!s.linkSpeeds,
    extraWordSpaceMultiplier: s.extraWordSpaceMultiplier ?? 1,
    groupTimeout: s.groupTimeout,
    minGroupSize: s.minGroupSize,
    maxGroupSize: s.maxGroupSize,
    interactiveMode: s.interactiveMode,
    envelopeSmoothing: s.envelopeSmoothing ?? 0,
    autoAdjustKoch: !!s.autoAdjustKoch,
    autoAdjustThreshold: typeof s.autoAdjustThreshold === 'number' ? s.autoAdjustThreshold : 90,
  };
  return JSON.stringify(stable);
};

type LegacyTrainingSettings = Partial<TrainingSettings> & {
  wpm?: number;
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

  const charWpm =
    typeof candidate.charWpm === 'number' ? candidate.charWpm : (legacyWpm ?? fallback.charWpm);
  const effectiveWpm =
    typeof candidate.effectiveWpm === 'number' ? candidate.effectiveWpm : (legacyWpm ?? charWpm);
  const linkSpeeds =
    typeof candidate.linkSpeeds === 'boolean' ? candidate.linkSpeeds : charWpm === effectiveWpm;
  const sideToneMin =
    typeof candidate.sideToneMin === 'number'
      ? candidate.sideToneMin
      : (legacySideTone ?? fallback.sideToneMin);
  const sideToneMax =
    typeof candidate.sideToneMax === 'number'
      ? candidate.sideToneMax
      : (legacySideTone ?? fallback.sideToneMax);

  const normalizedCustomSet = toStringArray(candidate.customSet);

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
    charWpm,
    effectiveWpm,
    linkSpeeds,
    extraWordSpaceMultiplier: Math.max(
      1,
      typeof candidate.extraWordSpaceMultiplier === 'number'
        ? candidate.extraWordSpaceMultiplier
        : (fallback.extraWordSpaceMultiplier ?? 1),
    ),
    groupTimeout:
      typeof candidate.groupTimeout === 'number' ? candidate.groupTimeout : fallback.groupTimeout,
    minGroupSize:
      typeof candidate.minGroupSize === 'number' ? candidate.minGroupSize : fallback.minGroupSize,
    maxGroupSize:
      typeof candidate.maxGroupSize === 'number' ? candidate.maxGroupSize : fallback.maxGroupSize,
    interactiveMode:
      typeof candidate.interactiveMode === 'boolean'
        ? candidate.interactiveMode
        : Boolean(fallback.interactiveMode),
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
  };
};
