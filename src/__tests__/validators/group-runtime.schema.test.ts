import { groupTrainingRuntimeSchema } from '@/lib/validators';

describe('groupTrainingRuntimeSchema', () => {
  it('accepts an idle snapshot', () => {
    expect(groupTrainingRuntimeSchema.safeParse({ status: 'idle' }).success).toBe(true);
  });

  it('accepts a results snapshot', () => {
    const result = {
      status: 'results',
      result: { accuracy: 1, groups: [], avgResponseMs: 0, score: 0 },
    };
    expect(groupTrainingRuntimeSchema.safeParse(result).success).toBe(true);
  });

  it('accepts an active snapshot', () => {
    const active = {
      status: 'waitingForAnswer',
      sessionId: 1,
      startedAt: 100,
      groups: ['KM'],
      userInput: ['K'],
      confirmedGroups: { 0: false },
      currentGroup: 0,
      currentFocusedGroup: 0,
      groupStartAt: [100],
      groupEndAt: [200],
      groupAnswerAt: [],
      audioStatus: 'running',
    };
    expect(groupTrainingRuntimeSchema.safeParse(active).success).toBe(true);
  });

  it('rejects an unknown status', () => {
    expect(groupTrainingRuntimeSchema.safeParse({ status: 'flying' }).success).toBe(false);
  });

  it('rejects an active snapshot missing required fields', () => {
    expect(
      groupTrainingRuntimeSchema.safeParse({ status: 'playingGroup', sessionId: 1 }).success,
    ).toBe(false);
  });

  it('rejects a results snapshot with a malformed result', () => {
    expect(
      groupTrainingRuntimeSchema.safeParse({ status: 'results', result: { accuracy: 'high' } })
        .success,
    ).toBe(false);
  });
});
