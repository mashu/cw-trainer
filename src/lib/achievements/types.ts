import type { SessionResult } from '@/types';

export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

export type AchievementRarity = 'common' | 'uncommon' | 'rare' | 'epic';

export type AchievementCategory = 'mastery' | 'performance' | 'consistency' | 'score';

export type AchievementId =
  | 'first-session'
  | 'getting-warm'
  | 'first-letter'
  | 'first-digit'
  | 'number-pad'
  | 'full-keypad'
  | 'quarter-alphabet'
  | 'half-alphabet'
  | 'three-quarter-alphabet'
  | 'full-alphabet'
  | 'clean-copy'
  | 'flawless-run'
  | 'ninety-club'
  | 'pressure-copy'
  | 'lightning-copy'
  | 'long-haul'
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
  | 'daily-operator'
  | 'comeback'
  | 'score-1000'
  | 'score-2500'
  | 'score-5000'
  | 'megawatt'
  | 'koch-graduate'
  | 'solid-copy-5wpm'
  | 'solid-copy-13wpm'
  | 'solid-copy-20wpm';

export type AchievementBadgeDefinition = {
  readonly id: AchievementId;
  readonly title: string;
  readonly description: string;
  readonly criteria: string;
  readonly tier: AchievementTier;
  readonly rarity: AchievementRarity;
  readonly category: AchievementCategory;
};

export type UnlockedAchievement = {
  readonly id: AchievementId;
  readonly unlockedAt: number;
  readonly sourceSessionTimestamp?: number | undefined;
};

export type AchievementProgress = {
  readonly masteredLetters: readonly string[];
  readonly masteredDigits: readonly string[];
  readonly masteredLetterCount: number;
  readonly masteredDigitCount: number;
  readonly totalLetterCount: number;
  readonly totalDigitCount: number;
  readonly bestScore: number;
  readonly bestAccuracy: number;
  readonly practiceDays: number;
  readonly currentStreakDays: number;
  readonly longestStreakDays: number;
};

export type AchievementEvaluationResult = {
  readonly unlocked: readonly UnlockedAchievement[];
  readonly newlyUnlocked: readonly UnlockedAchievement[];
  readonly progress: AchievementProgress;
};

export type AchievementRuleContext = {
  readonly sessions: readonly SessionResult[];
  readonly progress: AchievementProgress;
};
