import { createStore, type StoreApi } from 'zustand/vanilla';

import type { IcrSessionService } from '@/lib/services/icr-session.service';
import type { SessionService } from '@/lib/services/session.service';
import type { TrainingSettingsService } from '@/lib/services/training-settings.service';

import { contextEquals } from './context-utils';
import { createIcrSessionsSlice, type IcrSessionsSlice } from './slices/icr-sessions.slice';
import { createSessionsSlice, type SessionsSlice } from './slices/sessions.slice';
import {
  createTrainingSettingsSlice,
  type TrainingSettingsSlice,
} from './slices/training-settings.slice';
import type { ContextSlice, StoreContextValue } from './types';

export type AppStore = TrainingSettingsSlice & SessionsSlice & IcrSessionsSlice & ContextSlice;

export interface CreateAppStoreOptions {
  readonly context: StoreContextValue;
  readonly sessionService: SessionService;
  readonly trainingSettingsService: TrainingSettingsService;
  readonly icrSessionService: IcrSessionService;
}

export const createAppStore = ({
  context,
  sessionService,
  trainingSettingsService,
  icrSessionService,
}: CreateAppStoreOptions): StoreApi<AppStore> =>
  createStore<AppStore>((set, get) => {
    const contextSlice: ContextSlice = {
      context,
      lastSyncCompletedAt: undefined,
      setLastSyncCompletedAt: (t: number) => set({ lastSyncCompletedAt: t }),
      trainingSessionActive: false,
      setTrainingSessionActive: (active: boolean) => set({ trainingSessionActive: active }),

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

    const trainingSettingsSlice = createTrainingSettingsSlice({
      service: trainingSettingsService,
      getContext: () => get().context,
      get: () => ({
        trainingSettings: get().trainingSettings,
        trainingSettingsStatus: get().trainingSettingsStatus,
      }),
      set: (partial, replace) => set(partial as Partial<AppStore>, replace),
    });

    const sessionsSlice = createSessionsSlice({
      service: sessionService,
      getContext: () => get().context,
      get: () => ({ sessions: get().sessions, sessionsStatus: get().sessionsStatus }),
      set: (partial, replace) => set(partial as Partial<AppStore>, replace),
    });

    const icrSessionsSlice = createIcrSessionsSlice({
      service: icrSessionService,
      set: (partial, replace) => set(partial as Partial<AppStore>, replace),
    });

    return {
      ...contextSlice,
      ...trainingSettingsSlice,
      ...sessionsSlice,
      ...icrSessionsSlice,
    };
  });
