import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';

import { IcrSessionService } from '@/lib/services/icr-session.service';
import type { IcrSessionResult } from '@/types';

describe('IcrSessionService', () => {
  let service: IcrSessionService;
  const originalLocalStorage = global.localStorage;

  beforeEach(() => {
    service = new IcrSessionService();
    // Mock localStorage
    const store: Record<string, string> = {};
    global.localStorage = {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        Object.keys(store).forEach((key) => delete store[key]);
      },
      get length() {
        return Object.keys(store).length;
      },
      key: (index: number) => Object.keys(store)[index] ?? null,
    } as Storage;
    // Clear localStorage before each test
    global.localStorage.clear();
  });

  afterEach(() => {
    global.localStorage = originalLocalStorage;
  });

  const buildSession = (timestamp: number, overrides?: Partial<IcrSessionResult>): IcrSessionResult => ({
    timestamp,
    averageReactionMs: 200,
    accuracyPercent: 85,
    trials: [],
    perLetter: {},
    settingsSnapshot: {
      audio: {
        kochLevel: 5,
        charSetMode: 'koch',
        digitsLevel: 2,
        customSet: [],
        charWpm: 18,
        effectiveWpm: 12,
        sideToneMin: 600,
        sideToneMax: 700,
        steepness: 5,
        envelopeSmoothing: 0,
      },
      icr: {
        trialsPerSession: 30,
        trialDelayMs: 750,
        vadEnabled: true,
        vadThreshold: 0.08,
        vadHoldMs: 80,
        bucketGreenMaxMs: 350,
        bucketYellowMaxMs: 800,
      },
    },
    ...overrides,
  });

  describe('listSessions', () => {
    it('returns empty array when no sessions exist', async () => {
      const sessions = await service.listSessions();
      expect(sessions).toEqual([]);
    });

    it('returns all saved sessions', async () => {
      const session1 = buildSession(1000);
      const session2 = buildSession(2000);
      await service.saveSession(session1);
      await service.saveSession(session2);

      const sessions = await service.listSessions();
      expect(sessions).toHaveLength(2);
      expect(sessions[0]?.timestamp).toBe(1000);
      expect(sessions[1]?.timestamp).toBe(2000);
    });

    it('handles corrupted localStorage data gracefully', async () => {
      global.localStorage.setItem('cw_icr_sessions_v1', 'invalid json');
      const sessions = await service.listSessions();
      expect(sessions).toEqual([]);
    });

    it('handles non-array data gracefully', async () => {
      global.localStorage.setItem('cw_icr_sessions_v1', '{"not": "an array"}');
      const sessions = await service.listSessions();
      expect(sessions).toEqual([]);
    });
  });

  describe('saveSession', () => {
    it('saves a new session', async () => {
      const session = buildSession(1000);
      const result = await service.saveSession(session);

      expect(result).toHaveLength(1);
      expect(result[0]?.timestamp).toBe(1000);
      const sessions = await service.listSessions();
      expect(sessions).toHaveLength(1);
    });

    it('replaces existing session with same timestamp', async () => {
      const session1 = buildSession(1000, { accuracyPercent: 50 });
      const session2 = buildSession(1000, { accuracyPercent: 90 });

      await service.saveSession(session1);
      await service.saveSession(session2);

      const sessions = await service.listSessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0]?.accuracyPercent).toBe(90);
    });

    it('maintains chronological order', async () => {
      await service.saveSession(buildSession(3000));
      await service.saveSession(buildSession(1000));
      await service.saveSession(buildSession(2000));

      const sessions = await service.listSessions();
      expect(sessions.map((s) => s.timestamp)).toEqual([1000, 2000, 3000]);
    });

    it('trims to MAX_SESSIONS when limit exceeded', async () => {
      // Save 1001 sessions (timestamps 0-1000)
      for (let i = 0; i < 1001; i++) {
        await service.saveSession(buildSession(i));
      }

      const sessions = await service.listSessions();
      expect(sessions).toHaveLength(1000);
      // Should keep the most recent ones (sorted chronologically, slice(-1000) keeps last 1000)
      // With 1001 items (0-1000), slice(-1000) gives items at indices 1-1000, so timestamps 1-1000
      expect(sessions[0]?.timestamp).toBe(1);
      expect(sessions[999]?.timestamp).toBe(1000);
    });

    it('handles localStorage write failures gracefully', async () => {
      const originalSetItem = global.localStorage.setItem;
      let setItemCallCount = 0;
      global.localStorage.setItem = (): void => {
        setItemCallCount++;
        if (setItemCallCount === 1) {
          throw new Error('Quota exceeded');
        }
        originalSetItem.apply(global.localStorage, arguments as unknown as Parameters<typeof global.localStorage.setItem>);
      };

      const session = buildSession(1000);
      // Should not throw
      await expect(service.saveSession(session)).resolves.toBeDefined();
    });
  });

  describe('clearSessions', () => {
    it('removes all sessions', async () => {
      await service.saveSession(buildSession(1000));
      await service.saveSession(buildSession(2000));

      await service.clearSessions();

      const sessions = await service.listSessions();
      expect(sessions).toEqual([]);
    });

    it('handles empty sessions gracefully', async () => {
      await expect(service.clearSessions()).resolves.not.toThrow();
    });
  });

  describe('deleteSession', () => {
    it('removes session by timestamp', async () => {
      await service.saveSession(buildSession(1000));
      await service.saveSession(buildSession(2000));
      await service.saveSession(buildSession(3000));

      const remaining = await service.deleteSession(2000);

      expect(remaining).toHaveLength(2);
      expect(remaining.map((s) => s.timestamp)).toEqual([1000, 3000]);
    });

    it('returns all sessions when timestamp not found', async () => {
      const session1 = buildSession(1000);
      const session2 = buildSession(2000);
      await service.saveSession(session1);
      await service.saveSession(session2);

      const remaining = await service.deleteSession(9999);

      expect(remaining).toHaveLength(2);
      expect(remaining.map((s) => s.timestamp)).toEqual([1000, 2000]);
    });

    it('handles empty sessions gracefully', async () => {
      const remaining = await service.deleteSession(1000);
      expect(remaining).toEqual([]);
    });
  });
});

