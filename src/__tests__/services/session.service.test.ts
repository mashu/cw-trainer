
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

const context: SessionRepositoryContext = { firebase: undefined, user };

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

    expect(session.accuracy).toBe(0.9);
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
});
