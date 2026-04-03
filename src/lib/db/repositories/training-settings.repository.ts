import { deleteField } from '@firebase/firestore';
import { onAuthStateChanged, type User as FirebaseUser, type getAuth } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import type { getFirestore } from 'firebase/firestore';

import { DEFAULT_TRAINING_SETTINGS } from '@/config/training.config';
import type { FirebaseServicesLite } from '@/lib/sessionPersistence';
import {
  normalizeTrainingSettings,
  serializeTrainingSettings,
} from '@/lib/utils/training-settings';
import type { AppUser, TrainingSettings } from '@/types';

export interface TrainingSettingsRepositoryContext {
  readonly firebase?: FirebaseServicesLite;
  readonly user: AppUser | null;
  // Optional function to get fresh context (for waiting for Firebase to become available)
  readonly getContext?: () => TrainingSettingsRepositoryContext;
}

export interface TrainingSettingsRepository {
  load(
    context: TrainingSettingsRepositoryContext,
    fallback: TrainingSettings,
  ): Promise<TrainingSettings>;
  save(context: TrainingSettingsRepositoryContext, settings: TrainingSettings): Promise<void>;
  clear(context: TrainingSettingsRepositoryContext): Promise<void>;
}

const DEFAULT_LOCAL_KEY = 'morse_settings_local';

/**
 * Firestore `setDoc(..., { merge: true })` does not remove omitted fields. When the user clears
 * `customSequence`, we must send `deleteField()` so the cloud document matches local storage.
 */
function buildFirestoreTrainingSettingsPayload(settings: TrainingSettings): Record<string, unknown> {
  const normalized = normalizeTrainingSettings(settings, DEFAULT_TRAINING_SETTINGS);
  const data = JSON.parse(serializeTrainingSettings(normalized)) as Record<string, unknown>;
  const seq = data['customSequence'];
  if (!Array.isArray(seq) || seq.length === 0) {
    data['customSequence'] = deleteField();
  }
  return data;
}

const resolveLocalKey = (user: AppUser | null): string => {
  if (user?.email) {
    return `${DEFAULT_LOCAL_KEY}_${user.email}`;
  }

  return DEFAULT_LOCAL_KEY;
};

const readFromLocalStorage = (key: string): unknown => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeToLocalStorage = (key: string, payload: string): void => {
  if (typeof window === 'undefined') {
    console.debug('[settings] Skipping localStorage write (server-side)');
    return;
  }

  try {
    window.localStorage.setItem(key, payload);
    console.debug('[settings] Successfully saved to localStorage:', key);
  } catch (error) {
    // Log the error but don't throw to avoid blocking UX
    console.warn('[settings] Failed to save to localStorage:', key, error);
  }
};

const removeFromLocalStorage = (key: string): void => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
};

const toFirebaseUser = (
  user: AppUser | null,
): { readonly uid: string; readonly email: string } | null => {
  if (!user) {
    return null;
  }

  return {
    uid: user.id,
    email: user.email,
  };
};

const resolveFirestore = (services?: FirebaseServicesLite): ReturnType<typeof getFirestore> | null => {
  if (!services?.db) {
    return null;
  }

  return services.db;
};

/**
 * Custom error to indicate Firebase is not ready yet
 */
export class FirebaseNotReadyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FirebaseNotReadyError';
  }
}

/**
 * Waits for Firebase auth state to be determined.
 * Returns the current user if authenticated, or null if not authenticated or auth is not configured.
 */
const waitForAuthState = (
  auth: ReturnType<typeof getAuth> | null,
): Promise<{ readonly uid: string; readonly email: string } | null> => {
  if (!auth) {
    return Promise.resolve(null);
  }

  return new Promise<{ readonly uid: string; readonly email: string } | null>((resolve) => {
    // onAuthStateChanged fires immediately with the current user state
    // This allows us to wait for the initial auth state to be determined
    const unsubscribe = onAuthStateChanged(auth, (user: FirebaseUser | null) => {
      unsubscribe();
      if (user && user.uid && user.email) {
        resolve({ uid: user.uid, email: user.email });
      } else {
        resolve(null);
      }
    });
  });
};

/**
 * Waits for Firebase to become available by polling the context getter.
 * This allows us to wait for Firebase to be initialized even if it's not in the context yet.
 */
const waitForFirebaseInContext = async (
  getContext: () => TrainingSettingsRepositoryContext,
  maxWaitMs: number = 5000,
  pollIntervalMs: number = 100,
): Promise<boolean> => {
  const startTime = Date.now();
  
  // Check immediately first
  const initialContext = getContext();
  if (initialContext.firebase?.auth) {
    return true;
  }

  return new Promise<boolean>((resolve) => {
    const checkFirebase = (): void => {
      const context = getContext();
      if (context.firebase?.auth) {
        console.debug('[settings] Firebase became available after', Date.now() - startTime, 'ms');
        resolve(true);
        return;
      }

      if (Date.now() - startTime >= maxWaitMs) {
        console.debug('[settings] Timeout waiting for Firebase after', maxWaitMs, 'ms');
        resolve(false);
        return;
      }

      setTimeout(checkFirebase, pollIntervalMs);
    };

    checkFirebase();
  });
};

