import { doc, getDoc, setDoc } from 'firebase/firestore';
import type { getFirestore } from 'firebase/firestore';

import type { FirebaseServicesLite } from '@/lib/sessionPersistence';
import {
  normalizeTrainingSettings,
  serializeTrainingSettings,
} from '@/lib/utils/training-settings';
import type { AppUser, TrainingSettings } from '@/types';

export interface TrainingSettingsRepositoryContext {
  readonly firebase?: FirebaseServicesLite;
  readonly user: AppUser | null;
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
    return;
  }

  try {
    window.localStorage.setItem(key, payload);
  } catch {
    // Intentionally swallow to avoid blocking UX.
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

export class FirebaseTrainingSettingsRepository implements TrainingSettingsRepository {
  async load(
    context: TrainingSettingsRepositoryContext,
    fallback: TrainingSettings,
  ): Promise<TrainingSettings> {
    const localKey = resolveLocalKey(context.user);

    const firebaseUser = toFirebaseUser(context.user);
    const firestore = resolveFirestore(context.firebase);
    if (firestore && firebaseUser) {
      try {
        const ref = doc(firestore, 'users', firebaseUser.uid, 'settings', 'default');
        const snapshot = await getDoc(ref);
        if (snapshot.exists()) {
          const data = snapshot.data();
          const normalized = normalizeTrainingSettings(data, fallback);
          writeToLocalStorage(localKey, serializeTrainingSettings(normalized));
          return normalized;
        }
      } catch (error) {
        console.warn(
          '[settings] Unable to load from Firestore, falling back to local storage.',
          error,
        );
      }
    }

    const local = readFromLocalStorage(localKey);
    if (local) {
      return normalizeTrainingSettings(local, fallback);
    }

    return fallback;
  }

  async save(
    context: TrainingSettingsRepositoryContext,
    settings: TrainingSettings,
  ): Promise<void> {
    const payload = serializeTrainingSettings(settings);
    writeToLocalStorage(resolveLocalKey(context.user), payload);

    const firebaseUser = toFirebaseUser(context.user);
    const firestore = resolveFirestore(context.firebase);
    if (firestore && firebaseUser) {
      try {
        const ref = doc(firestore, 'users', firebaseUser.uid, 'settings', 'default');
        await setDoc(ref, settings, { merge: true });
      } catch (error) {
        console.warn('[settings] Failed to persist to Firestore; local copy kept.', error);
      }
    }
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
