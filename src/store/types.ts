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
   * True while `trainingSessionLockCount > 0` — ICR, text player, or letter preview holds a lock.
   * Refcounted so one UI cannot clear another’s lock by mistake.
   *
   * Group, echo, and chase blocking state is derived from their runtime machines.
   * For the combined "is any training active" flag, use `selectTrainingSessionActive` /
   * `useTrainingSessionActive`, never this field directly.
   */
  trainingSessionActive: boolean;
  /** Number of active acquireTrainingSessionLock calls not yet released (non-group features). */
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
