import { ensureAppError } from '@/lib/errors';
import type { IcrSessionService } from '@/lib/services/icr-session.service';
import type { IcrSessionResult } from '@/types';

import type { AsyncStatus, StoreSetter } from '../types';

export interface IcrSessionsSlice {
  icrSessions: IcrSessionResult[];
  icrSessionsStatus: AsyncStatus;
  icrSessionsError?: string;
  icrSessionsSaving: boolean;
  loadIcrSessions: () => Promise<IcrSessionResult[]>;
  saveIcrSession: (session: IcrSessionResult) => Promise<IcrSessionResult[]>;
  clearIcrSessions: () => Promise<void>;
  deleteIcrSession: (timestamp: number) => Promise<IcrSessionResult[]>;
}

interface CreateIcrSessionsSliceParams {
  set: StoreSetter<IcrSessionsSlice>;
  service: IcrSessionService;
}

const mapErrorMessage = (error: unknown): string => {
  const appError = ensureAppError(error);
  return appError.expose ? appError.message : 'Unable to process ICR session request.';
};

const applySuccessState = (set: StoreSetter<IcrSessionsSlice>, sessions: IcrSessionResult[]): void => {
  set({
    icrSessions: sessions,
    icrSessionsStatus: 'ready',
    icrSessionsSaving: false,
  });
};

export const createIcrSessionsSlice = ({
  set,
  service,
}: CreateIcrSessionsSliceParams): IcrSessionsSlice => ({
  icrSessions: [],
  icrSessionsStatus: 'idle',
  icrSessionsSaving: false,

  loadIcrSessions: async (): Promise<IcrSessionResult[]> => {
    set({ icrSessionsStatus: 'loading' });

    try {
      const sessions = await service.listSessions();
      applySuccessState(set, sessions);
      return sessions;
    } catch (error) {
      set({
        icrSessionsStatus: 'error',
        icrSessionsError: mapErrorMessage(error),
      });
      throw ensureAppError(error);
    }
  },

  saveIcrSession: async (session: IcrSessionResult): Promise<IcrSessionResult[]> => {
    set({ icrSessionsSaving: true });

    try {
      const sessions = await service.saveSession(session);
      applySuccessState(set, sessions);
      return sessions;
    } catch (error) {
      set({
        icrSessionsSaving: false,
        icrSessionsError: mapErrorMessage(error),
      });
      throw ensureAppError(error);
    }
  },

  clearIcrSessions: async (): Promise<void> => {
    set({ icrSessionsSaving: true });

    try {
      await service.clearSessions();
      applySuccessState(set, []);
    } catch (error) {
      set({
        icrSessionsSaving: false,
        icrSessionsError: mapErrorMessage(error),
      });
      throw ensureAppError(error);
    }
  },

  deleteIcrSession: async (timestamp: number): Promise<IcrSessionResult[]> => {
    set({ icrSessionsSaving: true });

    try {
      if (!service.deleteSession) {
        throw new Error('deleteSession method not available on IcrSessionService');
      }
      const sessions = await service.deleteSession(timestamp);
      applySuccessState(set, sessions);
      return sessions;
    } catch (error) {
      set({
        icrSessionsSaving: false,
        icrSessionsError: mapErrorMessage(error),
      });
      throw ensureAppError(error);
    }
  },
});


