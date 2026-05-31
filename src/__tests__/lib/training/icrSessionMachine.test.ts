import {
  beginIcrTrainingSession,
  cancelIcrTrainingSession,
  IDLE_ICR_TRAINING_RUNTIME,
  isIcrTrainingRuntimeBlockingSync,
  setIcrCountdown,
  setIcrRunning,
} from '@/lib/training/icrSessionMachine';

describe('icrSessionMachine', () => {
  it('is not blocking when idle', () => {
    expect(isIcrTrainingRuntimeBlockingSync(IDLE_ICR_TRAINING_RUNTIME)).toBe(false);
  });

  it('is blocking during countdown and running', () => {
    const countdown = beginIcrTrainingSession({ sessionId: 1 });
    expect(isIcrTrainingRuntimeBlockingSync(countdown)).toBe(true);
    expect(setIcrCountdown(countdown, 2)).toEqual({
      status: 'countdown',
      sessionId: 1,
      countdown: 2,
    });
    const running = setIcrRunning(countdown);
    expect(running).toEqual({ status: 'running', sessionId: 1 });
    expect(isIcrTrainingRuntimeBlockingSync(running)).toBe(true);
  });

  it('cancels back to idle', () => {
    expect(cancelIcrTrainingSession()).toEqual(IDLE_ICR_TRAINING_RUNTIME);
  });
});
