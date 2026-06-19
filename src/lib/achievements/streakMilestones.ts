import type { AchievementId } from './types';

export type StreakMilestoneId = Extract<
  AchievementId,
  | 'three-day-streak'
  | 'seven-day-streak'
  | 'regular'
  | 'three-week-streak'
  | 'monthly-operator'
  | 'steadfast'
  | 'iron-routine'
  | 'quarter-year'
  | 'half-year'
  | 'full-year'
>;

export const STREAK_MILESTONES: ReadonlyArray<{
  readonly id: StreakMilestoneId;
  readonly days: number;
}> = [
  { id: 'three-day-streak', days: 3 },
  { id: 'seven-day-streak', days: 7 },
  { id: 'regular', days: 14 },
  { id: 'three-week-streak', days: 21 },
  { id: 'monthly-operator', days: 30 },
  { id: 'steadfast', days: 45 },
  { id: 'iron-routine', days: 60 },
  { id: 'quarter-year', days: 90 },
  { id: 'half-year', days: 180 },
  { id: 'full-year', days: 365 },
] as const;
