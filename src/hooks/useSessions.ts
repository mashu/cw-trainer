'use client';

import { useCallback } from 'react';

import type { SessionResultInput } from '@/lib/validators';
import { useAppStore } from '@/store';
import type { AsyncStatus } from '@/store';
import type { SessionResult } from '@/types';

export interface UseSessionsStateResult {
  readonly sessions: SessionResult[];
  readonly sessionsStatus: AsyncStatus;
  readonly sessionsError?: string;
  readonly sessionsSyncing: boolean;
  readonly lastSessionsUpdatedAt?: number;
}

export const useSessionsState = (): UseSessionsStateResult =>
  useAppStore((state) => ({
    sessions: state.sessions,
    sessionsStatus: state.sessionsStatus,
    sessionsError: state.sessionsError,
    sessionsSyncing: state.sessionsSyncing,
    lastSessionsUpdatedAt: state.lastSessionsUpdatedAt,
  }));

export const useSessionsActions = (): {
  loadSessions: () => Promise<SessionResult[]>;
  saveSession: (input: SessionResultInput) => Promise<SessionResult[]>;
  replaceSessions: (inputs: readonly SessionResultInput[]) => Promise<SessionResult[]>;
  removeSessionByTimestamp: (timestamp: number) => Promise<SessionResult[]>;
  syncPendingSessions: () => Promise<SessionResult[]>;
} => {
  const load = useAppStore((state) => state.loadSessions);
  const save = useAppStore((state) => state.saveSession);
  const replace = useAppStore((state) => state.replaceSessions);
  const remove = useAppStore((state) => state.removeSessionByTimestamp);
  const sync = useAppStore((state) => state.syncPendingSessions);

  return {
    loadSessions: useCallback(() => load(), [load]),
    saveSession: useCallback((input: SessionResultInput) => save(input), [save]),
    replaceSessions: useCallback(
      (inputs: readonly SessionResultInput[]) => replace(inputs),
      [replace],
    ),
    removeSessionByTimestamp: useCallback((timestamp: number) => remove(timestamp), [remove]),
    syncPendingSessions: useCallback(() => sync(), [sync]),
  };
};
