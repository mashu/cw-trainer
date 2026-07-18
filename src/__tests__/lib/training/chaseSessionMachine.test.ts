import {
  beginChaseTrainingSession,
  cancelChaseTrainingSession,
  completeChaseTrainingSession,
  isChaseTrainingRuntimeActive,
  isChaseTrainingRuntimeBlockingSync,
  patchChaseTrainingRuntime,
} from '@/lib/training/chaseSessionMachine';

describe('chaseSessionMachine', () => {
  it('blocks sync while running and clears after cancel or results', () => {
    const running = beginChaseTrainingSession({ sessionId: 1, startedAt: 100, startWpm: 15 });
    expect(isChaseTrainingRuntimeActive(running)).toBe(true);
    expect(isChaseTrainingRuntimeBlockingSync(running)).toBe(true);

    const results = completeChaseTrainingSession({
      accuracy: 0.5,
      score: 10,
      maxLevel: 2,
      durationMs: 1000,
      bestCombo: 3,
      lettersTotal: 8,
      correctCount: 4,
      wrongCount: 2,
      missedCount: 2,
      peakWpm: 18,
      avgResponseMs: 700,
      letters: [{ char: 'K', typed: 'K', outcome: 'correct' }],
    });
    expect(isChaseTrainingRuntimeBlockingSync(results)).toBe(false);
    expect(cancelChaseTrainingSession().status).toBe('idle');
  });

  it('patches karaoke runtime fields only while active', () => {
    const running = beginChaseTrainingSession({ sessionId: 1, startedAt: 100, startWpm: 15 });
    const patched = patchChaseTrainingRuntime(running, {
      wpm: 18.5,
      calm: true,
      combo: 4,
      notes: [
        {
          id: 0,
          char: 'K',
          laneIndex: 3,
          toneHz: 450,
          spawnedAt: 100,
          hitAt: 2100,
          windowEndAt: 4100,
          status: 'heard',
        },
      ],
    });
    if (patched.status === 'idle' || patched.status === 'results') {
      throw new Error('expected an active snapshot after patching');
    }
    expect(patched.wpm).toBe(18.5);
    expect(patched.calm).toBe(true);
    expect(patched.combo).toBe(4);
    expect(patched.notes).toHaveLength(1);

    expect(patchChaseTrainingRuntime({ status: 'idle' }, { wpm: 20 }).status).toBe('idle');
  });
});
