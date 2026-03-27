import type { FirebaseServicesLite } from '@/lib/sessionPersistence';
import {
  deleteSessionPersisted,
  flushPendingOps,
  loadSessions,
  saveSessions,
} from '@/lib/sessionPersistence';
import type { AppUser, SessionResult } from '@/types';

export interface SessionRepositoryContext {
  readonly firebase?: FirebaseServicesLite;
  readonly user: AppUser | null;
}

export interface SessionRepository {
  getAll(context: SessionRepositoryContext): Promise<SessionResult[]>;
  saveAll(context: SessionRepositoryContext, sessions: readonly SessionResult[]): Promise<void>;
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
