import type { FirebaseServicesLite } from '@/lib/sessionPersistence';
import {
  deleteSessionPersisted,
  flushPendingOps,
  loadSessions,
  saveSessions,
  saveSessionsSubset,
} from '@/lib/sessionPersistence';
import type { AppUser, SessionResult } from '@/types';

export interface SessionRepositoryContext {
  readonly firebase?: FirebaseServicesLite;
  readonly user: AppUser | null;
}

export interface SessionRepository {
  getAll(context: SessionRepositoryContext): Promise<SessionResult[]>;
  saveAll(context: SessionRepositoryContext, sessions: readonly SessionResult[]): Promise<void>;
  /** Persist only `subset` to the backend while storing the full `allSessions` list locally. */
  saveSubset(
    context: SessionRepositoryContext,
    subset: readonly SessionResult[],
    allSessions: readonly SessionResult[],
  ): Promise<void>;
  deleteByTimestamp(
    context: SessionRepositoryContext,
    timestamp: number,
    currentSessions: readonly SessionResult[],
  ): Promise<SessionResult[]>;
  flushPending(
    context: SessionRepositoryContext,
    sessions: readonly SessionResult[],
  ): Promise<void>;
}

const toFirebaseUser = (user: AppUser | null): { uid: string; email: string } | null => {
  if (!user) {
    return null;
  }

  return {
    uid: user.id,
    email: user.email,
  };
};

/** Delegates to `lib/sessionPersistence` (AppUser → Firebase user shape). Unit tests are awkward under Next/Jest + `@/` + root `lib/`; behaviour is covered via session service / integration flows. */
export class FirebaseSessionRepository implements SessionRepository {
  async getAll(context: SessionRepositoryContext): Promise<SessionResult[]> {
    const firebaseUser = toFirebaseUser(context.user);
    return loadSessions(context.firebase ?? null, firebaseUser);
  }

  async saveAll(
    context: SessionRepositoryContext,
    sessions: readonly SessionResult[],
  ): Promise<void> {
    const firebaseUser = toFirebaseUser(context.user);
    await saveSessions(context.firebase ?? null, firebaseUser, [...sessions]);
  }

  async saveSubset(
    context: SessionRepositoryContext,
    subset: readonly SessionResult[],
    allSessions: readonly SessionResult[],
  ): Promise<void> {
    const firebaseUser = toFirebaseUser(context.user);
    await saveSessionsSubset(context.firebase ?? null, firebaseUser, [...subset], [...allSessions]);
  }

  async deleteByTimestamp(
    context: SessionRepositoryContext,
    timestamp: number,
    currentSessions: readonly SessionResult[],
  ): Promise<SessionResult[]> {
    const firebaseUser = toFirebaseUser(context.user);
    return deleteSessionPersisted(context.firebase ?? null, firebaseUser, timestamp, [
      ...currentSessions,
    ]);
  }

  async flushPending(
    context: SessionRepositoryContext,
    sessions: readonly SessionResult[],
  ): Promise<void> {
    const firebaseUser = toFirebaseUser(context.user);
    await flushPendingOps(context.firebase ?? null, firebaseUser, [...sessions]);
  }
}
