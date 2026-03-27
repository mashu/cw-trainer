'use client';

import {
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  type User as FirebaseUser,
} from 'firebase/auth';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getRedirectedUser, googleSignIn, googleSignOut, initFirebase } from '@/lib/firebaseClient';
import type { FirebaseServicesLite } from '@/lib/sessionPersistence';
import { useAppStore } from '@/store';
import type { AppUser } from '@/types';

type FirebaseServices = NonNullable<ReturnType<typeof initFirebase>>;

export interface AuthUserSummary {
  readonly email: string;
  readonly username?: string;
  readonly uid?: string;
  readonly photoUrl?: string | null;
}

export interface UseAuthResult {
  readonly firebaseReady: boolean;
  readonly firebaseServices: FirebaseServices | null;
  readonly authInProgress: boolean;
  readonly firebaseUser: FirebaseUser | null;
  readonly appUser: AppUser | null;
  readonly user: AuthUserSummary | null;
  readonly signInWithGoogle: () => Promise<void>;
  readonly signOut: () => Promise<void>;
  readonly switchAccount: () => Promise<void>;
}

const deriveProvider = (firebaseUser: FirebaseUser): AppUser['provider'] => {
  if (firebaseUser.isAnonymous) {
    return 'anonymous';
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const providerId = firebaseUser.providerData.find((entry: any) => entry?.providerId)?.providerId;
  if (providerId === 'google.com') {
    return 'google';
  }

  return 'anonymous';
};

const mapFirebaseUserToAppUser = (firebaseUser: FirebaseUser): AppUser | null => {
  const email = firebaseUser.email ?? '';
  if (!email && !firebaseUser.uid) {
    return null;
  }

  return {
    id: firebaseUser.uid || email,
    email,
    displayName: firebaseUser.displayName ?? undefined,
    photoUrl: firebaseUser.photoURL ?? undefined,
    provider: deriveProvider(firebaseUser),
  };
};

const mapFirebaseUserToSummary = (firebaseUser: FirebaseUser): AuthUserSummary => ({
  email: firebaseUser.email ?? '',
  username: firebaseUser.displayName ?? undefined,
  uid: firebaseUser.uid ?? undefined,
  photoUrl: firebaseUser.photoURL ?? undefined,
});

export function useAuth(): UseAuthResult {
  const [firebaseReady, setFirebaseReady] = useState(false);
  const [authInProgress, setAuthInProgress] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);

  const firebaseRef = useRef<FirebaseServices | null>(null);
  const lastContextRef = useRef<{ userId: string | null; hasFirebase: boolean }>({
    userId: null,
    hasFirebase: false,
  });
  /** Debounce transient null from Firebase (e.g. connectivity loss) so we don't clear auth and trigger loads. */
  const hadUserRef = useRef(false);
  const pendingNullTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setContext = useAppStore((state) => state.setContext);

  useEffect(() => {
    firebaseRef.current = initFirebase();
    setFirebaseReady(firebaseRef.current !== null);

    let unsubscribe: (() => void) | undefined;

    const configureAuth = async (): Promise<void> => {
      if (!firebaseRef.current) {
        return;
      }

      try {
        await setPersistence(firebaseRef.current.auth, browserLocalPersistence);
      } catch (error) {
        console.warn('[Auth] Failed to set persistence', error);
      }

      const DEBOUNCE_NULL_MS = 2500;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      unsubscribe = onAuthStateChanged(firebaseRef.current.auth, (user: any) => {
        // authInProgress is cleared when onAuthStateChanged fires (signed in or signed out)
        setAuthInProgress(false);

        if (user !== null) {
          if (pendingNullTimeoutRef.current !== null) {
            clearTimeout(pendingNullTimeoutRef.current);
            pendingNullTimeoutRef.current = null;
          }
          hadUserRef.current = true;
          setFirebaseUser(user);
          return;
        }

        // user === null: might be real sign-out or transient (e.g. connectivity loss / token blip)
        if (hadUserRef.current) {
          if (pendingNullTimeoutRef.current !== null) return;
          pendingNullTimeoutRef.current = setTimeout(() => {
            pendingNullTimeoutRef.current = null;
            hadUserRef.current = false;
            setFirebaseUser(null);
          }, DEBOUNCE_NULL_MS);
        } else {
          setFirebaseUser(null);
        }
      });

      const redirected = await getRedirectedUser(firebaseRef.current);
      if (redirected) {
        hadUserRef.current = true;
        setFirebaseUser(redirected);
        setAuthInProgress(false);
      }
    };

    void configureAuth();

    // When user returns to tab after long idle, refresh token in background so Firebase
    // stays valid without disrupting the UI. Use local data until sync succeeds.
    const onVisibilityChange = (): void => {
      if (typeof document === 'undefined' || document.visibilityState !== 'visible') return;
      const auth = firebaseRef.current?.auth;
      const currentUser = auth?.currentUser;
      if (currentUser) {
        currentUser.getIdToken(true).catch(() => {
          // Token refresh failed (e.g. session expired). Don't clear UI; next Firebase
          // operation may prompt or use local data. No interruption to the user.
        });
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return (): void => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (pendingNullTimeoutRef.current !== null) {
        clearTimeout(pendingNullTimeoutRef.current);
        pendingNullTimeoutRef.current = null;
      }
      try {
        unsubscribe?.();
      } catch {}
    };
  }, []);

  const appUser = useMemo(
    () => (firebaseUser ? mapFirebaseUserToAppUser(firebaseUser) : null),
    [firebaseUser],
  );
  const userSummary = useMemo(
    () => (firebaseUser ? mapFirebaseUserToSummary(firebaseUser) : null),
    [firebaseUser],
  );

  useEffect(() => {
    const firebaseLite: FirebaseServicesLite = firebaseRef.current
      ? { db: firebaseRef.current.db, auth: firebaseRef.current.auth }
      : null;

    const userId = appUser?.id ?? null;
    const hasFirebase = firebaseLite !== null;

    // Only push context when it meaningfully changed to avoid redundant store updates
    // and triggerLoads during an active session (which can cause UI/sync issues).
    const last = lastContextRef.current;
    if (last.userId === userId && last.hasFirebase === hasFirebase) {
      return;
    }
    lastContextRef.current = { userId, hasFirebase };

    setContext({ firebase: firebaseLite, user: appUser });
  }, [appUser, setContext, firebaseReady]);

  const signInWithGoogle = useCallback(async (): Promise<void> => {
    if (!firebaseRef.current) {
      throw new Error('Firebase is not configured. Cannot sign in.');
    }

    setAuthInProgress(true);

    try {
      const result = await googleSignIn(firebaseRef.current);
      if (result) {
        setFirebaseUser(result);
      }
    } catch (error) {
      setAuthInProgress(false);
      throw error;
    }
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    setAuthInProgress(true);
    hadUserRef.current = false;
    if (pendingNullTimeoutRef.current !== null) {
      clearTimeout(pendingNullTimeoutRef.current);
      pendingNullTimeoutRef.current = null;
    }

    try {
      if (firebaseRef.current) {
        await googleSignOut(firebaseRef.current);
      }
    } finally {
      setFirebaseUser(null);
      setAuthInProgress(false);
      try {
        localStorage.removeItem('morse_user');
      } catch {}
    }
  }, []);

  const switchAccount = useCallback(async (): Promise<void> => {
    await signOut();
    await signInWithGoogle();
  }, [signInWithGoogle, signOut]);

  return {
    firebaseReady,
    firebaseServices: firebaseRef.current,
    authInProgress,
    firebaseUser,
    appUser,
    user: userSummary,
    signInWithGoogle,
    signOut,
    switchAccount,
  };
}
