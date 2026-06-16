import {
  charSamplingConfigFromSettings,
  createInitialSamplingState,
  sampleTrainingGroup,
  type CharSamplingState,
} from '@/lib/training/charSampling';
import { computeCharPool, type TrainingSettingsLite } from '@/lib/trainingUtils';
import type { SessionResult, TrainingSettings } from '@/types';

export type GenerateTrainingGroupResult = {
  readonly group: string;
  readonly state: CharSamplingState;
};

function toPoolSettings(settings: TrainingSettings): TrainingSettingsLite {
  const { customSet, customSequence, ...rest } = settings;
  return {
    kochLevel: rest.kochLevel,
    minGroupSize: rest.minGroupSize,
    maxGroupSize: rest.maxGroupSize,
    charSetMode: rest.charSetMode ?? 'koch',
    ...(rest.digitsLevel !== undefined ? { digitsLevel: rest.digitsLevel } : {}),
    ...(rest.charSetMode === 'mixed'
      ? { mixedLettersPercent: rest.mixedLettersPercent ?? 70 }
      : {}),
    ...(customSet.length > 0 ? { customSet: [...customSet] } : {}),
    ...(customSequence && customSequence.length > 0
      ? { customSequence: [...customSequence] }
      : {}),
    ...(rest.slidingWindowStart !== undefined
      ? { slidingWindowStart: rest.slidingWindowStart }
      : {}),
    ...(rest.slidingWindowEnd !== undefined
      ? { slidingWindowEnd: rest.slidingWindowEnd }
      : {}),
  };
}

function randomGroupSize(settings: Pick<TrainingSettings, 'minGroupSize' | 'maxGroupSize'>): number {
  const span = settings.maxGroupSize - settings.minGroupSize + 1;
  return Math.floor(Math.random() * span) + settings.minGroupSize;
}

/**
 * @deprecated Use {@link buildCharSamplingSnapshot} weights instead. Kept for transitional tests.
 */
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
  samplingState?: CharSamplingState,
): GenerateTrainingGroupResult {
  const state = samplingState ?? createInitialSamplingState(historicalSessions);
  const pool = computeCharPool(toPoolSettings(settings));
  const groupSize = randomGroupSize(settings);
  const config = charSamplingConfigFromSettings(settings);

  return sampleTrainingGroup(pool, groupSize, state, config);
}

export { createInitialSamplingState, updateSamplingStateFromAnswer } from '@/lib/training/charSampling';
export type { CharSamplingState } from '@/lib/training/charSampling';
