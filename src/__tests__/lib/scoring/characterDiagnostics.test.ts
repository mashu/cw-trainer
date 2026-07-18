import {
  BUILDING_MIN_ACCURACY,
  MASTERED_MIN_ACCURACY,
  MASTERED_MIN_ATTEMPTS,
  SLOW_AVG_MS,
  aggregateLetterStats,
  buildCharacterDiagnostics,
  classifyMastery,
  getMasteredCharacters,
  isSlowResponse,
} from '@/lib/scoring/characterDiagnostics';
import type { SessionResult } from '@/types';

const makeSession = ({
  letterAccuracy,
  groups = [],
  groupTimings = [],
}: {
  readonly letterAccuracy: SessionResult['letterAccuracy'];
  readonly groups?: SessionResult['groups'];
  readonly groupTimings?: SessionResult['groupTimings'];
}): SessionResult => ({
  date: '2026-07-01',
  timestamp: 1,
  startedAt: 0,
  finishedAt: 1,
  groups: [...groups],
  groupTimings: [...groupTimings],
  accuracy: 1,
  letterAccuracy,
  alphabetSize: Object.keys(letterAccuracy).length,
  avgResponseMs: 500,
  totalChars: Object.values(letterAccuracy).reduce((sum, s) => sum + s.total, 0),
  effectiveAlphabetSize: Object.keys(letterAccuracy).length,
  score: 100,
});

describe('classifyMastery', () => {
  it('requires enough attempts before mastered or building', () => {
    expect(classifyMastery(1, MASTERED_MIN_ATTEMPTS - 1)).toBe('weak');
    expect(classifyMastery(MASTERED_MIN_ACCURACY, MASTERED_MIN_ATTEMPTS)).toBe('mastered');
  });

  it('classifies building between 70% and 90%', () => {
    expect(classifyMastery(BUILDING_MIN_ACCURACY, MASTERED_MIN_ATTEMPTS)).toBe('building');
    expect(classifyMastery(MASTERED_MIN_ACCURACY - 0.01, MASTERED_MIN_ATTEMPTS)).toBe('building');
  });

  it('classifies weak below building accuracy with enough attempts', () => {
    expect(classifyMastery(BUILDING_MIN_ACCURACY - 0.01, MASTERED_MIN_ATTEMPTS)).toBe('weak');
  });
});

describe('isSlowResponse', () => {
  it('flags only mastered/building characters at or above the slow threshold', () => {
    expect(isSlowResponse('mastered', SLOW_AVG_MS)).toBe(true);
    expect(isSlowResponse('building', SLOW_AVG_MS + 50)).toBe(true);
    expect(isSlowResponse('weak', SLOW_AVG_MS + 500)).toBe(false);
    expect(isSlowResponse('mastered', SLOW_AVG_MS - 1)).toBe(false);
  });
});

describe('aggregateLetterStats / getMasteredCharacters', () => {
  it('aggregates across sessions and matches trophy mastery', () => {
    const sessions = [
      makeSession({
        letterAccuracy: {
          K: { correct: 5, total: 5 },
          M: { correct: 3, total: 5 },
        },
      }),
      makeSession({
        letterAccuracy: {
          K: { correct: 4, total: 5 },
          R: { correct: 2, total: 5 },
        },
      }),
    ];
    const aggregates = aggregateLetterStats(sessions);
    const byLetter = new Map(aggregates.map((a) => [a.letter, a]));
    expect(byLetter.get('K')?.total).toBe(10);
    expect(byLetter.get('K')?.correct).toBe(9);
    expect(byLetter.get('K')?.accuracy).toBe(90);

    const totals = Object.fromEntries(
      aggregates.map((a) => [a.letter, { correct: a.correct, total: a.total }]),
    );
    expect(getMasteredCharacters(['K', 'M', 'R'], totals)).toEqual(['K']);
  });
});

describe('buildCharacterDiagnostics', () => {
  it('separates mastery from slow timing', () => {
    const sessions = [
      makeSession({
        letterAccuracy: {
          K: { correct: 9, total: 10 },
          M: { correct: 8, total: 10 },
          U: { correct: 4, total: 10 },
        },
        groups: [
          { sent: 'K', received: 'K', correct: true },
          { sent: 'M', received: 'M', correct: true },
        ],
        groupTimings: [{ timeToCompleteMs: 500 }, { timeToCompleteMs: 1200 }],
      }),
    ];
    const diagnostics = buildCharacterDiagnostics({ sessions });
    const byLetter = new Map(diagnostics.map((d) => [d.letter, d]));

    expect(byLetter.get('K')?.status).toBe('mastered');
    expect(byLetter.get('K')?.isSlow).toBe(false);
    expect(byLetter.get('M')?.status).toBe('building');
    expect(byLetter.get('M')?.isSlow).toBe(true);
    expect(byLetter.get('U')?.status).toBe('weak');
    expect(byLetter.get('U')?.isSlow).toBe(false);
  });

  it('filters to the current practice pool', () => {
    const sessions = [
      makeSession({
        letterAccuracy: {
          K: { correct: 9, total: 10 },
          Z: { correct: 9, total: 10 },
        },
      }),
    ];
    const diagnostics = buildCharacterDiagnostics({
      sessions,
      pool: ['K', 'M'],
    });
    expect(diagnostics.map((d) => d.letter)).toEqual(['K']);
  });

  it('accepts a precomputed avgMs map', () => {
    const sessions = [
      makeSession({
        letterAccuracy: { K: { correct: 9, total: 10 } },
      }),
    ];
    const diagnostics = buildCharacterDiagnostics({
      sessions,
      avgMsByLetter: new Map([['K', 900]]),
    });
    expect(diagnostics[0]?.isSlow).toBe(true);
    expect(diagnostics[0]?.avgMs).toBe(900);
  });
});
