import {
  computeOperatorProgress,
  MIN_SESSION_XP,
  OPERATOR_RANKS,
  operatorProgressForXp,
  rankForXp,
  sessionXp,
  sessionXpBreakdown,
  totalXp,
  XP_PER_CORRECT_CHAR,
} from '@/lib/progression';
import type { SessionResult } from '@/types';

const makeSession = ({
  timestamp = 1,
  accuracy = 0.8,
  totalChars = 50,
  effectiveWpm,
}: {
  readonly timestamp?: number;
  readonly accuracy?: number;
  readonly totalChars?: number;
  readonly effectiveWpm?: number;
} = {}): SessionResult => ({
  date: '2026-01-01',
  timestamp,
  startedAt: timestamp - 60_000,
  finishedAt: timestamp,
  groups: [{ sent: 'KM', received: 'KM', correct: true }],
  groupTimings: [{ timeToCompleteMs: 2000, perCharMs: 1000 }],
  accuracy,
  letterAccuracy: { K: { correct: 4, total: 5 } },
  alphabetSize: 2,
  avgResponseMs: 2000,
  totalChars,
  effectiveAlphabetSize: 2,
  score: 100,
  ...(effectiveWpm !== undefined ? { effectiveWpm } : {}),
});

describe('sessionXpBreakdown', () => {
  it('grants base XP per correct character with no bonuses below 80% accuracy', () => {
    const breakdown = sessionXpBreakdown(makeSession({ accuracy: 0.7, totalChars: 50 }));
    expect(breakdown.correctChars).toBe(35);
    expect(breakdown.baseXp).toBe(35 * XP_PER_CORRECT_CHAR);
    expect(breakdown.accuracyMultiplier).toBe(1);
    expect(breakdown.speedBonus).toBe(0);
    expect(breakdown.totalXp).toBe(70);
  });

  it('applies accuracy multiplier tiers', () => {
    expect(sessionXpBreakdown(makeSession({ accuracy: 0.8 })).accuracyMultiplier).toBe(1.15);
    expect(sessionXpBreakdown(makeSession({ accuracy: 0.9 })).accuracyMultiplier).toBe(1.3);
    expect(sessionXpBreakdown(makeSession({ accuracy: 0.98 })).accuracyMultiplier).toBe(1.5);
    expect(sessionXpBreakdown(makeSession({ accuracy: 1 })).accuracyMultiplier).toBe(1.5);
  });

  it('applies speed bonus tiers from effective WPM', () => {
    expect(sessionXpBreakdown(makeSession({ effectiveWpm: 5 })).speedBonus).toBe(0);
    expect(sessionXpBreakdown(makeSession({ effectiveWpm: 10 })).speedBonus).toBe(0.1);
    expect(sessionXpBreakdown(makeSession({ effectiveWpm: 15 })).speedBonus).toBe(0.2);
    expect(sessionXpBreakdown(makeSession({ effectiveWpm: 20 })).speedBonus).toBe(0.35);
    expect(sessionXpBreakdown(makeSession({ effectiveWpm: 25 })).speedBonus).toBe(0.5);
    expect(sessionXpBreakdown(makeSession({})).speedBonus).toBe(0);
  });

  it('combines accuracy and speed: 90% of 100 chars at 20 WPM', () => {
    const breakdown = sessionXpBreakdown(
      makeSession({ accuracy: 0.9, totalChars: 100, effectiveWpm: 20 }),
    );
    // 90 correct × 2 XP × (1.3 + 0.35) = 297
    expect(breakdown.totalXp).toBe(297);
  });

  it('floors any played session at MIN_SESSION_XP but gives 0 XP for empty sessions', () => {
    expect(sessionXp(makeSession({ accuracy: 0, totalChars: 30 }))).toBe(MIN_SESSION_XP);
    expect(sessionXp(makeSession({ accuracy: 0.5, totalChars: 0 }))).toBe(0);
  });

  it('is defensive about malformed stored values', () => {
    expect(sessionXp(makeSession({ accuracy: Number.NaN, totalChars: 20 }))).toBe(MIN_SESSION_XP);
    expect(sessionXp(makeSession({ accuracy: 0.9, totalChars: Number.NaN }))).toBe(0);
    expect(sessionXpBreakdown(makeSession({ accuracy: 2, totalChars: 10 })).correctChars).toBe(10);
  });
});

describe('rank ladder', () => {
  it('has strictly increasing thresholds starting at 0', () => {
    expect(OPERATOR_RANKS[0]?.minXp).toBe(0);
    for (let i = 1; i < OPERATOR_RANKS.length; i += 1) {
      expect(OPERATOR_RANKS[i]!.minXp).toBeGreaterThan(OPERATOR_RANKS[i - 1]!.minXp);
      expect(OPERATOR_RANKS[i]!.index).toBe(i);
    }
  });

  it('resolves ranks exactly at boundaries', () => {
    const second = OPERATOR_RANKS[1]!;
    expect(rankForXp(0).index).toBe(0);
    expect(rankForXp(second.minXp - 1).index).toBe(0);
    expect(rankForXp(second.minXp).index).toBe(1);
    expect(rankForXp(Number.MAX_SAFE_INTEGER).index).toBe(OPERATOR_RANKS.length - 1);
    expect(rankForXp(-50).index).toBe(0);
  });
});

describe('operatorProgressForXp', () => {
  it('reports fresh operators at the bottom rank with a full path ahead', () => {
    const progress = computeOperatorProgress([]);
    expect(progress.totalXp).toBe(0);
    expect(progress.rank.index).toBe(0);
    expect(progress.nextRank?.index).toBe(1);
    expect(progress.percentToNextRank).toBe(0);
    expect(progress.xpToNextRank).toBe(OPERATOR_RANKS[1]!.minXp);
  });

  it('computes percent within the current rank band', () => {
    const second = OPERATOR_RANKS[1]!;
    const third = OPERATOR_RANKS[2]!;
    const midpoint = second.minXp + Math.round((third.minXp - second.minXp) / 2);
    const progress = operatorProgressForXp(midpoint);
    expect(progress.rank.index).toBe(1);
    expect(progress.percentToNextRank).toBe(50);
    expect(progress.xpToNextRank).toBe(third.minXp - midpoint);
  });

  it('caps out cleanly at the top rank', () => {
    const progress = operatorProgressForXp(10_000_000);
    expect(progress.rank.index).toBe(OPERATOR_RANKS.length - 1);
    expect(progress.nextRank).toBeNull();
    expect(progress.percentToNextRank).toBe(100);
    expect(progress.xpToNextRank).toBe(0);
  });
});

describe('totalXp', () => {
  it('sums every session across the history', () => {
    const sessions = [
      makeSession({ timestamp: 1, accuracy: 0.9, totalChars: 100, effectiveWpm: 20 }), // 297
      makeSession({ timestamp: 2, accuracy: 0.7, totalChars: 50 }), // 70
    ];
    expect(totalXp(sessions)).toBe(367);
  });
});
