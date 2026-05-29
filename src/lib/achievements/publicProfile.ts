import { ACHIEVEMENT_BADGE_BY_ID } from './badges';
import type { AchievementProgress, UnlockedAchievement } from './types';

export type PublicAchievementBadge = {
  readonly id: string;
  readonly title: string;
  readonly tier: string;
  readonly rarity: string;
  readonly unlockedAt: number;
};

export type PublicProfileWpm = {
  readonly charWpmMin: number;
  readonly charWpmMax: number;
  readonly effectiveWpmMin: number;
  readonly effectiveWpmMax: number;
};

export type PublicAchievementProfile = {
  readonly publicId: number;
  readonly callSign?: string | undefined;
  readonly badgeCount: number;
  readonly featuredBadges: readonly PublicAchievementBadge[];
  readonly bestScore: number;
  readonly bestAccuracy: number;
  readonly masteredCharacterCount: number;
  readonly totalKnownCharacterCount: number;
  readonly practiceDays: number;
  readonly charWpmMin?: number;
  readonly charWpmMax?: number;
  readonly effectiveWpmMin?: number;
  readonly effectiveWpmMax?: number;
  readonly updatedAt: number;
  readonly shareEnabled: boolean;
};

export const buildPublicAchievementProfile = ({
  publicId,
  callSign,
  unlocked,
  progress,
  wpm,
  now = Date.now(),
  shareEnabled = true,
}: {
  readonly publicId: number;
  readonly callSign?: string;
  readonly unlocked: readonly UnlockedAchievement[];
  readonly progress: AchievementProgress;
  readonly wpm?: PublicProfileWpm;
  readonly now?: number;
  readonly shareEnabled?: boolean;
}): PublicAchievementProfile => {
  const featuredBadges = [...unlocked]
    .sort((a, b) => b.unlockedAt - a.unlockedAt)
    .flatMap((achievement) => {
      const badge = ACHIEVEMENT_BADGE_BY_ID[achievement.id];
      if (!badge) {
        return [];
      }
      return [
        {
          id: achievement.id,
          title: badge.title,
          tier: badge.tier,
          rarity: badge.rarity,
          unlockedAt: achievement.unlockedAt,
        },
      ];
    })
    .slice(0, 6);

  return {
    publicId,
    ...(callSign ? { callSign } : {}),
    badgeCount: unlocked.length,
    featuredBadges,
    bestScore: progress.bestScore,
    bestAccuracy: progress.bestAccuracy,
    masteredCharacterCount: progress.masteredLetterCount + progress.masteredDigitCount,
    totalKnownCharacterCount: progress.totalLetterCount + progress.totalDigitCount,
    practiceDays: progress.practiceDays,
    ...(wpm
      ? {
          charWpmMin: wpm.charWpmMin,
          charWpmMax: wpm.charWpmMax,
          effectiveWpmMin: wpm.effectiveWpmMin,
          effectiveWpmMax: wpm.effectiveWpmMax,
        }
      : {}),
    updatedAt: now,
    shareEnabled,
  };
};
