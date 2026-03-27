
import type { SessionRepository, SessionRepositoryContext } from '@/lib/db/repositories';
import { SessionService } from '@/lib/services';
import { sessionResultSchema, type SessionResultInput } from '@/lib/validators';
import type { SessionResult, AppUser } from '@/types';

class InMemorySessionRepository implements SessionRepository {
  private sessions: SessionResult[] = [];
  public flushCount = 0;

  async getAll(_context: SessionRepositoryContext): Promise<SessionResult[]> {
    return [...this.sessions];
  }

  async saveAll(
    _context: SessionRepositoryContext,
    sessions: readonly SessionResult[],
  ): Promise<void> {
    this.sessions = [...sessions];
  }

  async deleteByTimestamp(
    _context: SessionRepositoryContext,
    timestamp: number,
    currentSessions: readonly SessionResult[],
  ): Promise<SessionResult[]> {
    this.sessions = currentSessions
      .filter((session) => session.timestamp !== timestamp)
      .map((session) => ({ ...session }));
    return [...this.sessions];
  }

  async flushPending(
    _context: SessionRepositoryContext,
    _sessions: readonly SessionResult[],
  ): Promise<void> {
    this.flushCount += 1;
  }
}

const user: AppUser = { id: 'user-123', email: 'user@example.com', provider: 'google' };

const context: SessionRepositoryContext = { user };

const buildSessionInput = (
  timestamp: number,
  overrides?: Partial<SessionResultInput>,
): SessionResultInput => {
  const baseTimestamp = timestamp * 1_000;
  return {
    date: '2025-11-02',
    timestamp: baseTimestamp,
    startedAt: Math.max(0, baseTimestamp - 500),
    finishedAt: baseTimestamp,
    groups: [{ sent: 'AB', received: 'AB', correct: true }],
    groupTimings: [{ timeToCompleteMs: 1000, perCharMs: 500 }],
    accuracy: 1,
    letterAccuracy: { A: { correct: 1, total: 1 }, B: { correct: 1, total: 1 } },
    alphabetSize: 2,
    avgResponseMs: 500,
    totalChars: 2,
    effectiveAlphabetSize: 2,
    score: 100,
    ...overrides,
  };
};

