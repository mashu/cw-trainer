import type { StoreContextValue } from './types';

/**
 * Shared context-equality helper. Returns true when both context values are
 * equivalent for triggering loads (user identity and Firebase refs). Used by
 * setContext and the provider subscription to avoid redundant updates and triggerLoads.
 */
export function contextEquals(a: StoreContextValue, b: StoreContextValue): boolean {
  const userSame =
    a.user?.id === b.user?.id && a.user?.email === b.user?.email;
  const firebaseSame =
    a.firebase?.db === b.firebase?.db && a.firebase?.auth === b.firebase?.auth;
  return userSame && firebaseSame;
}
