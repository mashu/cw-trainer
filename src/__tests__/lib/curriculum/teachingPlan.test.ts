import { buildTeachingPlan, evaluateTeachingPlan } from '@/lib/curriculum';
import { LCWO_SEQUENCE } from '@/lib/morseConstants';
import type { SessionResult } from '@/types';

const makeSession = ({
  timestamp,
  accuracy = 0.95,
  totalChars = 120,
  kochLevel,
  charWpm,
  mode,
  charSetMode,
}: {
  readonly timestamp: number;
  readonly accuracy?: number;
  readonly totalChars?: number;
  readonly kochLevel?: number;
  readonly charWpm?: number;
  readonly mode?: 'group' | 'echo' | 'chase';
  readonly charSetMode?: 'koch' | 'digits' | 'custom' | 'mixed';
}): SessionResult => ({
  date: '2026-07-01',
  timestamp,
  startedAt: timestamp - 60_000,
  finishedAt: timestamp,
  groups: [{ sent: 'KM', received: 'KM', correct: true }],
  groupTimings: [{ timeToCompleteMs: 1500 }],
  accuracy,
  letterAccuracy: { K: { correct: 1, total: 1 }, M: { correct: 1, total: 1 } },
  alphabetSize: 2,
  avgResponseMs: 1500,
  totalChars,
  effectiveAlphabetSize: 2,
  score: 100,
  ...(kochLevel !== undefined ? { kochLevel } : {}),
  ...(charWpm !== undefined ? { charWpm } : {}),
  ...(mode !== undefined ? { mode } : {}),
  ...(charSetMode !== undefined ? { charSetMode } : {}),
});

describe('buildTeachingPlan', () => {
  it('covers the whole LCWO sequence in level order', () => {
    const stages = buildTeachingPlan();
    expect(stages.length).toBeGreaterThan(0);
    const first = stages[0]!;
    expect(first.levelStart).toBe(1);
    // Level 1 unlocks two characters, so stage 1 owns K and M plus its own levels.
    expect(first.characters.slice(0, 2)).toEqual(['K', 'M']);
    const last = stages[stages.length - 1]!;
    expect(last.levelEnd).toBe(LCWO_SEQUENCE.length - 1);
    // Every character is introduced by exactly one stage.
    const allChars = stages.flatMap((s) => [...s.characters]);
    expect(allChars).toEqual([...LCWO_SEQUENCE]);
  });

  it('supports custom sequences and stage sizes', () => {
    const stages = buildTeachingPlan(['A', 'B', 'C', 'D', 'E'], 2);
    // 5 chars → levels 1..4 → stages [1-2], [3-4]
    expect(stages.map((s) => [s.levelStart, s.levelEnd])).toEqual([
      [1, 2],
      [3, 4],
    ]);
    expect(stages[0]!.characters).toEqual(['A', 'B', 'C']);
    expect(stages[1]!.characters).toEqual(['D', 'E']);
  });
});

