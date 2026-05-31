import {
  beginChaseTrainingSession,
  cancelChaseTrainingSession,
  completeChaseTrainingSession,
  isChaseTrainingRuntimeActive,
  isChaseTrainingRuntimeBlockingSync,
} from '@/lib/training/chaseSessionMachine';

describe('chaseSessionMachine', () => {
  it('blocks sync while running and clears after cancel or results', () => {
    const running = beginChaseTrainingSession({ sessionId: 1, startedAt: 100, lives: 3 });
    expect(isChaseTrainingRuntimeActive(running)).toBe(true);
    expect(isChaseTrainingRuntimeBlockingSync(running)).toBe(true);

    const results = completeChaseTrainingSession({
      accuracy: 0.5,
      groups: [],
      avgResponseMs: 0,
      score: 10,
      maxLevel: 2,
      survivedMs: 1000,
      bestStreak: 3,
      livesLost: 3,
    });
    expect(isChaseTrainingRuntimeBlockingSync(results)).toBe(false);
    expect(cancelChaseTrainingSession().status).toBe('idle');
  });
});
