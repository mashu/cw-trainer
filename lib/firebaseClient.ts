import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, User as FirebaseUser } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

export type FirebaseServices = {
  app: any;
  auth: ReturnType<typeof getAuth>;
  db: ReturnType<typeof getFirestore>;
  provider: GoogleAuthProvider;
};

export function initFirebase(): FirebaseServices | null {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  if (!config.apiKey || !config.authDomain || !config.projectId || !config.appId) {
    return null; // Not configured; operate in local-only mode
  }

  const app = getApps().length ? getApps()[0]! : initializeApp(config);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const provider = new GoogleAuthProvider();
  try {
    // Ensure account chooser appears
    (provider as any).setCustomParameters?.({ prompt: 'select_account' });
  } catch {}
  return { app, auth, db, provider };
}

export async function googleSignIn(services: FirebaseServices): Promise<FirebaseUser> {
  const res = await signInWithPopup(services.auth, services.provider);
  return res.user;
}

export async function googleSignOut(services: FirebaseServices): Promise<void> {
  await signOut(services.auth);
}