describe('evaluateTeachingPlan', () => {
  it('marks the first stage active with no history', () => {
    const progress = evaluateTeachingPlan([], 1);
    expect(progress.activeStageIndex).toBe(0);
    expect(progress.completedStageCount).toBe(0);
    expect(progress.stages[0]!.status).toBe('active');
    expect(progress.stages[1]!.status).toBe('upcoming');
  });

  it('completes a stage after quality sessions and a passed copy test', () => {
    const sessions = [
      makeSession({ timestamp: 1, kochLevel: 5, accuracy: 0.95, totalChars: 120 }),
      makeSession({ timestamp: 2, kochLevel: 5, accuracy: 0.92, totalChars: 120 }),
    ];
    const progress = evaluateTeachingPlan(sessions, 5);
    expect(progress.stages[0]!.status).toBe('complete');
    expect(progress.activeStageIndex).toBe(1);
    expect(progress.stages[0]!.goals.every((g) => g.achieved)).toBe(true);
  });

  it('requires the copy-test volume, not just accuracy', () => {
    const sessions = [
      makeSession({ timestamp: 1, kochLevel: 5, accuracy: 0.95, totalChars: 40 }),
      makeSession({ timestamp: 2, kochLevel: 5, accuracy: 0.95, totalChars: 40 }),
    ];
    const progress = evaluateTeachingPlan(sessions, 5);
    const copyTest = progress.stages[0]!.goals.find((g) => g.id === 'copy-test')!;
    expect(copyTest.achieved).toBe(false);
    expect(progress.stages[0]!.status).toBe('active');
  });

  it('retroactively completes earlier stages from high-level sessions', () => {
    const sessions = [
      makeSession({ timestamp: 1, kochLevel: 12, accuracy: 0.95, totalChars: 150 }),
      makeSession({ timestamp: 2, kochLevel: 12, accuracy: 0.93, totalChars: 150 }),
    ];
    const progress = evaluateTeachingPlan(sessions, 12);
    expect(progress.stages[0]!.status).toBe('complete');
    expect(progress.stages[1]!.status).toBe('complete');
    expect(progress.activeStageIndex).toBe(2);
  });

  it('ignores echo/chase and digits-only sessions', () => {
    const sessions = [
      makeSession({ timestamp: 1, kochLevel: 5, mode: 'echo' }),
      makeSession({ timestamp: 2, kochLevel: 5, mode: 'chase' }),
      makeSession({ timestamp: 3, kochLevel: 5, charSetMode: 'digits' }),
    ];
    const progress = evaluateTeachingPlan(sessions, 1);
    const quality = progress.stages[0]!.goals.find((g) => g.id === 'quality-sessions')!;
    expect(quality.current).toBe(0);
  });

  it('awards speed certificates only after repeated solid-copy sessions at speed', () => {
    const oneSession = [
      makeSession({ timestamp: 1, kochLevel: 3, charWpm: 15, accuracy: 0.94, totalChars: 130 }),
    ];
    const afterOne = evaluateTeachingPlan(oneSession, 3);
    const byWpmAfterOne = new Map(afterOne.certificates.map((c) => [c.wpm, c]));
    expect(byWpmAfterOne.get(5)!.earned).toBe(false);
    expect(byWpmAfterOne.get(5)!.current).toBe(1);
    expect(byWpmAfterOne.get(13)!.current).toBe(1);
    expect(byWpmAfterOne.get(20)!.current).toBe(0);

    const threeSessions = [
      makeSession({ timestamp: 1, kochLevel: 3, charWpm: 15, accuracy: 0.94, totalChars: 130 }),
      makeSession({ timestamp: 2, kochLevel: 3, charWpm: 15, accuracy: 0.91, totalChars: 130 }),
      makeSession({ timestamp: 3, kochLevel: 3, charWpm: 14, accuracy: 0.93, totalChars: 140 }),
    ];
    const progress = evaluateTeachingPlan(threeSessions, 3);
    const byWpm = new Map(progress.certificates.map((c) => [c.wpm, c]));
    expect(byWpm.get(5)!.earned).toBe(true);
    expect(byWpm.get(13)!.earned).toBe(true);
    expect(byWpm.get(20)!.earned).toBe(false);
    expect(byWpm.get(5)!.sessionTimestamp).toBe(3);
  });

  it('does not award certificates without volume or speed data', () => {
    const sessions = [
      makeSession({ timestamp: 1, kochLevel: 3, accuracy: 0.99, totalChars: 500 }), // no charWpm
      makeSession({ timestamp: 2, kochLevel: 3, charWpm: 25, accuracy: 0.99, totalChars: 50 }), // too short
    ];
    const progress = evaluateTeachingPlan(sessions, 3);
    expect(progress.certificates.every((c) => !c.earned && c.current === 0)).toBe(true);
  });
});
