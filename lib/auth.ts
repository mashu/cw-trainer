import type { User, UserCredential } from 'firebase/auth';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
} from 'firebase/auth';

import { auth } from './firebase';

export async function signInWithGoogle(): Promise<User> {
  if (!auth) throw new Error('Firebase not configured');
  const provider = new GoogleAuthProvider();
  try {
    (provider as unknown as { setCustomParameters?: (params: Record<string, string>) => void }).setCustomParameters?.({ prompt: 'select_account' });
  } catch {
    // Ignore
  }
  const cred = await signInWithPopup(auth, provider);
  return cred.user;
}

export async function logOut(): Promise<void> {
  if (!auth) return;
  await signOut(auth);
}

export async function signUpEmail(email: string, password: string): Promise<UserCredential> {
  if (!auth) throw new Error('Firebase not configured');
  return await createUserWithEmailAndPassword(auth, email, password);
}

export async function signInEmail(email: string, password: string): Promise<UserCredential> {
  if (!auth) throw new Error('Firebase not configured');
  return await signInWithEmailAndPassword(auth, email, password);
}

export function onAuth(authCallback: (user: User | null) => void): () => void {
  if (!auth) return () => {
    // No-op unsubscribe
  };
  return onAuthStateChanged(auth, authCallback);
}


