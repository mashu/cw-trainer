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

  const providerId = firebaseUser.providerData.find((entry) => entry?.providerId)?.providerId;
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

      unsubscribe = onAuthStateChanged(firebaseRef.current.auth, (user) => {
        setFirebaseUser(user);
        setAuthInProgress(false);
      });

      const redirected = await getRedirectedUser(firebaseRef.current);
      if (redirected) {
        setFirebaseUser(redirected);
        setAuthInProgress(false);
      }
    };

    void configureAuth();

    return (): void => {
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
