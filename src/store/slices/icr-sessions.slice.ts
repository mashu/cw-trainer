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
    icrSessionsError: undefined,
  });
};

export const createIcrSessionsSlice = ({
  set,
  service,
}: CreateIcrSessionsSliceParams): IcrSessionsSlice => ({
  icrSessions: [],
  icrSessionsStatus: 'idle',
  icrSessionsError: undefined,
  icrSessionsSaving: false,

  loadIcrSessions: async (): Promise<IcrSessionResult[]> => {
    set({ icrSessionsStatus: 'loading', icrSessionsError: undefined });

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
    set({ icrSessionsSaving: true, icrSessionsError: undefined });

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
    set({ icrSessionsSaving: true, icrSessionsError: undefined });

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
});


