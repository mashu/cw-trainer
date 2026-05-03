import type { FirebaseServicesLite } from '@/lib/sessionPersistence';
import type { AppUser } from '@/types';

export type AsyncStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface StoreContextValue {
  readonly firebase?: FirebaseServicesLite;
  readonly user: AppUser | null;
}

export interface ContextSlice {
  context: StoreContextValue;
  setContext: (context: StoreContextValue) => void;
  /** Set when a background sync (settings/sessions) completes; used to show "Synced" toast. */
  lastSyncCompletedAt: number | undefined;
  setLastSyncCompletedAt: (t: number) => void;
  /**
   * True while `trainingSessionLockCount > 0` — any feature may acquire a lock (group, echo, ICR,
   * text player, letter preview). Refcounted so one UI cannot clear another’s lock by mistake.
   */
  trainingSessionActive: boolean;
  /** Number of active acquireTrainingSessionLock calls not yet released. */
  trainingSessionLockCount: number;
  acquireTrainingSessionLock: () => void;
  releaseTrainingSessionLock: () => void;
  /** Clears all locks — forced interrupt / stale recovery (e.g. CWTrainer guard). */
  resetTrainingSessionLocks: () => void;
}

export type StoreSetter<TState> = (
  partial: Partial<TState> | ((state: TState) => Partial<TState>),
  replace?: boolean,
) => void;

export type StoreGetter<TState> = () => TState;
