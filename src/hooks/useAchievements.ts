import { useCallback, useMemo } from 'react';

import { calculateAchievementProgress } from '@/lib/achievements';
import type {
  AchievementEvaluationResult,
  AchievementProgress,
  PublicAchievementProfile,
  UnlockedAchievement,
} from '@/lib/achievements';
import { useAppStore } from '@/store';
import type { AsyncStatus } from '@/store';
import type { SessionResult } from '@/types';

export interface UseAchievementsStateResult {
  readonly achievements: UnlockedAchievement[];
  readonly latestUnlockedAchievements: UnlockedAchievement[];
  readonly achievementsStatus: AsyncStatus;
  readonly achievementsError?: string;
  readonly achievementsSyncing: boolean;
  readonly progress: AchievementProgress;
}

export const useAchievementsState = (
  sessions: readonly SessionResult[] = [],
): UseAchievementsStateResult => {
  const state = useAppStore((store) => ({
    achievements: store.achievements,
    latestUnlockedAchievements: store.latestUnlockedAchievements,
    achievementsStatus: store.achievementsStatus,
    achievementsSyncing: store.achievementsSyncing,
    ...(store.achievementsError !== undefined
      ? { achievementsError: store.achievementsError }
      : {}),
  }));
  const progress = useMemo(() => calculateAchievementProgress(sessions), [sessions]);

  return { ...state, progress };
};

export const useAchievementsActions = (): {
  readonly loadAchievements: () => Promise<UnlockedAchievement[]>;
  readonly evaluateAchievementsForSessions: (
    sessions: readonly SessionResult[],
  ) => Promise<AchievementEvaluationResult>;
  readonly clearLatestUnlockedAchievements: () => void;
  readonly publishAchievementProfile: (
    sessions: readonly SessionResult[],
  ) => Promise<PublicAchievementProfile | null>;
} => {
  const load = useAppStore((state) => state.loadAchievements);
  const evaluate = useAppStore((state) => state.evaluateAchievementsForSessions);
  const clearLatest = useAppStore((state) => state.clearLatestUnlockedAchievements);
  const publishProfile = useAppStore((state) => state.publishAchievementProfile);

  return {
    loadAchievements: useCallback(() => load(), [load]),
    evaluateAchievementsForSessions: useCallback((sessions) => evaluate(sessions), [evaluate]),
    clearLatestUnlockedAchievements: useCallback(() => clearLatest(), [clearLatest]),
    publishAchievementProfile: useCallback((sessions) => publishProfile(sessions), [publishProfile]),
  };
};
