import {
  beginGroupTrainingSession,
  cancelGroupTrainingSession,
  completeGroupTrainingSession,
  IDLE_GROUP_TRAINING_RUNTIME,
  type GroupTrainingRuntimeState,
} from '@/lib/training/groupSessionMachine';
import { selectTrainingSessionActive } from '@/store/selectors';

const state = (
  trainingSessionLockCount: number,
  groupTrainingRuntime: GroupTrainingRuntimeState,
): { trainingSessionLockCount: number; groupTrainingRuntime: GroupTrainingRuntimeState } => ({
  trainingSessionLockCount,
  groupTrainingRuntime,
});

describe('selectTrainingSessionActive', () => {
  it('is false when idle and no locks held', () => {
    expect(selectTrainingSessionActive(state(0, IDLE_GROUP_TRAINING_RUNTIME))).toBe(false);
  });

  it('is true when a non-group lock is held (echo/chase/ICR/players)', () => {
    expect(selectTrainingSessionActive(state(1, IDLE_GROUP_TRAINING_RUNTIME))).toBe(true);
  });

  it('is true when the group runtime is blocking, even with zero locks', () => {
    const running = beginGroupTrainingSession({ sessionId: 1, startedAt: Date.now() });
    expect(selectTrainingSessionActive(state(0, running))).toBe(true);
  });

  it('is false once the group runtime is cancelled back to idle', () => {
    expect(selectTrainingSessionActive(state(0, cancelGroupTrainingSession()))).toBe(false);
  });

  it('treats the group results screen as non-blocking', () => {
    const results = completeGroupTrainingSession({
      accuracy: 1,
      groups: [],
      avgResponseMs: 0,
      score: 0,
    });
    expect(selectTrainingSessionActive(state(0, results))).toBe(false);
  });
});
