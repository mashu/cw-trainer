import {
  ACHIEVEMENT_BADGE_BY_ID,
  calculateAchievementProgress,
  evaluateAchievements,
} from '@/lib/achievements';
import type { SessionResult } from '@/types';

const DAY_MS = 24 * 60 * 60 * 1000;

const consecutiveDayDate = (dayOffset: number): string => {
  const timestamp = Date.parse('2026-01-01T00:00:00.000Z') + dayOffset * DAY_MS;
  return new Date(timestamp).toISOString().split('T')[0] ?? '2026-01-01';
};

const makeConsecutiveSessions = (dayCount: number): SessionResult[] =>
  Array.from({ length: dayCount }, (_, index) =>
    makeSession({
      timestamp: index + 1,
      date: consecutiveDayDate(index),
    }),
  );

const makeLetterAccuracy = (
  mastered: readonly string[],
): SessionResult['letterAccuracy'] =>
  mastered.reduce<Record<string, { correct: number; total: number }>>((acc, character) => {
    acc[character] = { correct: 5, total: 5 };
    return acc;
  }, {});

const makeSession = ({
  timestamp,
  date,
  accuracy = 0.8,
  score = 100,
  avgResponseMs = 2000,
  totalChars = 25,
  effectiveAlphabetSize = 2,
  mastered = ['K'],
  kochLevel,
}: {
  readonly timestamp: number;
  readonly date: string;
  readonly accuracy?: number;
  readonly score?: number;
  readonly avgResponseMs?: number;
  readonly totalChars?: number;
  readonly effectiveAlphabetSize?: number;
  readonly mastered?: readonly string[];
  readonly kochLevel?: number;
}): SessionResult => ({
  date,
  timestamp,
  startedAt: timestamp - 60_000,
  finishedAt: timestamp,
  groups: [{ sent: 'KM', received: 'KM', correct: true }],
  groupTimings: [{ timeToCompleteMs: avgResponseMs, perCharMs: avgResponseMs }],
  accuracy,
  letterAccuracy: makeLetterAccuracy(mastered),
  alphabetSize: mastered.length,
  avgResponseMs,
  totalChars,
  effectiveAlphabetSize,
  score,
  ...(kochLevel !== undefined ? { kochLevel } : {}),
});

describe('achievement evaluation', () => {
  it('unlocks first session and mastered character badges', () => {
    const result = evaluateAchievements(
      [
        makeSession({
          timestamp: 1,
          date: '2026-05-01',
          mastered: ['K', '1'],
        }),
      ],
      [],
      10,
    );

    expect(result.newlyUnlocked.map((achievement) => achievement.id)).toEqual([
      'first-session',
      'first-letter',
      'first-digit',
    ]);
    expect(result.progress.masteredLetterCount).toBe(1);
    expect(result.progress.masteredDigitCount).toBe(1);
  });

  it('unlocks alphabet mastery thresholds', () => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const result = evaluateAchievements(
      [
        makeSession({
          timestamp: 1,
          date: '2026-05-01',
          mastered: letters,
        }),
      ],
      [],
      10,
    );

    expect(result.unlocked.map((achievement) => achievement.id)).toEqual(
      expect.arrayContaining([
        'quarter-alphabet',
        'half-alphabet',
        'three-quarter-alphabet',
        'full-alphabet',
      ]),
    );
  });

  it('preserves already unlocked timestamps and reports only new badges', () => {
    const result = evaluateAchievements(
      [makeSession({ timestamp: 1, date: '2026-05-01', score: 1200 })],
      [{ id: 'first-session', unlockedAt: 5, sourceSessionTimestamp: 1 }],
      10,
    );

    expect(result.unlocked.find((achievement) => achievement.id === 'first-session')).toEqual({
      id: 'first-session',
      unlockedAt: 5,
      sourceSessionTimestamp: 1,
    });
    expect(result.newlyUnlocked.map((achievement) => achievement.id)).toContain('score-1000');
    expect(result.newlyUnlocked.map((achievement) => achievement.id)).not.toContain('first-session');
  });

  it('detects streak and comeback trophies', () => {
    const result = evaluateAchievements(
      [
        makeSession({ timestamp: 1, date: '2026-05-01' }),
        makeSession({ timestamp: 2, date: '2026-05-02' }),
        makeSession({ timestamp: 3, date: '2026-05-03' }),
        makeSession({ timestamp: 4, date: '2026-05-12', accuracy: 0.85 }),
      ],
      [],
      10,
    );

    expect(result.unlocked.map((achievement) => achievement.id)).toEqual(
      expect.arrayContaining(['three-day-streak', 'comeback']),
    );
  });

  it('calculates public progress metrics from group sessions only', () => {
    const progress = calculateAchievementProgress([
      makeSession({ timestamp: 1, date: '2026-05-01', score: 500 }),
      {
        ...makeSession({ timestamp: 2, date: '2026-05-02', score: 5000, mastered: ['A'] }),
        mode: 'echo',
      },
    ]);

    expect(progress.bestScore).toBe(500);
    expect(progress.masteredLetterCount).toBe(1);
    expect(progress.practiceDays).toBe(1);
  });

  it('unlocks volume, digit mastery, and performance trophies', () => {
    const digits = '0123456789'.split('');
    const sessions = Array.from({ length: 10 }, (_, index) =>
      makeSession({
        timestamp: index + 1,
        date: `2026-05-${String(index + 1).padStart(2, '0')}`,
        mastered: digits,
        accuracy: 1,
        totalChars: 50,
        avgResponseMs: 900,
        score: 8000,
        kochLevel: 40,
      }),
    );

    const result = evaluateAchievements(sessions, [], 10);

    expect(result.unlocked.map((achievement) => achievement.id)).toEqual(
      expect.arrayContaining([
        'getting-warm',
        'daily-operator',
        'number-pad',
        'full-keypad',
        'flawless-run',
        'lightning-copy',
        'megawatt',
        'koch-graduate',
      ]),
    );
  });

  it('unlocks a 14-day streak trophy', () => {
    const result = evaluateAchievements(makeConsecutiveSessions(14), [], 10);

    expect(result.unlocked.map((achievement) => achievement.id)).toContain('regular');
  });

  it('unlocks three-week streak without monthly operator', () => {
    const result = evaluateAchievements(makeConsecutiveSessions(21), [], 10);
    const unlockedIds = result.unlocked.map((achievement) => achievement.id);

    expect(unlockedIds).toContain('three-week-streak');
    expect(unlockedIds).not.toContain('monthly-operator');
  });

  it('uses the diamond tier for the full-year streak trophy', () => {
    expect(ACHIEVEMENT_BADGE_BY_ID['full-year'].tier).toBe('diamond');
  });
});
