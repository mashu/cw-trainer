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
  readonly groupsPerLevel?: number;
  readonly startFallMs?: number;
  readonly minFallMs?: number;
  readonly levelSpeedupMs?: number;
  readonly groupSpeedupMs?: number;
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

export function computeChaseFallMs({
  level,
  targetIndex,
  groupsPerLevel,
  startFallMs,
  minFallMs,
  levelSpeedupMs,
  groupSpeedupMs,
}: ChaseTargetTimingInput): number {
  const safeLevel = Math.max(1, Math.floor(level));
  const safeTargetIndex = Math.max(0, Math.floor(targetIndex));
  const safeGroupsPerLevel = Math.max(1, Math.floor(groupsPerLevel ?? CHASE_GROUPS_PER_LEVEL));
  const safeStartFallMs = Math.max(500, startFallMs ?? CHASE_BASE_FALL_MS);
  const safeMinFallMs = Math.max(500, Math.min(safeStartFallMs, minFallMs ?? CHASE_MIN_FALL_MS));
  const safeLevelSpeedupMs = Math.max(0, levelSpeedupMs ?? 430);
  const safeGroupSpeedupMs = Math.max(0, groupSpeedupMs ?? 28);
  const levelPressure = (safeLevel - 1) * safeLevelSpeedupMs;
  const endurancePressure = safeTargetIndex * safeGroupSpeedupMs;
  const wavePressure = Math.floor(safeTargetIndex / safeGroupsPerLevel) * safeGroupSpeedupMs;
  return Math.max(
    safeMinFallMs,
    safeStartFallMs - levelPressure - endurancePressure - wavePressure,
  );
}

export function computeChaseLevelSettings(
  settings: TrainingSettings,
  level: number,
): TrainingSettings {
  const levelOffset = settings.chaseAutoLevelEnabled ? Math.max(0, Math.floor(level) - 1) : 0;
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

export function computeChaseLevelProgress(
  correctInLevel: number,
  groupsPerLevel: number = CHASE_GROUPS_PER_LEVEL,
): number {
  return Math.max(0, Math.min(1, correctInLevel / Math.max(1, groupsPerLevel)));
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
  const lengthBonus = normalizedExpected.length * 80;
  const scoreDelta = input.level * 100 + lengthBonus + speedBonus * 10 + streakBonus;

  return {
    lives: input.lives,
    score: input.score + scoreDelta,
    streak: nextStreak,
    scoreDelta,
    correct: true,
  };
}
