import { collection, doc, setDoc } from 'firebase/firestore';

import type { ErrorReport } from '@/lib/errors/reporter';
import type { FirebaseServicesLite } from '@/lib/sessionPersistence';
import type { AppUser } from '@/types';

export interface ErrorRepositoryContext {
  readonly firebase?: FirebaseServicesLite;
  readonly user: AppUser | null;
}

export interface ErrorRepository {
  /** Best-effort remote persistence of a client error. Never throws. */
  record(context: ErrorRepositoryContext, report: ErrorReport): Promise<void>;
}

const ERRORS_COLLECTION = 'clientErrors';

/**
 * Writes client error reports to Firestore under `users/{uid}/clientErrors`.
 * That path is owned by the signed-in user, so it works with the existing
 * security rules (no rules change needed) and keeps error data private.
 *
 * Respects the Firebase-optional design: no-ops when Firestore is unavailable
 * or the user is signed out, and swallows any write failure so reporting can
 * never cascade into more errors.
 */
export class FirebaseErrorRepository implements ErrorRepository {
  async record(context: ErrorRepositoryContext, report: ErrorReport): Promise<void> {
    const db = context.firebase?.db ?? null;
    const user = context.user;
    if (!db || !user) {
      return;
    }

    try {
      const ref = doc(collection(db, 'users', user.id, ERRORS_COLLECTION));
      await setDoc(ref, {
        uid: user.id,
        email: user.email ?? null,
        message: report.message,
        stack: report.stack ?? null,
        code: report.code ?? null,
        source: report.source,
        boundary: report.boundary ?? null,
        componentStack: report.componentStack ?? null,
        url: report.url ?? null,
        clientTimestamp: report.timestamp,
        createdAtMs: Date.now(),
      });
    } catch {
      /* best-effort: never throw */
    }
  }
}
