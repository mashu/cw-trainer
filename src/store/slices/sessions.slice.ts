import { ensureAppError } from '@/lib/errors';
import type { SessionService } from '@/lib/services/session.service';
import type { SessionResultInput } from '@/lib/validators';
import type { SessionResult } from '@/types';

import type { AsyncStatus, StoreContextValue, StoreSetter } from '../types';

export interface SessionsSlice {
  sessions: SessionResult[];
  sessionsStatus: AsyncStatus;
  sessionsError?: string;
  sessionsSyncing: boolean;
  lastSessionsUpdatedAt?: number;
  loadSessions: () => Promise<SessionResult[]>;
  saveSession: (input: SessionResultInput) => Promise<SessionResult[]>;
  replaceSessions: (inputs: readonly SessionResultInput[]) => Promise<SessionResult[]>;
  removeSessionByTimestamp: (timestamp: number) => Promise<SessionResult[]>;
  syncPendingSessions: () => Promise<SessionResult[]>;
}

interface CreateSessionsSliceParams {
  set: StoreSetter<SessionsSlice>;
  getContext: () => StoreContextValue;
  service: SessionService;
}

const mapErrorMessage = (error: unknown): string => {
  const appError = ensureAppError(error);
  return appError.expose ? appError.message : 'Unable to process session request.';
};

const applySuccessState = (set: StoreSetter<SessionsSlice>, sessions: SessionResult[]): void => {
  set({
    sessions,
    sessionsStatus: 'ready',
    sessionsSyncing: false,
    lastSessionsUpdatedAt: Date.now(),
  });
};

export const createSessionsSlice = ({
  set,
  getContext,
  service,
}: CreateSessionsSliceParams): SessionsSlice => ({
  sessions: [],
  sessionsStatus: 'idle',
  sessionsSyncing: false,

  loadSessions: async (): Promise<SessionResult[]> => {
    set({ sessionsStatus: 'loading' });

    try {
      const context = getContext();
      const sessions = await service.listSessions(context);
      applySuccessState(set, sessions);
      return sessions;
    } catch (error) {
      set({
        sessionsStatus: 'error',
        sessionsError: mapErrorMessage(error),
      });
      throw ensureAppError(error);
    }
  },

  saveSession: async (input: SessionResultInput): Promise<SessionResult[]> => {
    set({ sessionsSyncing: true });

    try {
      const context = getContext();
      const sessions = await service.upsertSession(context, input);
      applySuccessState(set, sessions);
      return sessions;
    } catch (error) {
      set({
        sessionsSyncing: false,
        sessionsError: mapErrorMessage(error),
      });
      throw ensureAppError(error);
    }
  },

  replaceSessions: async (inputs: readonly SessionResultInput[]): Promise<SessionResult[]> => {
    set({ sessionsSyncing: true });

    try {
      const context = getContext();
      const sessions = await service.replaceAll(context, inputs);
      applySuccessState(set, sessions);
      return sessions;
    } catch (error) {
      set({
        sessionsSyncing: false,
        sessionsError: mapErrorMessage(error),
      });
      throw ensureAppError(error);
    }
  },

  removeSessionByTimestamp: async (timestamp: number): Promise<SessionResult[]> => {
    set({ sessionsSyncing: true });

    try {
      const context = getContext();
      const sessions = await service.deleteSession(context, timestamp);
      applySuccessState(set, sessions);
      return sessions;
    } catch (error) {
      set({
        sessionsSyncing: false,
        sessionsError: mapErrorMessage(error),
      });
      throw ensureAppError(error);
    }
  },

  syncPendingSessions: async (): Promise<SessionResult[]> => {
    set({ sessionsSyncing: true });

    try {
      const context = getContext();
      const sessions = await service.syncPending(context);
      applySuccessState(set, sessions);
      return sessions;
    } catch (error) {
      set({
        sessionsSyncing: false,
        sessionsError: mapErrorMessage(error),
      });
      throw ensureAppError(error);
    }
  },
});
