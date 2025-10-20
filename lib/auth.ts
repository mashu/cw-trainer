import { auth } from './firebase';
import { GoogleAuthProvider, signInWithPopup, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, User } from 'firebase/auth';

export async function signInWithGoogle(): Promise<User> {
  if (!auth) throw new Error('Firebase not configured');
  const provider = new GoogleAuthProvider();
  try { (provider as any).setCustomParameters?.({ prompt: 'select_account' }); } catch {}
  const cred = await signInWithPopup(auth, provider);
  return cred.user as any;
}

export async function logOut(): Promise<void> {
  if (!auth) return;
  await signOut(auth);
}

export async function signUpEmail(email: string, password: string): Promise<any> {
  if (!auth) throw new Error('Firebase not configured');
  return await createUserWithEmailAndPassword(auth, email, password);
}

export async function signInEmail(email: string, password: string): Promise<any> {
  if (!auth) throw new Error('Firebase not configured');
  return await signInWithEmailAndPassword(auth, email, password);
}

export function onAuth(authCallback: (user: any | null) => void) {
  if (!auth) return () => {};
  return onAuthStateChanged(auth, authCallback as any);
}


