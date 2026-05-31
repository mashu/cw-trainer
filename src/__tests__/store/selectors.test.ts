import {
  beginChaseTrainingSession,
  IDLE_CHASE_TRAINING_RUNTIME,
  type ChaseTrainingRuntimeState,
} from '@/lib/training/chaseSessionMachine';
import {
  beginEchoTrainingSession,
  IDLE_ECHO_TRAINING_RUNTIME,
  type EchoTrainingRuntimeState,
} from '@/lib/training/echoSessionMachine';
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
  echoTrainingRuntime: EchoTrainingRuntimeState = IDLE_ECHO_TRAINING_RUNTIME,
  chaseTrainingRuntime: ChaseTrainingRuntimeState = IDLE_CHASE_TRAINING_RUNTIME,
): {
  trainingSessionLockCount: number;
  groupTrainingRuntime: GroupTrainingRuntimeState;
  echoTrainingRuntime: EchoTrainingRuntimeState;
  chaseTrainingRuntime: ChaseTrainingRuntimeState;
} => ({
  trainingSessionLockCount,
  groupTrainingRuntime,
  echoTrainingRuntime,
  chaseTrainingRuntime,
});

describe('selectTrainingSessionActive', () => {
  it('is false when idle and no locks held', () => {
    expect(selectTrainingSessionActive(state(0, IDLE_GROUP_TRAINING_RUNTIME))).toBe(false);
  });

  it('is true when a preview/player lock is held (ICR/text/letter)', () => {
    expect(selectTrainingSessionActive(state(1, IDLE_GROUP_TRAINING_RUNTIME))).toBe(true);
  });

  it('is true when the echo runtime is blocking, even with zero locks', () => {
    const running = beginEchoTrainingSession({ sessionId: 1, startedAt: Date.now() });
    expect(selectTrainingSessionActive(state(0, IDLE_GROUP_TRAINING_RUNTIME, running))).toBe(true);
  });

  it('is true when the chase runtime is blocking, even with zero locks', () => {
    const running = beginChaseTrainingSession({
      sessionId: 1,
      startedAt: Date.now(),
      lives: 3,
    });
    expect(
      selectTrainingSessionActive(
        state(0, IDLE_GROUP_TRAINING_RUNTIME, IDLE_ECHO_TRAINING_RUNTIME, running),
      ),
    ).toBe(true);
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
