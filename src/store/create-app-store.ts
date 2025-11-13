import { createStore, type StoreApi } from 'zustand/vanilla';

import type { IcrSessionService } from '@/lib/services/icr-session.service';
import type { SessionService } from '@/lib/services/session.service';
import type { TrainingSettingsService } from '@/lib/services/training-settings.service';

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
      setContext: (nextContext: StoreContextValue) => {
        const previousContext = get().context;
        const previousUser = previousContext.user;
        const nextUser = nextContext.user;
        
        // Event-driven: detect user authentication transition
        const userAuthenticated = !previousUser && nextUser;
        
        set({ context: nextContext });
        
        // Event-driven: load sessions when user authenticates
        if (userAuthenticated) {
          // Use setTimeout to avoid calling during state update
          setTimeout(() => {
            const state = get();
            void state.loadSessions().catch(() => undefined);
          }, 0);
        }
      },
    };

    const trainingSettingsSlice = createTrainingSettingsSlice({
      service: trainingSettingsService,
      getContext: () => get().context,
      set: (partial, replace) => set(partial as Partial<AppStore>, replace),
    });

    const sessionsSlice = createSessionsSlice({
      service: sessionService,
      getContext: () => get().context,
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
