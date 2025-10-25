import type { TrainingSettings } from '@/components/TrainingSettingsForm';

export const serializeSettings = (s: TrainingSettings): string => {
  const stable = {
    kochLevel: s.kochLevel,
    charSetMode: s.charSetMode || 'koch',
    digitsLevel: typeof s.digitsLevel === 'number' ? Math.max(1, Math.min(10, s.digitsLevel)) : undefined,
    customSet: Array.isArray(s.customSet) ? Array.from(new Set(s.customSet.map(c => (c || '').toString().trim().toUpperCase()).filter(Boolean))) : undefined,
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
    autoAdjustThreshold: typeof s.autoAdjustThreshold === 'number' ? s.autoAdjustThreshold : 90
  };
  return JSON.stringify(stable);
};

export const normalizeSettings = (raw: any, fallback: TrainingSettings): TrainingSettings => {
  const legacyWpm = typeof raw?.wpm === 'number' && isFinite(raw.wpm) ? raw.wpm : undefined;
  const legacySide = typeof raw?.sideTone === 'number' && isFinite(raw.sideTone) ? raw.sideTone : undefined;
  const charWpm = typeof raw?.charWpm === 'number' ? raw.charWpm : (legacyWpm ?? fallback.charWpm);
  const effectiveWpm = typeof raw?.effectiveWpm === 'number' ? raw.effectiveWpm : (legacyWpm ?? charWpm);
  const linkSpeeds = typeof raw?.linkSpeeds === 'boolean' ? raw.linkSpeeds : (charWpm === effectiveWpm);
  const sideMin = typeof raw?.sideToneMin === 'number' ? raw.sideToneMin : (legacySide ?? fallback.sideToneMin);
  const sideMax = typeof raw?.sideToneMax === 'number' ? raw.sideToneMax : (legacySide ?? fallback.sideToneMax);
  return {
    kochLevel: typeof raw?.kochLevel === 'number' ? raw.kochLevel : fallback.kochLevel,
    charSetMode: (raw?.charSetMode === 'digits' || raw?.charSetMode === 'custom' || raw?.charSetMode === 'koch') ? raw.charSetMode : (fallback.charSetMode ?? 'koch'),
    digitsLevel: typeof raw?.digitsLevel === 'number' ? Math.max(1, Math.min(10, raw.digitsLevel)) : (fallback.digitsLevel ?? 10),
    customSet: Array.isArray(raw?.customSet) ? Array.from(new Set(raw.customSet.map((c: any) => (c || '').toString().trim().toUpperCase()).filter(Boolean))) : (Array.isArray(fallback.customSet) ? fallback.customSet : []),
    sideToneMin: sideMin,
    sideToneMax: sideMax,
    steepness: typeof raw?.steepness === 'number' ? raw.steepness : fallback.steepness,
    sessionDuration: typeof raw?.sessionDuration === 'number' ? raw.sessionDuration : fallback.sessionDuration,
    charsPerGroup: typeof raw?.charsPerGroup === 'number' ? raw.charsPerGroup : fallback.charsPerGroup,
    numGroups: typeof raw?.numGroups === 'number' ? raw.numGroups : fallback.numGroups,
    charWpm,
    effectiveWpm,
    linkSpeeds,
    extraWordSpaceMultiplier: Math.max(1, typeof raw?.extraWordSpaceMultiplier === 'number' ? raw.extraWordSpaceMultiplier : (fallback.extraWordSpaceMultiplier ?? 1)),
    groupTimeout: typeof raw?.groupTimeout === 'number' ? raw.groupTimeout : fallback.groupTimeout,
    minGroupSize: typeof raw?.minGroupSize === 'number' ? raw.minGroupSize : fallback.minGroupSize,
    maxGroupSize: typeof raw?.maxGroupSize === 'number' ? raw.maxGroupSize : fallback.maxGroupSize,
    interactiveMode: !!(typeof raw?.interactiveMode === 'boolean' ? raw.interactiveMode : fallback.interactiveMode),
    envelopeSmoothing: typeof raw?.envelopeSmoothing === 'number' ? raw.envelopeSmoothing : (fallback.envelopeSmoothing ?? 0),
    autoAdjustKoch: !!(typeof raw?.autoAdjustKoch === 'boolean' ? raw.autoAdjustKoch : fallback.autoAdjustKoch),
    autoAdjustThreshold: typeof raw?.autoAdjustThreshold === 'number' ? raw?.autoAdjustThreshold : (fallback.autoAdjustThreshold ?? 90),
  };
};


