import {
  attemptedStageForLevel,
  buildTeachingPlan,
  evaluateSessionSpeedRun,
  evaluateSpeedCertificateMatrix,
} from '@/lib/curriculum';
import type { SessionResult, SessionGroup, SessionTiming } from '@/types';

/** Build a session from parallel groups/timings; defaults to a full-alphabet level. */
const makeSession = ({
  timestamp,
  groups,
  timings,
  kochLevel = 40,
  sessionCharWpm,
  mode,
}: {
  readonly timestamp: number;
  readonly groups: readonly SessionGroup[];
  readonly timings: readonly SessionTiming[];
  readonly kochLevel?: number;
  readonly sessionCharWpm?: number;
  readonly mode?: 'group' | 'echo' | 'chase';
}): SessionResult => ({
  date: '2026-07-01',
  timestamp,
  startedAt: timestamp - 60_000,
  finishedAt: timestamp,
  groups: [...groups],
  groupTimings: [...timings],
  accuracy: 1,
  letterAccuracy: {},
  alphabetSize: 26,
  avgResponseMs: 1500,
  totalChars: groups.reduce((sum, g) => sum + g.sent.length, 0),
  effectiveAlphabetSize: 26,
  score: 100,
  kochLevel,
  ...(sessionCharWpm !== undefined ? { charWpm: sessionCharWpm } : {}),
  ...(mode !== undefined ? { mode } : {}),
});

const correctGroup = (sent: string): SessionGroup => ({ sent, received: sent, correct: true });

/** N correct 5-char groups at the given per-group speed. */
const groupsAtSpeed = (
  count: number,
  wpm: number,
): { groups: SessionGroup[]; timings: SessionTiming[] } => ({
  groups: Array.from({ length: count }, () => correctGroup('KMURE')),
  timings: Array.from({ length: count }, () => ({ timeToCompleteMs: 1000, charWpm: wpm })),
});

describe('evaluateSessionSpeedRun', () => {
  it('counts only characters from groups played at or above the certificate speed', () => {
    const fast = groupsAtSpeed(10, 20); // 50 chars at 20 WPM
    const slow = groupsAtSpeed(10, 10); // 50 chars at 10 WPM
    const session = makeSession({
      timestamp: 1,
      groups: [...fast.groups, ...slow.groups],
      timings: [...fast.timings, ...slow.timings],
    });
    const at20 = evaluateSessionSpeedRun(session, 20);
    expect(at20.totalChars).toBe(50);
    const at10 = evaluateSessionSpeedRun(session, 10);
    expect(at10.totalChars).toBe(100);
  });

  it('requires 100 correct at-speed characters within the single session', () => {
    const nineteen = groupsAtSpeed(19, 20); // 95 chars — just short
    const short = makeSession({ timestamp: 1, groups: nineteen.groups, timings: nineteen.timings });
    expect(evaluateSessionSpeedRun(short, 20).achieved).toBe(false);

    const twenty = groupsAtSpeed(20, 20); // 100 chars
    const enough = makeSession({ timestamp: 2, groups: twenty.groups, timings: twenty.timings });
    expect(evaluateSessionSpeedRun(enough, 20).achieved).toBe(true);
  });

  it('requires at-speed accuracy, not just volume', () => {
    const { groups, timings } = groupsAtSpeed(30, 20); // 150 chars
    const flawed = groups.map((g, i) =>
      i < 10 ? { sent: g.sent, received: 'XXXXX', correct: false } : g,
    );
    const session = makeSession({ timestamp: 1, groups: flawed, timings });
    const run = evaluateSessionSpeedRun(session, 20);
    expect(run.correctChars).toBe(100);
    expect(run.accuracy).toBeCloseTo(100 / 150);
    expect(run.achieved).toBe(false); // 67% at-speed accuracy < 90%
  });

  it('falls back to the session-level speed snapshot for legacy sessions', () => {
    const groups = Array.from({ length: 25 }, () => correctGroup('KMURE'));
    const timings = groups.map(() => ({ timeToCompleteMs: 1000 })); // no per-group speed
    const legacy = makeSession({ timestamp: 1, groups, timings, sessionCharWpm: 15 });
    expect(evaluateSessionSpeedRun(legacy, 13).achieved).toBe(true);
    expect(evaluateSessionSpeedRun(legacy, 20).totalChars).toBe(0);
  });
});

describe('evaluateSpeedCertificateMatrix', () => {
  const plan = buildTeachingPlan();

  it('credits the stage bracket the session level reaches, and all below it', () => {
    const { groups, timings } = groupsAtSpeed(25, 13);
    const sessions = [makeSession({ timestamp: 1, groups, timings, kochLevel: 12 })];
    const matrix = evaluateSpeedCertificateMatrix(sessions, plan);
    // Level 12 covers stages with exit level <= 12 (stages 1 and 2)
    expect(matrix.rows[0]!.cells.find((c) => c.speed === 13)!.earned).toBe(true);
    expect(matrix.rows[1]!.cells.find((c) => c.speed === 13)!.earned).toBe(true);
    expect(matrix.rows[2]!.cells.find((c) => c.speed === 13)!.earned).toBe(false);
    // Faster speeds not earned
    expect(matrix.rows[0]!.cells.find((c) => c.speed === 20)!.earned).toBe(false);
  });

  it('tracks the best near-miss attempt for progress display', () => {
    const { groups, timings } = groupsAtSpeed(15, 20); // 75 correct chars — short of 100
    const sessions = [makeSession({ timestamp: 1, groups, timings, kochLevel: 40 })];
    const matrix = evaluateSpeedCertificateMatrix(sessions, plan);
    const lastRow = matrix.rows[matrix.rows.length - 1]!;
    const cell = lastRow.cells.find((c) => c.speed === 20)!;
    expect(cell.earned).toBe(false);
    expect(cell.bestCorrectChars).toBe(75);
  });

  it('marks full-alphabet certificates from the final stage row', () => {
    const { groups, timings } = groupsAtSpeed(20, 20);
    const sessions = [makeSession({ timestamp: 1, groups, timings, kochLevel: 40 })];
    const matrix = evaluateSpeedCertificateMatrix(sessions, plan);
    expect(matrix.fullAlphabetEarnedSpeeds).toEqual([5, 13, 20]);
  });

  it('ignores echo/chase sessions', () => {
    const { groups, timings } = groupsAtSpeed(20, 20);
    const sessions = [makeSession({ timestamp: 1, groups, timings, mode: 'echo' })];
    const matrix = evaluateSpeedCertificateMatrix(sessions, plan);
    expect(matrix.earnedCount).toBe(0);
  });
});

describe('attemptedStageForLevel', () => {
  const plan = buildTeachingPlan();

  it('returns the highest stage whose exit level is reached', () => {
    expect(attemptedStageForLevel(plan, 3)).toBeNull(); // below first exit level (5)
    expect(attemptedStageForLevel(plan, 5)!.index).toBe(0);
    expect(attemptedStageForLevel(plan, 12)!.index).toBe(1);
    expect(attemptedStageForLevel(plan, 40)!.index).toBe(plan.length - 1);
  });
});
