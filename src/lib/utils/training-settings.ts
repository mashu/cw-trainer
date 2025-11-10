import { trainingSettingsSchema } from '@/lib/validators';
import type { TrainingSettings } from '@/types';

const DIGITS_LEVEL_MIN = 1;
const DIGITS_LEVEL_MAX = 10;

const normalizeCharSetMode = (
  mode: unknown,
  fallback: TrainingSettings['charSetMode'],
): TrainingSettings['charSetMode'] => {
  if (mode === 'koch' || mode === 'digits' || mode === 'custom') {
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

  const merged = {
    ...fallback,
    ...candidate,
    charSetMode: normalizeCharSetMode(candidate['charSetMode'], fallback.charSetMode),
    digitsLevel: normalizedDigits,
    customSet: normalizeCustomSet(candidate['customSet'], fallback.customSet),
    autoAdjustKoch:
      typeof candidate['autoAdjustKoch'] === 'boolean'
        ? candidate['autoAdjustKoch']
        : fallback.autoAdjustKoch,
    linkSpeeds:
      typeof candidate['linkSpeeds'] === 'boolean' ? candidate['linkSpeeds'] : fallback.linkSpeeds,
  };

  const parseResult = trainingSettingsSchema.safeParse(merged);
  if (parseResult.success) {
    return parseResult.data;
  }

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
