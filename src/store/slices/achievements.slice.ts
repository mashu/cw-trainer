import type {
  AchievementEvaluationResult,
  PublicAchievementProfile,
  UnlockedAchievement,
} from '@/lib/achievements';
import { calculateAchievementProgress } from '@/lib/achievements';
import { ensureAppError } from '@/lib/errors';
import type { AchievementService } from '@/lib/services/achievement.service';
import type { SessionResult } from '@/types';

import type { AsyncStatus, StoreContextValue, StoreSetter } from '../types';

export interface AchievementsSlice {
  achievements: UnlockedAchievement[];
  latestUnlockedAchievements: UnlockedAchievement[];
  achievementsStatus: AsyncStatus;
  achievementsError?: string;
  achievementsSyncing: boolean;
  lastAchievementsUpdatedAt?: number;
  loadAchievements: () => Promise<UnlockedAchievement[]>;
  evaluateAchievementsForSessions: (
    sessions: readonly SessionResult[],
  ) => Promise<AchievementEvaluationResult>;
  clearLatestUnlockedAchievements: () => void;
  publishAchievementProfile: (sessions: readonly SessionResult[]) => Promise<PublicAchievementProfile | null>;
}

interface CreateAchievementsSliceParams {
  set: StoreSetter<AchievementsSlice>;
  get: () => Pick<AchievementsSlice, 'achievements' | 'achievementsStatus'>;
  getContext: () => StoreContextValue;
  service: AchievementService;
}

const mapErrorMessage = (error: unknown): string => {
  const appError = ensureAppError(error);
  return appError.expose ? appError.message : 'Unable to process achievements.';
};

const applySuccessState = (
  set: StoreSetter<AchievementsSlice>,
  achievements: readonly UnlockedAchievement[],
): void => {
  set({
    achievements: [...achievements],
    achievementsStatus: 'ready',
    achievementsSyncing: false,
    lastAchievementsUpdatedAt: Date.now(),
  });
};

export const createAchievementsSlice = ({
  set,
  get,
  getContext,
  service,
}: CreateAchievementsSliceParams): AchievementsSlice => ({
  achievements: [],
  latestUnlockedAchievements: [],
  achievementsStatus: 'idle',
  achievementsSyncing: false,

  loadAchievements: async (): Promise<UnlockedAchievement[]> => {
    const { achievementsStatus } = get();
    const isBackground = achievementsStatus === 'ready';
    if (!isBackground) {
      set({ achievementsStatus: 'loading' });
    }

    try {
      const achievements = await service.listAchievements(getContext());
      applySuccessState(set, achievements);
      return achievements;
    } catch (error) {
      if (isBackground) {
        return get().achievements;
      }
      set({
        achievementsStatus: 'error',
        achievementsError: mapErrorMessage(error),
        achievementsSyncing: false,
      });
      throw ensureAppError(error);
    }
  },

  evaluateAchievementsForSessions: async (
    sessions: readonly SessionResult[],
  ): Promise<AchievementEvaluationResult> => {
    set({ achievementsSyncing: true });
    try {
      const result = await service.evaluateAndSave(getContext(), sessions);
      set({
        achievements: [...result.unlocked],
        latestUnlockedAchievements: [...result.newlyUnlocked],
        achievementsStatus: 'ready',
        achievementsSyncing: false,
        lastAchievementsUpdatedAt: Date.now(),
      });
      return result;
    } catch (error) {
      const fallback = {
        unlocked: get().achievements,
        newlyUnlocked: [],
        progress: calculateAchievementProgress(sessions),
      };
      set({
        achievementsSyncing: false,
        achievementsError: mapErrorMessage(error),
      });
      return fallback;
    }
  },

  clearLatestUnlockedAchievements: (): void => {
    set({ latestUnlockedAchievements: [] });
  },

  publishAchievementProfile: async (
    sessions: readonly SessionResult[],
  ): Promise<PublicAchievementProfile | null> => {
    set({ achievementsSyncing: true });
    try {
      const profile = await service.publishPublicProfile(
        getContext(),
        sessions,
        get().achievements,
      );
      set({ achievementsSyncing: false });
      return profile;
    } catch (error) {
      set({
        achievementsSyncing: false,
        achievementsError: mapErrorMessage(error),
      });
      throw ensureAppError(error);
    }
  },
});