describe('SessionService', () => {
  it('upserts sessions and maintains chronological order', async () => {
    const repository = new InMemorySessionRepository();
    const service = new SessionService(repository);

    const first = buildSessionInput(2);
    const second = buildSessionInput(1);
    const firstValidation = sessionResultSchema.safeParse(first);
    if (!firstValidation.success) {
      throw new Error(JSON.stringify(firstValidation.error.format(), null, 2));
    }
    const secondValidation = sessionResultSchema.safeParse(second);
    if (!secondValidation.success) {
      throw new Error(JSON.stringify(secondValidation.error.format(), null, 2));
    }

    await service.upsertSession(context, first);
    await service.upsertSession(context, second);

    const sessions = await service.listSessions(context);
    const timestamps = sessions.map((session) => session.timestamp);

    expect(timestamps).toEqual([1_000, 2_000]);
    expect(repository.flushCount).toBeGreaterThan(0);
  });

  it('replaces existing session with matching timestamp', async () => {
    const repository = new InMemorySessionRepository();
    const service = new SessionService(repository);

    const initial = buildSessionInput(1, { accuracy: 0.5 });
    const updated = buildSessionInput(1, { accuracy: 0.9 });
    const initialValidation = sessionResultSchema.safeParse(initial);
    if (!initialValidation.success) {
      throw new Error(JSON.stringify(initialValidation.error.format(), null, 2));
    }
    const updatedValidation = sessionResultSchema.safeParse(updated);
    if (!updatedValidation.success) {
      throw new Error(JSON.stringify(updatedValidation.error.format(), null, 2));
    }

    await service.upsertSession(context, initial);
    await service.upsertSession(context, updated);

    const [session] = await service.listSessions(context);

    expect(session).toBeDefined();
    expect(session!.accuracy).toBe(0.9);
  });

  it('deletes sessions by timestamp', async () => {
    const repository = new InMemorySessionRepository();
    const service = new SessionService(repository);

    const first = buildSessionInput(1);
    const second = buildSessionInput(2);
    const firstValidation = sessionResultSchema.safeParse(first);
    if (!firstValidation.success) {
      throw new Error(JSON.stringify(firstValidation.error.format(), null, 2));
    }
    const secondValidation = sessionResultSchema.safeParse(second);
    if (!secondValidation.success) {
      throw new Error(JSON.stringify(secondValidation.error.format(), null, 2));
    }

    await service.upsertSession(context, first);
    await service.upsertSession(context, second);

    const remaining = await service.deleteSession(context, 1_000);

    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.timestamp).toBe(2_000);
  });

  it('throws NotFoundError when deleting non-existent session', async () => {
    const repository = new InMemorySessionRepository();
    const service = new SessionService(repository);

    const first = buildSessionInput(1);
    const firstValidation = sessionResultSchema.safeParse(first);
    if (!firstValidation.success) {
      throw new Error(JSON.stringify(firstValidation.error.format(), null, 2));
    }

    await service.upsertSession(context, first);

    await expect(service.deleteSession(context, 9_999)).rejects.toThrow(/not found/i);
  });

  it('replaces all sessions', async () => {
    const repository = new InMemorySessionRepository();
    const service = new SessionService(repository);

    const first = buildSessionInput(1);
    const second = buildSessionInput(2);
    const firstValidation = sessionResultSchema.safeParse(first);
    if (!firstValidation.success) {
      throw new Error(JSON.stringify(firstValidation.error.format(), null, 2));
    }
    const secondValidation = sessionResultSchema.safeParse(second);
    if (!secondValidation.success) {
      throw new Error(JSON.stringify(secondValidation.error.format(), null, 2));
    }

    await service.upsertSession(context, first);
    await service.upsertSession(context, second);

    const newSessions = [
      buildSessionInput(3),
      buildSessionInput(4),
    ];
    const newSessionsValidated = newSessions.map(s => {
      const result = sessionResultSchema.safeParse(s);
      if (!result.success) {
        throw new Error(JSON.stringify(result.error.format(), null, 2));
      }
      return result.data;
    });

    const replaced = await service.replaceAll(context, newSessionsValidated);

    expect(replaced).toHaveLength(2);
    expect(replaced[0]?.timestamp).toBe(3_000);
    expect(replaced[1]?.timestamp).toBe(4_000);
  });

  it('syncs pending sessions', async () => {
    const repository = new InMemorySessionRepository();
    const service = new SessionService(repository);

    const first = buildSessionInput(1);
    const firstValidation = sessionResultSchema.safeParse(first);
    if (!firstValidation.success) {
      throw new Error(JSON.stringify(firstValidation.error.format(), null, 2));
    }

    await service.upsertSession(context, first);
    const initialFlushCount = repository.flushCount;

    await service.syncPending(context);

    expect(repository.flushCount).toBeGreaterThan(initialFlushCount);
  });

  it('handles empty session list', async () => {
    const repository = new InMemorySessionRepository();
    const service = new SessionService(repository);

    const sessions = await service.listSessions(context);

    expect(sessions).toHaveLength(0);
  });

  it('handles sessions with firestoreId', async () => {
    const repository = new InMemorySessionRepository();
    const service = new SessionService(repository);

    const sessionWithId = buildSessionInput(1, { firestoreId: 'firestore-123' });
    const validation = sessionResultSchema.safeParse(sessionWithId);
    if (!validation.success) {
      throw new Error(JSON.stringify(validation.error.format(), null, 2));
    }

    await service.upsertSession(context, sessionWithId);

    const sessions = await service.listSessions(context);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.firestoreId).toBe('firestore-123');
  });

  it('handles sessions with perCharMs in groupTimings', async () => {
    const repository = new InMemorySessionRepository();
    const service = new SessionService(repository);

    const sessionWithPerChar = buildSessionInput(1, {
      groupTimings: [{ timeToCompleteMs: 1000, perCharMs: 500 }],
    });
    const validation = sessionResultSchema.safeParse(sessionWithPerChar);
    if (!validation.success) {
      throw new Error(JSON.stringify(validation.error.format(), null, 2));
    }

    await service.upsertSession(context, sessionWithPerChar);

    const sessions = await service.listSessions(context);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.groupTimings[0]?.perCharMs).toBe(500);
  });

  it('preserves echo mode sessions', async () => {
    const repository = new InMemorySessionRepository();
    const service = new SessionService(repository);

    const echoSession = buildSessionInput(1, { mode: 'echo' });
    const validation = sessionResultSchema.safeParse(echoSession);
    if (!validation.success) {
      throw new Error(JSON.stringify(validation.error.format(), null, 2));
    }

    await service.upsertSession(context, echoSession);

    const sessions = await service.listSessions(context);
    expect(sessions[0]?.mode).toBe('echo');
  });

  it('throws ValidationError for invalid session input', async () => {
    const repository = new InMemorySessionRepository();
    const service = new SessionService(repository);

    const invalidInput = {
      timestamp: 'invalid',
      date: '2025-11-02',
    } as unknown as SessionResultInput;

    await expect(service.upsertSession(context, invalidInput)).rejects.toThrow(/Invalid session payload/i);
  });
});
