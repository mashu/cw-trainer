import { describe, expect, it } from '@jest/globals';

import type { AppUser } from '@/types';
import { FirebaseSessionRepository } from '@/lib/db/repositories/session.repository';
import type { SessionRepositoryContext } from '@/lib/db/repositories/session.repository';

// Mock the sessionPersistence module
jest.mock('@/lib/sessionPersistence', () => ({
  loadSessions: jest.fn().mockResolvedValue([]),
  saveSessions: jest.fn().mockResolvedValue(undefined),
  deleteSessionPersisted: jest.fn().mockResolvedValue([]),
  flushPendingOps: jest.fn().mockResolvedValue(undefined),
}));

describe('FirebaseSessionRepository', () => {
  let repository: FirebaseSessionRepository;
  const user: AppUser = { id: 'user-123', email: 'user@example.com', provider: 'google' };

  beforeEach(() => {
    repository = new FirebaseSessionRepository();
    jest.clearAllMocks();
  });

  describe('getAll', () => {
    it('converts AppUser to Firebase user format', async () => {
      const context: SessionRepositoryContext = {
        firebase: undefined,
        user,
      };

      await repository.getAll(context);

      const { loadSessions } = require('@/lib/sessionPersistence');
      expect(loadSessions).toHaveBeenCalledWith(null, {
        uid: 'user-123',
        email: 'user@example.com',
      });
    });

    it('handles null user', async () => {
      const context: SessionRepositoryContext = {
        firebase: undefined,
        user: null,
      };

      await repository.getAll(context);

      const { loadSessions } = require('@/lib/sessionPersistence');
      expect(loadSessions).toHaveBeenCalledWith(null, null);
    });
  });

  describe('saveAll', () => {
    it('converts AppUser and saves sessions', async () => {
      const context: SessionRepositoryContext = {
        firebase: undefined,
        user,
      };
      const sessions = [
        {
          timestamp: 1000,
          date: '2025-01-01',
          startedAt: 0,
          finishedAt: 1000,
          groups: [],
          groupTimings: [],
          accuracy: 1,
          letterAccuracy: {},
          alphabetSize: 2,
          avgResponseMs: 500,
          totalChars: 2,
          effectiveAlphabetSize: 2,
          score: 100,
        },
      ];

      await repository.saveAll(context, sessions);

      const { saveSessions } = require('@/lib/sessionPersistence');
      expect(saveSessions).toHaveBeenCalledWith(null, { uid: 'user-123', email: 'user@example.com' }, sessions);
    });
  });

  describe('deleteByTimestamp', () => {
    it('converts AppUser and deletes session', async () => {
      const context: SessionRepositoryContext = {
        firebase: undefined,
        user,
      };
      const sessions = [
        {
          timestamp: 1000,
          date: '2025-01-01',
          startedAt: 0,
          finishedAt: 1000,
          groups: [],
          groupTimings: [],
          accuracy: 1,
          letterAccuracy: {},
          alphabetSize: 2,
          avgResponseMs: 500,
          totalChars: 2,
          effectiveAlphabetSize: 2,
          score: 100,
        },
      ];

      await repository.deleteByTimestamp(context, 1000, sessions);

      const { deleteSessionPersisted } = require('@/lib/sessionPersistence');
      expect(deleteSessionPersisted).toHaveBeenCalledWith(null, { uid: 'user-123', email: 'user@example.com' }, 1000, sessions);
    });
  });

  describe('flushPending', () => {
    it('converts AppUser and flushes pending operations', async () => {
      const context: SessionRepositoryContext = {
        firebase: undefined,
        user,
      };
      const sessions = [
        {
          timestamp: 1000,
          date: '2025-01-01',
          startedAt: 0,
          finishedAt: 1000,
          groups: [],
          groupTimings: [],
          accuracy: 1,
          letterAccuracy: {},
          alphabetSize: 2,
          avgResponseMs: 500,
          totalChars: 2,
          effectiveAlphabetSize: 2,
          score: 100,
        },
      ];

      await repository.flushPending(context, sessions);

      const { flushPendingOps } = require('@/lib/sessionPersistence');
      expect(flushPendingOps).toHaveBeenCalledWith(null, { uid: 'user-123', email: 'user@example.com' }, sessions);
    });
  });
});

