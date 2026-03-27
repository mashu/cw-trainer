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
   * True while a group training session is active. Stored in the store so it survives remounts.
   * If the component tree remounts, we show "Session interrupted" instead of the main page.
   */
  trainingSessionActive: boolean;
  setTrainingSessionActive: (active: boolean) => void;
}

export type StoreSetter<TState> = (
  partial: Partial<TState> | ((state: TState) => Partial<TState>),
  replace?: boolean,
) => void;

export type StoreGetter<TState> = () => TState;
