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
}

export type StoreSetter<TState> = (
  partial: Partial<TState> | ((state: TState) => Partial<TState>),
  replace?: boolean,
) => void;

export type StoreGetter<TState> = () => TState;
