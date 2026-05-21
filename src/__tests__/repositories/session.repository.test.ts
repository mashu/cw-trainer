import { FirebaseSessionRepository } from '@/lib/db/repositories/session.repository';
import {
  deleteSessionPersisted,
  flushPendingOps,
  loadSessions,
  saveSessions,
} from '@/lib/sessionPersistence';
import type { SessionResult, AppUser } from '@/types';

jest.mock('@/lib/sessionPersistence', () => ({
  loadSessions: jest.fn(),
  saveSessions: jest.fn(),
  deleteSessionPersisted: jest.fn(),
  flushPendingOps: jest.fn(),
}));

const mockLoadSessions = loadSessions as jest.MockedFunction<typeof loadSessions>;
const mockSaveSessions = saveSessions as jest.MockedFunction<typeof saveSessions>;
const mockDeleteSessionPersisted = deleteSessionPersisted as jest.MockedFunction<
  typeof deleteSessionPersisted
>;
const mockFlushPendingOps = flushPendingOps as jest.MockedFunction<typeof flushPendingOps>;

const user: AppUser = { id: 'uid-1', email: 'op@example.com', provider: 'google' };
const session: SessionResult = {
  date: '2025-01-01',
  timestamp: 1000,
  startedAt: 0,
  finishedAt: 1000,
  groups: [],
  groupTimings: [],
  accuracy: 1,
  letterAccuracy: {},
  alphabetSize: 0,
  avgResponseMs: 0,
  totalChars: 0,
  effectiveAlphabetSize: 0,
  score: 100,
};

describe('FirebaseSessionRepository', () => {
  const repository = new FirebaseSessionRepository();

  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadSessions.mockResolvedValue([session]);
    mockSaveSessions.mockResolvedValue(undefined);
    mockDeleteSessionPersisted.mockResolvedValue([]);
    mockFlushPendingOps.mockResolvedValue(undefined);
  });

  it('loads sessions via persistence with mapped firebase user', async () => {
    const result = await repository.getAll({ user, firebase: { hasAuth: true, hasDb: true } });

    expect(result).toEqual([session]);
    expect(mockLoadSessions).toHaveBeenCalledWith(
      { hasAuth: true, hasDb: true },
      { uid: 'uid-1', email: 'op@example.com' },
    );
  });

  it('passes null firebase user when not signed in', async () => {
    await repository.getAll({ user: null });

    expect(mockLoadSessions).toHaveBeenCalledWith(null, null);
  });

  it('saves and deletes through persistence helpers', async () => {
    await repository.saveAll({ user }, [session]);
    expect(mockSaveSessions).toHaveBeenCalledWith(null, { uid: 'uid-1', email: 'op@example.com' }, [
      session,
    ]);

    await repository.deleteByTimestamp({ user }, 1000, [session]);
    expect(mockDeleteSessionPersisted).toHaveBeenCalledWith(
      null,
      { uid: 'uid-1', email: 'op@example.com' },
      1000,
      [session],
    );
  });

  it('flushes pending operations', async () => {
    await repository.flushPending({ user }, [session]);
    expect(mockFlushPendingOps).toHaveBeenCalledWith(
      null,
      { uid: 'uid-1', email: 'op@example.com' },
      [session],
    );
  });
});
