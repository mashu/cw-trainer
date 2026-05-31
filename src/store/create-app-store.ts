import { createStore, type StoreApi } from 'zustand/vanilla';

import type { AchievementService } from '@/lib/services/achievement.service';
import type { IcrSessionService } from '@/lib/services/icr-session.service';
import type { SessionService } from '@/lib/services/session.service';
import type { TrainingSettingsService } from '@/lib/services/training-settings.service';

import { contextEquals } from './context-utils';
import { selectTrainingSessionActive } from './selectors';
import { createAchievementsSlice, type AchievementsSlice } from './slices/achievements.slice';
import { createIcrSessionsSlice, type IcrSessionsSlice } from './slices/icr-sessions.slice';
import { createSessionsSlice, type SessionsSlice } from './slices/sessions.slice';
import {
  createTrainingRuntimeSlice,
  type TrainingRuntimeSlice,
} from './slices/training-runtime.slice';
import {
  createTrainingSettingsSlice,
  type TrainingSettingsSlice,
} from './slices/training-settings.slice';
import type { ContextSlice, StoreContextValue } from './types';

export type AppStore = TrainingRuntimeSlice &
  TrainingSettingsSlice &
  SessionsSlice &
  AchievementsSlice &
  IcrSessionsSlice &
  ContextSlice;

export interface CreateAppStoreOptions {
  readonly context: StoreContextValue;
  readonly sessionService: SessionService;
  readonly achievementService: AchievementService;
  readonly trainingSettingsService: TrainingSettingsService;
  readonly icrSessionService: IcrSessionService;
}

export const createAppStore = ({
  context,
  sessionService,
  achievementService,
  trainingSettingsService,
  icrSessionService,
}: CreateAppStoreOptions): StoreApi<AppStore> =>
  createStore<AppStore>((set, get) => {
    const contextSlice: ContextSlice = {
      context,
      lastSyncCompletedAt: undefined,
      setLastSyncCompletedAt: (t: number) => set({ lastSyncCompletedAt: t }),
      trainingSessionLockCount: 0,
      trainingSessionActive: false,
      acquireTrainingSessionLock: (): void => {
        set((s) => {
          const trainingSessionLockCount = s.trainingSessionLockCount + 1;
          return { trainingSessionLockCount, trainingSessionActive: true };
        });
      },
      releaseTrainingSessionLock: (): void => {
        set((s) => {
          const trainingSessionLockCount = Math.max(0, s.trainingSessionLockCount - 1);
          return {
            trainingSessionLockCount,
            trainingSessionActive: trainingSessionLockCount > 0,
          };
        });
      },
      resetTrainingSessionLocks: (): void =>
        set({ trainingSessionLockCount: 0, trainingSessionActive: false }),

      setContext: (nextContext: StoreContextValue) => {
        const previousContext = get().context;
        // Skip no-op updates to avoid redundant store subscriptions and triggerLoads
        if (contextEquals(previousContext, nextContext)) {
          return;
        }
        set({ context: nextContext });
        // All post-context-change loads (including after login) are handled by the provider's triggerLoads().
      },
    };

    const trainingRuntimeSlice = createTrainingRuntimeSlice({
      set: (partial, replace) => set(partial as Partial<AppStore>, replace),
    });

    const isTrainingSessionActive = (): boolean => selectTrainingSessionActive(get());

    const trainingSettingsSlice = createTrainingSettingsSlice({
      service: trainingSettingsService,
      getContext: () => get().context,
      get: () => ({
        trainingSettings: get().trainingSettings,
        trainingSettingsStatus: get().trainingSettingsStatus,
      }),
      isTrainingSessionActive,
      set: (partial, replace) => set(partial as Partial<AppStore>, replace),
    });

    const sessionsSlice = createSessionsSlice({
      service: sessionService,
      getContext: () => get().context,
      get: () => ({ sessions: get().sessions, sessionsStatus: get().sessionsStatus }),
      isTrainingSessionActive,
      set: (partial, replace) => set(partial as Partial<AppStore>, replace),
    });

    const achievementsSlice = createAchievementsSlice({
      service: achievementService,
      getContext: () => get().context,
      get: () => ({
        achievements: get().achievements,
        achievementsStatus: get().achievementsStatus,
        trainingSettings: get().trainingSettings,
      }),
      set: (partial, replace) => set(partial as Partial<AppStore>, replace),
    });

    const icrSessionsSlice = createIcrSessionsSlice({
      service: icrSessionService,
      get: () => ({ icrSessions: get().icrSessions, icrSessionsStatus: get().icrSessionsStatus }),
      isTrainingSessionActive,
      set: (partial, replace) => set(partial as Partial<AppStore>, replace),
    });

    return {
      ...contextSlice,
      ...trainingRuntimeSlice,
      ...trainingSettingsSlice,
      ...sessionsSlice,
      ...achievementsSlice,
      ...icrSessionsSlice,
    };
  });
