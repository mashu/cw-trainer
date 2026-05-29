import { collection, doc, getDoc, getDocs, limit, query, setDoc, where } from 'firebase/firestore';

import type { PublicAchievementProfile, UnlockedAchievement } from '@/lib/achievements';
import { derivePublicIdFromUid } from '@/lib/score';
import type { FirebaseServicesLite } from '@/lib/sessionPersistence';
import { achievementCollectionSchema, publicAchievementProfileSchema } from '@/lib/validators';
import type { AppUser } from '@/types';

export interface AchievementRepositoryContext {
  readonly firebase?: FirebaseServicesLite;
  readonly user: AppUser | null;
}

export type AchievementPublicIdentity = {
  readonly publicId: number;
  readonly callSign?: string;
};

export interface AchievementRepository {
  getAll(context: AchievementRepositoryContext): Promise<UnlockedAchievement[]>;
  saveAll(
    context: AchievementRepositoryContext,
    achievements: readonly UnlockedAchievement[],
  ): Promise<void>;
  getPublicIdentity(context: AchievementRepositoryContext): Promise<AchievementPublicIdentity | null>;
  publishPublicProfile(
    context: AchievementRepositoryContext,
    profile: PublicAchievementProfile,
  ): Promise<void>;
  getPublicProfile(publicId: number): Promise<PublicAchievementProfile | null>;
}

const localKeyForAchievements = (user: AppUser | null): string =>
  user?.email ? `morse_achievements_${user.email}` : 'morse_achievements_local';

const normalizeAchievements = (raw: unknown): UnlockedAchievement[] => {
  const parsed = achievementCollectionSchema.safeParse(raw);
  if (parsed.success) {
    return parsed.data.unlocked;
  }
  if (Array.isArray(raw)) {
    return raw
      .map((item) => achievementCollectionSchema.shape.unlocked.element.safeParse(item))
      .filter((item) => item.success)
      .map((item) => item.data);
  }
  return [];
};

const readLocal = (user: AppUser | null): UnlockedAchievement[] => {
  try {
    const raw = localStorage.getItem(localKeyForAchievements(user));
    if (!raw) {
      return [];
    }
    return normalizeAchievements(JSON.parse(raw));
  } catch {
    return [];
  }
};

const writeLocal = (user: AppUser | null, achievements: readonly UnlockedAchievement[]): void => {
  try {
    localStorage.setItem(
      localKeyForAchievements(user),
      JSON.stringify({ unlocked: achievements, updatedAt: Date.now() }),
    );
  } catch {
    /* localStorage may be unavailable in private mode. */
  }
};

const parseStoredPublicProfile = (raw: unknown): PublicAchievementProfile | null => {
  const parsed = publicAchievementProfileSchema.safeParse(raw);
  if (!parsed.success || !parsed.data.shareEnabled) {
    return null;
  }
  return parsed.data;
};

const mergeAchievements = (
  left: readonly UnlockedAchievement[],
  right: readonly UnlockedAchievement[],
): UnlockedAchievement[] => {
  const byId = new Map<string, UnlockedAchievement>();
  [...left, ...right].forEach((achievement) => {
    const existing = byId.get(achievement.id);
    if (!existing || achievement.unlockedAt < existing.unlockedAt) {
      byId.set(achievement.id, achievement);
    }
  });
  return [...byId.values()].sort((a, b) => a.unlockedAt - b.unlockedAt);
};

export class FirebaseAchievementRepository implements AchievementRepository {
  async getAll(context: AchievementRepositoryContext): Promise<UnlockedAchievement[]> {
    const local = readLocal(context.user);
    const uid = context.user?.id;
    const db = context.firebase?.db;
    if (!uid || !db) {
      return local;
    }

    try {
      const ref = doc(db, 'users', uid, 'meta', 'achievements');
      const snap = await getDoc(ref);
      const cloud = snap.exists() ? normalizeAchievements(snap.data()) : [];
      const merged = mergeAchievements(local, cloud);
      writeLocal(context.user, merged);
      return merged;
    } catch {
      return local;
    }
  }

  async saveAll(
    context: AchievementRepositoryContext,
    achievements: readonly UnlockedAchievement[],
  ): Promise<void> {
    writeLocal(context.user, achievements);
    const uid = context.user?.id;
    const db = context.firebase?.db;
    if (!uid || !db) {
      return;
    }

    const ref = doc(db, 'users', uid, 'meta', 'achievements');
    await setDoc(ref, { unlocked: achievements, updatedAt: Date.now() }, { merge: true });
  }

  async getPublicIdentity(
    context: AchievementRepositoryContext,
  ): Promise<AchievementPublicIdentity | null> {
    const uid = context.user?.id;
    const db = context.firebase?.db;
    if (!uid || !db) {
      return null;
    }

    const publicId = derivePublicIdFromUid(uid);
    const ref = doc(db, 'users', uid, 'meta', 'profile');
    const snap = await getDoc(ref);
    const data = snap.exists() ? snap.data() : null;
    const callSign =
      data && typeof data['callSign'] === 'string' && data['callSign'].trim().length > 0
        ? data['callSign'].trim().toUpperCase()
        : undefined;
    await setDoc(ref, { publicId, updatedAt: Date.now() }, { merge: true });

    return {
      publicId,
      ...(callSign ? { callSign } : {}),
    };
  }

  async publishPublicProfile(
    context: AchievementRepositoryContext,
    profile: PublicAchievementProfile,
  ): Promise<void> {
    const uid = context.user?.id;
    const db = context.firebase?.db;
    if (!uid || !db) {
      return;
    }

    const parsed = publicAchievementProfileSchema.parse(profile);
    await setDoc(
      doc(db, 'publicProfiles', uid),
      {
        ...parsed,
        ownerUid: uid,
      },
      { merge: true },
    );
  }

  async getPublicProfile(publicId: number): Promise<PublicAchievementProfile | null> {
    const { initFirebase } = await import('@/lib/firebaseClient');
    const services = initFirebase();
    const db = services?.db;
    if (!db) {
      return null;
    }

    const byPublicId = await getDocs(
      query(collection(db, 'publicProfiles'), where('publicId', '==', publicId), limit(1)),
    );
    for (const docSnap of byPublicId.docs) {
      const profile = parseStoredPublicProfile(docSnap.data());
      if (profile) {
        return profile;
      }
    }

    // Legacy docs keyed by numeric publicId (before uid-keyed storage).
    const legacySnap = await getDoc(doc(db, 'publicProfiles', String(publicId)));
    if (!legacySnap.exists()) {
      return null;
    }
    return parseStoredPublicProfile(legacySnap.data());
  }
}