// Check if Firebase is expected to be configured (even if not ready yet)
// We detect this by checking if there are user-specific localStorage keys,
// which indicates the app has been used with Firebase before
const isFirebaseExpected = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }
  // Check if there are any user-specific localStorage keys
  // This indicates Firebase was used before and should be configured
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (key && key.startsWith('morse_settings_local_') && key !== 'morse_settings_local') {
      return true; // Found user-specific key, Firebase is expected
    }
  }
  return false;
};

export class FirebaseTrainingSettingsRepository implements TrainingSettingsRepository {
  async load(
    context: TrainingSettingsRepositoryContext,
    fallback: TrainingSettings,
  ): Promise<TrainingSettings> {
    console.debug('[settings] ========== LOAD START ==========');
    console.debug('[settings] Context user:', context.user ? { id: context.user.id, email: context.user.email } : null);
    console.debug('[settings] Context firebase:', context.firebase ? { hasDb: !!context.firebase.db, hasAuth: !!context.firebase.auth } : null);
    console.debug('[settings] Fallback kochLevel:', fallback.kochLevel);
    
    const firestore = resolveFirestore(context.firebase);
    const isFirestoreConfigured = firestore !== null;
    const firebaseExpected = isFirebaseExpected();
    console.debug('[settings] Firestore configured:', isFirestoreConfigured);
    console.debug('[settings] Firebase expected (env vars present):', firebaseExpected);

    // Track whether we attempted Firestore read and whether document exists
    let firestoreAttempted = false;
    let firestoreDocumentExists = false;
    let authenticatedUserEmail: string | null = null;

    // Debug: Check all localStorage keys that might contain settings
    if (typeof window !== 'undefined') {
      const allKeys: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith('morse_settings')) {
          allKeys.push(key);
        }
      }
      console.debug('[settings] All localStorage keys with "morse_settings":', allKeys);
      allKeys.forEach(key => {
        try {
          const value = window.localStorage.getItem(key);
          if (value) {
            const parsed = JSON.parse(value);
            console.debug(`[settings] localStorage["${key}"]:`, { kochLevel: parsed.kochLevel, ...parsed });
          }
        } catch (e) {
          console.debug(`[settings] localStorage["${key}"]: parse error`, e);
        }
      });
    }

    // If Firestore is configured, ALWAYS wait for auth state to be determined before falling back to localStorage
    // This prevents showing local values that will be replaced by Firestore values
    if (isFirestoreConfigured) {
      console.debug('[settings] Firestore is configured, checking auth...');
      // Try to get auth from context first, but if not available, we should still wait
      // (auth might be initializing)
      if (context.firebase?.auth) {
        console.debug('[settings] Auth available in context, waiting for auth state...');
        // Wait for auth state to be determined
        const authenticatedUser = await waitForAuthState(context.firebase.auth);
        authenticatedUserEmail = authenticatedUser?.email ?? null;
        console.debug('[settings] Auth state determined:', authenticatedUser ? { uid: authenticatedUser.uid, email: authenticatedUser.email } : 'no user');
        
        if (authenticatedUser) {
          // Auth state is determined and user is authenticated - try to load from Firestore first
          firestoreAttempted = true;
          console.debug('[settings] Attempting to read from Firestore for user:', authenticatedUser.uid);
          try {
            const ref = doc(firestore, 'users', authenticatedUser.uid, 'settings', 'default');
            const snapshot = await getDoc(ref);
            console.debug('[settings] Firestore snapshot exists:', snapshot.exists());
            if (snapshot.exists()) {
              firestoreDocumentExists = true;
              const data = snapshot.data();
              console.debug('[settings] ===== FIRESTORE DATA =====');
              console.debug('[settings] Raw Firestore data:', JSON.stringify(data, null, 2));
              console.debug('[settings] Firestore kochLevel:', data['kochLevel'], 'type:', typeof data['kochLevel']);
              console.debug('[settings] Fallback kochLevel:', fallback.kochLevel);
              
              // Normalize the Firestore data with fallback
              const normalized = normalizeTrainingSettings(data, fallback);
              console.debug('[settings] ===== NORMALIZED RESULT =====');
              console.debug('[settings] Normalized settings from Firestore:', JSON.stringify(normalized, null, 2));
              console.debug('[settings] Normalized kochLevel:', normalized.kochLevel);
              console.debug('[settings] ============================');
              
              // Update local key based on authenticated user email
              const authLocalKey = authenticatedUser.email
                ? `${DEFAULT_LOCAL_KEY}_${authenticatedUser.email}`
                : DEFAULT_LOCAL_KEY;
              console.debug('[settings] Writing to localStorage with key:', authLocalKey);
              writeToLocalStorage(authLocalKey, serializeTrainingSettings(normalized));
              console.debug('[settings] ========== LOAD END (Firestore) ==========');
              return normalized;
            } else {
              console.debug('[settings] No Firestore document found, will check localStorage');
            }
          } catch (error) {
            console.warn(
              '[settings] Unable to load from Firestore, falling back to local storage.',
              error,
            );
          }
        } else {
          // Auth state is determined but no user is authenticated
          console.debug('[settings] Auth completed but no user authenticated');
        }
        } else {
          // Firestore is configured but auth is not available in context yet
          // Try with context.user if available (might be set synchronously)
          console.debug('[settings] Auth not in context, checking context.user...');
          const firebaseUser = toFirebaseUser(context.user);
          if (firebaseUser) {
            authenticatedUserEmail = firebaseUser.email;
            firestoreAttempted = true;
            console.debug('[settings] context.user available, attempting Firestore read:', { uid: firebaseUser.uid, email: firebaseUser.email });
            try {
              const ref = doc(firestore, 'users', firebaseUser.uid, 'settings', 'default');
              const snapshot = await getDoc(ref);
              console.debug('[settings] Firestore snapshot exists (sync path):', snapshot.exists());
              if (snapshot.exists()) {
                firestoreDocumentExists = true;
                const data = snapshot.data();
                console.debug('[settings] ===== FIRESTORE DATA (sync path) =====');
                console.debug('[settings] Raw Firestore data:', JSON.stringify(data, null, 2));
                console.debug('[settings] Firestore kochLevel:', data['kochLevel']);
                const normalized = normalizeTrainingSettings(data, fallback);
                console.debug('[settings] Normalized kochLevel:', normalized.kochLevel);
                const localKey = resolveLocalKey(context.user);
                console.debug('[settings] Writing to localStorage with key:', localKey);
                writeToLocalStorage(localKey, serializeTrainingSettings(normalized));
                console.debug('[settings] ========== LOAD END (Firestore sync) ==========');
                return normalized;
              } else {
                console.debug('[settings] No Firestore document found, will check localStorage');
              }
            } catch (error) {
              console.warn(
                '[settings] Unable to load from Firestore, falling back to local storage.',
                error,
              );
            }
          } else {
            // Firestore is configured but we don't have auth or user yet
            // Auth is still initializing - check localStorage first (it's always available)
            // If Firebase becomes available later, it will sync
            console.debug('[settings] Firestore configured but auth/user not available yet - checking localStorage first');
            // Continue to localStorage fallback check below
          }
        }
    }

    // Fall back to localStorage if:
    // 1. Firestore is not configured, OR
    // 2. Firestore document doesn't exist (but we tried to read it), OR
    // 3. Firestore read failed (error), OR
    // 4. Auth/user not available yet (Firestore still initializing)
    // IMPORTANT: If we successfully read from Firestore (document exists), we already returned above
    // localStorage is ALWAYS checked as a fallback - it's the source of truth when Firestore isn't available
    console.debug('[settings] ===== LOCALSTORAGE FALLBACK CHECK =====');
    console.debug('[settings] Firestore configured:', isFirestoreConfigured);
    console.debug('[settings] Firestore attempted:', firestoreAttempted);
    console.debug('[settings] Firestore document exists:', firestoreDocumentExists);
    console.debug('[settings] Authenticated user email:', authenticatedUserEmail);
    console.debug('[settings] Context user:', context.user ? { id: context.user.id, email: context.user.email } : null);
    
    // CRITICAL FIX: If Firebase is expected but not yet configured, wait for it to become available
    // BUT: If we have localStorage data, use it immediately and sync to Firestore when it becomes available
    if (firebaseExpected && !isFirestoreConfigured) {
      console.debug('[settings] Firebase expected but not ready yet');
      console.debug('[settings] firebaseExpected:', firebaseExpected, 'isFirestoreConfigured:', isFirestoreConfigured);
      
      // Check localStorage first - if we have data, use it immediately
      const tempLocalKey = resolveLocalKey(context.user);
      const tempLocal = readFromLocalStorage(tempLocalKey);
      if (tempLocal) {
        console.debug('[settings] Found localStorage data while waiting for Firebase, using it now');
        const normalized = normalizeTrainingSettings(tempLocal, fallback);
        console.debug('[settings] ========== LOAD END (localStorage while Firebase initializing) ==========');
        return normalized;
      }
      
      // If we have a getContext function, wait for Firebase to become available
      if (context.getContext) {
        const firebaseReady = await waitForFirebaseInContext(context.getContext, 5000, 100);
        if (firebaseReady) {
          // Get fresh context now that Firebase is available
          const freshContext = context.getContext();
          console.debug('[settings] Firebase became available, retrying with fresh context');
          // Recursively call load with fresh context
          return this.load(freshContext, fallback);
        } else {
          console.debug('[settings] Firebase did not become available within timeout, using localStorage if available');
          // Continue to localStorage check below
        }
      } else {
        // No getContext function available - proceed with localStorage
        console.debug('[settings] Firebase expected but getContext not available - proceeding with localStorage fallback');
      }
    }
    
    // Resolve localStorage key - use authenticated email if available, otherwise use context.user
    const localKey = authenticatedUserEmail
      ? `${DEFAULT_LOCAL_KEY}_${authenticatedUserEmail}`
      : resolveLocalKey(context.user);
    
    console.debug('[settings] Resolved localStorage key:', localKey);
    
    const local = readFromLocalStorage(localKey);
    if (local) {
      console.debug('[settings] ===== LOCALSTORAGE DATA FOUND =====');
      console.debug('[settings] Raw localStorage data:', JSON.stringify(local, null, 2));
      console.debug('[settings] localStorage kochLevel:', (local as Record<string, unknown>)['kochLevel']);
      console.debug('[settings] Fallback kochLevel:', fallback.kochLevel);
      
      // Use localStorage if:
      // - Firestore not configured, OR
      // - We attempted Firestore but document doesn't exist, OR
      // - Firestore read failed, OR
      // - Firestore is configured but auth/user not ready yet
      // Only skip localStorage if we successfully loaded from Firestore (already returned above)
      if (!isFirestoreConfigured || !firestoreAttempted || !firestoreDocumentExists) {
        const normalized = normalizeTrainingSettings(local, fallback);
        console.debug('[settings] ===== NORMALIZED FROM LOCALSTORAGE =====');
        console.debug('[settings] Normalized settings:', JSON.stringify(normalized, null, 2));
        console.debug('[settings] Normalized kochLevel:', normalized.kochLevel);
        console.debug('[settings] ========== LOAD END (localStorage) ==========');
        return normalized;
      } else {
        console.debug('[settings] Skipping localStorage - Firestore document exists, should have been loaded already');
        console.debug('[settings] ========== LOAD END (Skipped localStorage) ==========');
      }
    } else {
      console.debug('[settings] No localStorage data found with key:', localKey);
      console.debug('[settings] ========== LOAD END (Fallback) ==========');
    }

    return fallback;
  }

  async save(
    context: TrainingSettingsRepositoryContext,
    settings: TrainingSettings,
  ): Promise<void> {
    console.debug('[settings] ========== SAVE START ==========');
    console.debug('[settings] Saving settings with kochLevel:', settings.kochLevel);
    
    // ALWAYS save to localStorage first (local storage is the source of truth)
    const localKey = resolveLocalKey(context.user);
    const payload = serializeTrainingSettings(settings);
    writeToLocalStorage(localKey, payload);
    console.debug('[settings] LocalStorage save completed for key:', localKey);

    // Then try to save to Firestore if available (this is a sync operation)
    const firebaseUser = toFirebaseUser(context.user);
    const firestore = resolveFirestore(context.firebase);
    if (firestore && firebaseUser) {
      try {
        const ref = doc(firestore, 'users', firebaseUser.uid, 'settings', 'default');
        await setDoc(ref, buildFirestoreTrainingSettingsPayload(settings), { merge: true });
        console.debug('[settings] Successfully saved to Firestore');
      } catch (error) {
        console.warn('[settings] Failed to persist to Firestore; local copy kept.', error);
        // Don't throw - local storage is the source of truth
        // But log the error so we know Firestore sync failed
      }
    } else {
      // Log why Firestore save was skipped for debugging
      if (!firestore) {
        console.debug('[settings] Firestore not available - firebase:', context.firebase ? 'present' : 'missing', 'db:', context.firebase?.db ? 'present' : 'null');
      }
      if (!firebaseUser) {
        console.debug('[settings] Firebase user not available - user:', context.user ? 'present' : 'null');
      }
    }
    
    console.debug('[settings] ========== SAVE END ==========');
  }

  async clear(context: TrainingSettingsRepositoryContext): Promise<void> {
    removeFromLocalStorage(resolveLocalKey(context.user));

    const firebaseUser = toFirebaseUser(context.user);
    const firestore = resolveFirestore(context.firebase);
    if (firestore && firebaseUser) {
      try {
        const ref = doc(firestore, 'users', firebaseUser.uid, 'settings', 'default');
        await setDoc(ref, {}, { merge: false });
      } catch (error) {
        console.warn('[settings] Unable to clear Firestore settings.', error);
      }
    }
  }
}
