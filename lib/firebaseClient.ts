// Import types for ReturnType - these are only used in type definitions
import type { initializeApp } from 'firebase/app';
import { GoogleAuthProvider, getRedirectResult, signInWithPopup, signInWithRedirect, signOut } from 'firebase/auth';
import type { User as FirebaseUser, getAuth } from 'firebase/auth';
import type { getFirestore } from 'firebase/firestore';

import { app as coreApp, auth as coreAuth, db as coreDb } from './firebase';

export type FirebaseServices = {
  app: ReturnType<typeof initializeApp>;
  auth: ReturnType<typeof getAuth>;
  db: ReturnType<typeof getFirestore>;
  provider: GoogleAuthProvider;
};

export function initFirebase(): FirebaseServices | null {
  if (!coreApp || !coreAuth || !coreDb) return null;
  const provider = new GoogleAuthProvider();
  try {
    (provider as unknown as { setCustomParameters?: (params: Record<string, string>) => void }).setCustomParameters?.({ prompt: 'select_account' });
  } catch {
    // Ignore
  }
  return { app: coreApp, auth: coreAuth, db: coreDb, provider };
}

export async function googleSignIn(services: FirebaseServices): Promise<FirebaseUser | null> {
  try {
    try {
      console.info('[Auth] Trying popup sign-in');
    } catch {
      // Ignore console errors
    }
    const res = await signInWithPopup(services.auth, services.provider);
    return res.user;
  } catch (err: unknown) {
    try {
      const errorCode = err && typeof err === 'object' && 'code' in err ? String(err.code) : String(err);
      console.warn('[Auth] Popup sign-in failed, falling back to redirect', errorCode);
    } catch {
      // Ignore console errors
    }
    await signInWithRedirect(services.auth, services.provider);
    return null;
  }
}

export async function googleSignOut(services: FirebaseServices): Promise<void> {
  await signOut(services.auth);
}

export async function getRedirectedUser(services: FirebaseServices): Promise<FirebaseUser | null> {
  try {
    const res = await getRedirectResult(services.auth);
    return res?.user ?? null;
  } catch (e) {
    // Surface redirect completion issues for easier debugging in production
    try { console.error('[Auth] getRedirectResult error', e); } catch {}
    return null;
  }
}


