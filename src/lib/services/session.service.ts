import type { SessionRepository, SessionRepositoryContext } from '@/lib/db/repositories';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { queueSession, dequeueSession, getRetryReadySessions, recordRetryAttempt } from '@/lib/sessionQueue';
import { sessionResultSchema, type SessionResultInput } from '@/lib/validators';
import type { SessionResult } from '@/types';

const sortSessions = (sessions: readonly SessionResult[]): SessionResult[] =>
  [...sessions].sort((a, b) => a.timestamp - b.timestamp);

export class SessionService {
  // Instance-scoped cache so it doesn't leak across user switches.
  // Each user context gets its own service instance, keeping caches isolated.
  private cachedSessions: SessionResult[] | null = null;

  constructor(private readonly repository: SessionRepository) {}

  /** Clear the in-memory session cache (call on user switch). */
  clearCache(): void {
    this.cachedSessions = null;
  }

  async listSessions(context: SessionRepositoryContext): Promise<SessionResult[]> {
    try {
      const sessions = await this.repository.getAll(context);
      this.cachedSessions = sessions;
      return sessions;
    } catch (error) {
      console.warn('[SessionService] Failed to fetch sessions, using cache:', error);
      // Return cached sessions if available
      if (this.cachedSessions !== null) {
        return this.cachedSessions;
      }
      throw error;
    }
  }

  /**
   * Upsert a session with resilient error handling.
   * If Firebase fails, the session is saved locally and queued for retry.
   * This method never throws for Firebase errors - it always succeeds locally.
   */
  async upsertSession(
    context: SessionRepositoryContext,
    input: SessionResultInput,
  ): Promise<SessionResult[]> {
    const result = sessionResultSchema.safeParse(input);
    if (!result.success) {
      throw new ValidationError('Invalid session payload', result.error.flatten());
    }

    const validated = result.data;
    const { firestoreId, groupTimings, mode, ...rest } = validated;
    const normalized: SessionResult = {
      ...rest,
      groupTimings: groupTimings.map(t => ({
        timeToCompleteMs: t.timeToCompleteMs,
        ...(t.perCharMs !== undefined ? { perCharMs: t.perCharMs } : {}),
      })),
      ...(mode !== undefined ? { mode } : {}),
      ...(firestoreId !== undefined ? { firestoreId } : {}),
    };

    // Try to get existing sessions, but don't fail if Firebase is down
    let existing: SessionResult[] = [];
    try {
      existing = await this.repository.getAll(context);
      this.cachedSessions = existing;
    } catch (error) {
      console.warn('[SessionService] Failed to fetch existing sessions, using cache:', error);
      // Use cached sessions if available, otherwise just save the new session
      existing = this.cachedSessions ?? [];
    }

    const byTimestamp = new Map(existing.map((session) => [session.timestamp, session] as const));
    byTimestamp.set(normalized.timestamp, normalized);

    const nextSessions = sortSessions(Array.from(byTimestamp.values()));
    
    // Try to save to Firebase, but don't fail if it errors
    // The sessionPersistence layer already handles local storage fallback
    try {
      await this.repository.saveAll(context, nextSessions);
      // Successfully saved to Firebase, remove from retry queue if present
      dequeueSession(normalized.timestamp);
    } catch (error) {
      console.warn('[SessionService] Save failed, session queued for retry:', error);
      // Queue for retry - the local storage save should still have succeeded
      queueSession(normalized);
    }
    
    // Try to flush pending ops in the background (don't await, don't fail)
    this.repository.flushPending(context, nextSessions).catch((error) => {
      console.warn('[SessionService] Flush pending failed:', error);
    });
    
    // Update cache with the new sessions
    this.cachedSessions = nextSessions;
    return nextSessions;
  }

  /**
   * Process any sessions in the retry queue.
   * Call this periodically or when connectivity is restored.
   */
  async processRetryQueue(context: SessionRepositoryContext): Promise<void> {
    const readySessions = getRetryReadySessions();
    if (readySessions.length === 0) return;

    const existing = this.cachedSessions ?? [];
    const byTimestamp = new Map(existing.map((session) => [session.timestamp, session] as const));
    
    // Add all queued sessions to the map
    readySessions.forEach(session => {
      byTimestamp.set(session.timestamp, session);
    });

    const allSessions = sortSessions(Array.from(byTimestamp.values()));

    for (const session of readySessions) {
      try {
        await this.repository.saveAll(context, allSessions);
        recordRetryAttempt(session.timestamp, true);
      } catch (error) {
        console.warn('[SessionService] Retry failed for session:', session.timestamp, error);
        recordRetryAttempt(session.timestamp, false);
      }
    }
  }

  async replaceAll(
    context: SessionRepositoryContext,
    inputs: readonly SessionResultInput[],
  ): Promise<SessionResult[]> {
    const parsed = inputs.map((input) => {
      const result = sessionResultSchema.safeParse(input);
      if (!result.success) {
        throw new ValidationError('Invalid session payload', result.error.flatten());
      }
      const validated = result.data;
      const { firestoreId, groupTimings, mode, ...rest } = validated;
      return {
        ...rest,
        groupTimings: groupTimings.map(t => ({
          timeToCompleteMs: t.timeToCompleteMs,
          ...(t.perCharMs !== undefined ? { perCharMs: t.perCharMs } : {}),
        })),
        ...(mode !== undefined ? { mode } : {}),
        ...(firestoreId !== undefined ? { firestoreId } : {}),
      } as SessionResult;
    });

    const nextSessions = sortSessions(parsed);
    await this.repository.saveAll(context, nextSessions);
    await this.repository.flushPending(context, nextSessions);
    return nextSessions;
  }

  async deleteSession(
    context: SessionRepositoryContext,
    timestamp: number,
  ): Promise<SessionResult[]> {
    const existing = await this.repository.getAll(context);
    if (!existing.some((session) => session.timestamp === timestamp)) {
      throw new NotFoundError(`Session with timestamp ${timestamp} was not found.`);
    }

    const remaining = await this.repository.deleteByTimestamp(context, timestamp, existing);
    await this.repository.flushPending(context, remaining);
    return sortSessions(remaining);
  }

  async syncPending(context: SessionRepositoryContext): Promise<SessionResult[]> {
    const sessions = await this.repository.getAll(context);
    await this.repository.flushPending(context, sessions);
    return sortSessions(sessions);
  }
}
