import { app as coreApp, auth as coreAuth, db as coreDb } from './firebase';
import { GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, User as FirebaseUser } from 'firebase/auth';

export type FirebaseServices = {
  app: any;
  auth: any;
  db: any;
  provider: GoogleAuthProvider;
};

export function initFirebase(): FirebaseServices | null {
  if (!coreApp || !coreAuth || !coreDb) return null;
  const provider = new GoogleAuthProvider();
  try { (provider as any).setCustomParameters?.({ prompt: 'select_account' }); } catch {}
  return { app: coreApp, auth: coreAuth, db: coreDb, provider };
}

export async function googleSignIn(services: FirebaseServices): Promise<FirebaseUser | null> {
  try {
    try { console.info('[Auth] Trying popup sign-in'); } catch {}
    const res = await signInWithPopup(services.auth, services.provider);
    return res.user;
  } catch (err: any) {
    try { console.warn('[Auth] Popup sign-in failed, falling back to redirect', err?.code || err); } catch {}
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


