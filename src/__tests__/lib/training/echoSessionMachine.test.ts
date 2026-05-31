import {
  beginEchoTrainingSession,
  cancelEchoTrainingSession,
  completeEchoTrainingSession,
  isEchoTrainingRuntimeActive,
  isEchoTrainingRuntimeBlockingSync,
} from '@/lib/training/echoSessionMachine';

describe('echoSessionMachine', () => {
  it('blocks sync while running and clears after cancel or results', () => {
    const running = beginEchoTrainingSession({ sessionId: 1, startedAt: 100 });
    expect(isEchoTrainingRuntimeActive(running)).toBe(true);
    expect(isEchoTrainingRuntimeBlockingSync(running)).toBe(true);

    const results = completeEchoTrainingSession({
      accuracy: 1,
      groups: [],
      avgResponseMs: 0,
      score: 0,
      sendingScore: 0,
      correctCharacters: 1,
      incorrectCharacters: 0,
    });
    expect(isEchoTrainingRuntimeBlockingSync(results)).toBe(false);
    expect(cancelEchoTrainingSession().status).toBe('idle');
  });
});
