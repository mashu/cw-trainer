import { initializeApp, getApps, type FirebaseOptions } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Sanitize env vars to avoid trailing newlines/spaces breaking Firebase URLs in production
const trim = (value: string | undefined) => (value ?? '').trim();
const cleanAuthDomain = (value: string | undefined) => trim(value).replace(/^https?:\/\//, '').replace(/\/+$/, '');

// Try to load local Firebase config if present (for local testing)
// This file should be in .gitignore
let localConfig: FirebaseOptions | undefined;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const localModule = require('./firebase.local');
  if (localModule?.firebaseConfig) {
    localConfig = localModule.firebaseConfig;
    // eslint-disable-next-line no-console
    console.log('[Firebase] Using local configuration from firebase.local.ts');
  }
} catch {
  // Local config file doesn't exist, use environment variables instead
}

// Use local config if available, otherwise fall back to environment variables
const firebaseConfig: FirebaseOptions = localConfig || {
  apiKey: trim(process.env['NEXT_PUBLIC_FIREBASE_API_KEY']),
  authDomain: cleanAuthDomain(process.env['NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN']),
  projectId: trim(process.env['NEXT_PUBLIC_FIREBASE_PROJECT_ID']),
  storageBucket: trim(process.env['NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET']),
  messagingSenderId: trim(process.env['NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID']),
  appId: trim(process.env['NEXT_PUBLIC_FIREBASE_APP_ID']),
};

const hasRequiredConfig = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId &&
  firebaseConfig.appId
);

let app: ReturnType<typeof initializeApp> | undefined;
if (hasRequiredConfig) {
  app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
}

const auth = app ? getAuth(app) : undefined;
const db = app ? getFirestore(app) : undefined;

export { app, auth, db };


