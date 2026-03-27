'use client';

import { useCallback } from 'react';

import { useAppStore } from '@/store';
import type { AsyncStatus } from '@/store';
import type { IcrSessionResult } from '@/types';

export interface UseIcrSessionsState {
  readonly icrSessions: IcrSessionResult[];
  readonly icrSessionsStatus: AsyncStatus;
  readonly icrSessionsError?: string;
  readonly icrSessionsSaving: boolean;
}

export const useIcrSessionsState = (): UseIcrSessionsState =>
  useAppStore((state) => ({
    icrSessions: state.icrSessions,
    icrSessionsStatus: state.icrSessionsStatus,
    icrSessionsSaving: state.icrSessionsSaving,
    ...(state.icrSessionsError !== undefined ? { icrSessionsError: state.icrSessionsError } : {}),
  }));

export const useIcrSessionsActions = (): {
  loadIcrSessions: () => Promise<IcrSessionResult[]>;
  saveIcrSession: (session: IcrSessionResult) => Promise<IcrSessionResult[]>;
  clearIcrSessions: () => Promise<void>;
  deleteIcrSession: (timestamp: number) => Promise<IcrSessionResult[]>;
} => {
  const load = useAppStore((state) => state.loadIcrSessions);
  const save = useAppStore((state) => state.saveIcrSession);
  const clear = useAppStore((state) => state.clearIcrSessions);
  const deleteSession = useAppStore((state) => state.deleteIcrSession);

  return {
    loadIcrSessions: useCallback(() => load(), [load]),
    saveIcrSession: useCallback((session: IcrSessionResult) => save(session), [save]),
    clearIcrSessions: useCallback(() => clear(), [clear]),
    deleteIcrSession: useCallback((timestamp: number) => deleteSession(timestamp), [deleteSession]),
  };
};


