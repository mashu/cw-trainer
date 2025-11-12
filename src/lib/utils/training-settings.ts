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

const normalizeCustomSequence = (customSequence: unknown, fallback: readonly string[] | undefined): readonly string[] | undefined => {
  if (!Array.isArray(customSequence) || customSequence.length === 0) {
    return fallback;
  }

  const normalized = customSequence
    .map((value) => (typeof value === 'string' ? value.trim() : String(value ?? '').trim()))
    .filter((value) => value.length > 0);
  
  return normalized.length > 0 ? normalized : fallback;
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
    customSequence: normalizeCustomSequence(candidate['customSequence'], fallback.customSequence),
    autoAdjustKoch:
      typeof candidate['autoAdjustKoch'] === 'boolean'
        ? candidate['autoAdjustKoch']
        : fallback.autoAdjustKoch,
    linkSpeeds:
      typeof candidate['linkSpeeds'] === 'boolean' ? candidate['linkSpeeds'] : fallback.linkSpeeds,
  };

  const parseResult = trainingSettingsSchema.safeParse(merged);
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
