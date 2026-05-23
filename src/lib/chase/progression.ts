import { MAX_DIGITS_LEVEL, MAX_KOCH_LEVEL_GUESS } from '@/lib/constants';
import type { TrainingSettings } from '@/types';

export const CHASE_STARTING_LIVES = 3;
export const CHASE_GROUPS_PER_LEVEL = 5;
export const CHASE_BASE_FALL_MS = 7200;
export const CHASE_MIN_FALL_MS = 1800;

export type ChaseResolveOutcome = 'correct' | 'wrong' | 'missed';

export interface ChaseTargetTimingInput {
  readonly level: number;
  readonly targetIndex: number;
}

export interface ChaseResolveInput {
  readonly expected: string;
  readonly received: string;
  readonly outcome: ChaseResolveOutcome;
  readonly level: number;
  readonly lives: number;
  readonly score: number;
  readonly streak: number;
  readonly remainingMs: number;
}

export interface ChaseResolveResult {
  readonly lives: number;
  readonly score: number;
  readonly streak: number;
  readonly scoreDelta: number;
  readonly correct: boolean;
}

export function computeChaseFallMs({ level, targetIndex }: ChaseTargetTimingInput): number {
  const safeLevel = Math.max(1, Math.floor(level));
  const safeTargetIndex = Math.max(0, Math.floor(targetIndex));
  const levelPressure = (safeLevel - 1) * 430;
  const endurancePressure = Math.floor(safeTargetIndex / CHASE_GROUPS_PER_LEVEL) * 140;
  return Math.max(CHASE_MIN_FALL_MS, CHASE_BASE_FALL_MS - levelPressure - endurancePressure);
}

export function computeChaseLevelSettings(
  settings: TrainingSettings,
  level: number,
): TrainingSettings {
  const levelOffset = Math.max(0, Math.floor(level) - 1);
  const charSetMode = settings.charSetMode ?? 'koch';

  if (charSetMode === 'digits') {
    return {
      ...settings,
      digitsLevel: Math.min(MAX_DIGITS_LEVEL, settings.digitsLevel + levelOffset),
    };
  }

  if (charSetMode === 'mixed') {
    return {
      ...settings,
      kochLevel: Math.min(MAX_KOCH_LEVEL_GUESS, settings.kochLevel + levelOffset),
      digitsLevel: Math.min(MAX_DIGITS_LEVEL, settings.digitsLevel + levelOffset),
    };
  }

  if (charSetMode === 'custom') {
    return settings;
  }

  return {
    ...settings,
    kochLevel: Math.min(MAX_KOCH_LEVEL_GUESS, settings.kochLevel + levelOffset),
  };
}

export function computeChaseLevelProgress(correctInLevel: number): number {
  return Math.max(0, Math.min(1, correctInLevel / CHASE_GROUPS_PER_LEVEL));
}

export function resolveChaseTarget(input: ChaseResolveInput): ChaseResolveResult {
  const normalizedExpected = input.expected.trim().toUpperCase();
  const normalizedReceived = input.received.trim().toUpperCase();
  const correct = input.outcome === 'correct' && normalizedExpected === normalizedReceived;

  if (!correct) {
    return {
      lives: Math.max(0, input.lives - 1),
      score: input.score,
      streak: 0,
      scoreDelta: 0,
      correct: false,
    };
  }

  const nextStreak = input.streak + 1;
  const speedBonus = Math.max(0, Math.round(input.remainingMs / 100));
  const streakBonus = Math.min(500, nextStreak * 25);
  const scoreDelta = input.level * 100 + speedBonus * 10 + streakBonus;

  return {
    lives: input.lives,
    score: input.score + scoreDelta,
    streak: nextStreak,
    scoreDelta,
    correct: true,
  };
}
