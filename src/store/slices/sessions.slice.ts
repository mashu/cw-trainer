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
  get: () => Pick<SessionsSlice, 'sessions' | 'sessionsStatus'>;
  getContext: () => StoreContextValue;
  /** When true, loads and bulk mutations must not replace in-memory session lists during training. */
  readonly isTrainingSessionActive: () => boolean;
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
  get,
  getContext,
  isTrainingSessionActive,
  service,
}: CreateSessionsSliceParams): SessionsSlice => ({
  sessions: [],
  sessionsStatus: 'idle',
  sessionsSyncing: false,

  loadSessions: async (): Promise<SessionResult[]> => {
    if (isTrainingSessionActive()) {
      return get().sessions;
    }

    const { sessionsStatus } = get();
    const isBackground = sessionsStatus === 'ready';

    if (!isBackground) {
      set({ sessionsStatus: 'loading' });
    }

    try {
      const context = getContext();
      const sessions = await service.listSessions(context);
      if (isTrainingSessionActive()) {
        if (!isBackground) {
          set({ sessionsStatus: 'ready', sessionsSyncing: false });
        }
        return get().sessions;
      }
      applySuccessState(set, sessions);
      return sessions;
    } catch (error) {
      if (isBackground) {
        // Don't disrupt UI: keep current sessions; sync when Firebase is back
        console.debug('[sessions.slice] Background load failed, keeping current sessions', error);
        return get().sessions;
      }
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
      // Log the error but don't throw - the session was saved locally
      // and will be retried. This prevents the app from crashing or
      // navigating away during training.
      console.warn('[sessions.slice] Save error (session saved locally):', error);
      set({
        sessionsSyncing: false,
        // Don't set error state for temporary save failures - the session is still saved locally
      });
      // Return current sessions from state instead of throwing
      // This ensures the UI doesn't break during training
      return get().sessions;
    }
  },

  replaceSessions: async (inputs: readonly SessionResultInput[]): Promise<SessionResult[]> => {
    if (isTrainingSessionActive()) {
      console.debug('[sessions.slice] replaceSessions skipped (training session active)');
      return get().sessions;
    }

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
    if (isTrainingSessionActive()) {
      console.debug('[sessions.slice] removeSessionByTimestamp skipped (training session active)');
      return get().sessions;
    }

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
    if (isTrainingSessionActive()) {
      console.debug('[sessions.slice] syncPendingSessions skipped (training session active)');
      return get().sessions;
    }

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
