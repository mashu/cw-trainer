import type { SessionResult, TrainingSettings } from '@/types';

import { generateGroup as externalGenerateGroup } from './trainingUtils';

export function computeSessionCharWeights(
  settings: Pick<TrainingSettings, 'errorWeightStrength'>,
  historicalSessions: readonly SessionResult[],
): Record<string, number> | undefined {
  const strength = settings.errorWeightStrength ?? 0;
  if (strength <= 0 || historicalSessions.length === 0) {
    return undefined;
  }

  const aggregate: Record<string, { correct: number; total: number }> = {};
  historicalSessions.forEach((session) => {
    Object.entries(session.letterAccuracy).forEach(([character, stats]) => {
      const entry = aggregate[character];
      if (entry) {
        entry.correct += stats.correct;
        entry.total += stats.total;
        return;
      }
      aggregate[character] = { correct: stats.correct, total: stats.total };
    });
  });

  const weights: Record<string, number> = {};
  Object.entries(aggregate).forEach(([character, stats]) => {
    if (stats.total <= 0) {
      return;
    }
    const errorRate = 1 - stats.correct / stats.total;
    weights[character] = 1 + errorRate * strength;
  });

  return Object.keys(weights).length > 0 ? weights : undefined;
}

export function generateTrainingGroup(
  settings: TrainingSettings,
  historicalSessions: readonly SessionResult[],
): string {
  const { customSet, customSequence, ...rest } = settings;
  const charWeights = computeSessionCharWeights(settings, historicalSessions);

  return externalGenerateGroup(
    {
      kochLevel: rest.kochLevel,
      minGroupSize: rest.minGroupSize,
      maxGroupSize: rest.maxGroupSize,
      charSetMode: rest.charSetMode ?? 'koch',
      ...(rest.digitsLevel !== undefined ? { digitsLevel: rest.digitsLevel } : {}),
      ...(rest.charSetMode === 'mixed'
        ? { mixedLettersPercent: rest.mixedLettersPercent ?? 70 }
        : {}),
      ...(customSet && customSet.length > 0 ? { customSet: [...customSet] } : {}),
      ...(customSequence && customSequence.length > 0
        ? { customSequence: [...customSequence] }
        : {}),
      ...(rest.slidingWindowStart !== undefined
        ? { slidingWindowStart: rest.slidingWindowStart }
        : {}),
      ...(rest.slidingWindowEnd !== undefined
        ? { slidingWindowEnd: rest.slidingWindowEnd }
        : {}),
    },
    charWeights,
  );
}
