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
  sentCharacters = LCWO_SEQUENCE,
}: {
  readonly timestamp: number;
  readonly accuracy?: number;
  readonly totalChars?: number;
  readonly kochLevel?: number;
  readonly charWpm?: number;
  readonly mode?: 'group' | 'echo' | 'chase';
  readonly charSetMode?: 'koch' | 'digits' | 'custom' | 'mixed';
  readonly sentCharacters?: readonly string[];
}): SessionResult => ({
  date: '2026-07-01',
  timestamp,
  startedAt: timestamp - 60_000,
  finishedAt: timestamp,
  groups: [
    {
      sent: sentCharacters.join(''),
      received: sentCharacters.join(''),
      correct: true,
    },
  ],
  groupTimings: [{ timeToCompleteMs: 1500 }],
  accuracy,
  letterAccuracy: {},
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

  it('uses sent groups rather than letter accuracy as proof of stage coverage', () => {
    const sessions = [
      {
        ...makeSession({
          timestamp: 1,
          kochLevel: 5,
          sentCharacters: ['K', 'M'],
        }),
        letterAccuracy: Object.fromEntries(
          LCWO_SEQUENCE.map((character) => [character, { correct: 1, total: 1 }]),
        ),
      },
      {
        ...makeSession({
          timestamp: 2,
          kochLevel: 5,
          sentCharacters: ['K', 'M'],
        }),
        letterAccuracy: Object.fromEntries(
          LCWO_SEQUENCE.map((character) => [character, { correct: 1, total: 1 }]),
        ),
      },
    ];
    const progress = evaluateTeachingPlan(sessions, 5);

    expect(progress.stages[0]!.status).toBe('active');
    expect(progress.stages[0]!.goals.every((goal) => goal.achieved)).toBe(false);
    expect(progress.stages[0]!.coverage.missingCharacters).toEqual(['U', 'R', 'E', 'S']);
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

  it('exposes the speed-certificate matrix with one row per stage', () => {
    const progress = evaluateTeachingPlan([], 1);
    expect(progress.certificates.rows.length).toBe(progress.stages.length);
    expect(progress.certificates.earnedCount).toBe(0);
    expect(progress.certificates.rows[0]!.cells.map((c) => c.speed)).toEqual([5, 13, 20]);
  });
});
