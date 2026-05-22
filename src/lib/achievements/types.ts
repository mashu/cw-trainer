import type { SessionResult } from '@/types';

export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export type AchievementRarity = 'common' | 'uncommon' | 'rare' | 'epic';

export type AchievementCategory = 'mastery' | 'performance' | 'consistency' | 'score';

export type AchievementId =
  | 'first-session'
  | 'first-letter'
  | 'first-digit'
  | 'quarter-alphabet'
  | 'half-alphabet'
  | 'three-quarter-alphabet'
  | 'full-alphabet'
  | 'clean-copy'
  | 'ninety-club'
  | 'pressure-copy'
  | 'long-haul'
  | 'three-day-streak'
  | 'seven-day-streak'
  | 'comeback'
  | 'score-1000'
  | 'score-2500'
  | 'score-5000';

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
