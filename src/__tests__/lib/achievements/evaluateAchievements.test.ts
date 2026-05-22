import { calculateAchievementProgress, evaluateAchievements } from '@/lib/achievements';
import type { SessionResult } from '@/types';

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
}: {
  readonly timestamp: number;
  readonly date: string;
  readonly accuracy?: number;
  readonly score?: number;
  readonly avgResponseMs?: number;
  readonly totalChars?: number;
  readonly effectiveAlphabetSize?: number;
  readonly mastered?: readonly string[];
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
});
