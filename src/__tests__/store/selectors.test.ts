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
import {
  beginIcrTrainingSession,
  IDLE_ICR_TRAINING_RUNTIME,
  type IcrTrainingRuntimeState,
} from '@/lib/training/icrSessionMachine';
import {
  beginPreviewPlayback,
  IDLE_PREVIEW_PLAYBACK_RUNTIME,
  type PreviewPlaybackRuntimeState,
} from '@/lib/training/previewPlaybackMachine';
import { selectTrainingSessionActive } from '@/store/selectors';

const state = (
  groupTrainingRuntime: GroupTrainingRuntimeState,
  echoTrainingRuntime: EchoTrainingRuntimeState = IDLE_ECHO_TRAINING_RUNTIME,
  chaseTrainingRuntime: ChaseTrainingRuntimeState = IDLE_CHASE_TRAINING_RUNTIME,
  icrTrainingRuntime: IcrTrainingRuntimeState = IDLE_ICR_TRAINING_RUNTIME,
  previewPlaybackRuntime: PreviewPlaybackRuntimeState = IDLE_PREVIEW_PLAYBACK_RUNTIME,
): {
  groupTrainingRuntime: GroupTrainingRuntimeState;
  echoTrainingRuntime: EchoTrainingRuntimeState;
  chaseTrainingRuntime: ChaseTrainingRuntimeState;
  icrTrainingRuntime: IcrTrainingRuntimeState;
  previewPlaybackRuntime: PreviewPlaybackRuntimeState;
} => ({
  groupTrainingRuntime,
  echoTrainingRuntime,
  chaseTrainingRuntime,
  icrTrainingRuntime,
  previewPlaybackRuntime,
});

describe('selectTrainingSessionActive', () => {
  it('is false when all runtimes are idle', () => {
    expect(selectTrainingSessionActive(state(IDLE_GROUP_TRAINING_RUNTIME))).toBe(false);
  });

  it('is true when preview playback is active', () => {
    const playing = beginPreviewPlayback(IDLE_PREVIEW_PLAYBACK_RUNTIME, 'letter-preview');
    expect(
      selectTrainingSessionActive(
        state(
          IDLE_GROUP_TRAINING_RUNTIME,
          IDLE_ECHO_TRAINING_RUNTIME,
          IDLE_CHASE_TRAINING_RUNTIME,
          IDLE_ICR_TRAINING_RUNTIME,
          playing,
        ),
      ),
    ).toBe(true);
  });

  it('is true when the ICR runtime is blocking', () => {
    const countdown = beginIcrTrainingSession({ sessionId: 1 });
    expect(
      selectTrainingSessionActive(
        state(
          IDLE_GROUP_TRAINING_RUNTIME,
          IDLE_ECHO_TRAINING_RUNTIME,
          IDLE_CHASE_TRAINING_RUNTIME,
          countdown,
        ),
      ),
    ).toBe(true);
  });

  it('is true when the echo runtime is blocking', () => {
    const running = beginEchoTrainingSession({ sessionId: 1, startedAt: Date.now() });
    expect(selectTrainingSessionActive(state(IDLE_GROUP_TRAINING_RUNTIME, running))).toBe(true);
  });

  it('is true when the chase runtime is blocking', () => {
    const running = beginChaseTrainingSession({
      sessionId: 1,
      startedAt: Date.now(),
      lives: 3,
    });
    expect(
      selectTrainingSessionActive(
        state(IDLE_GROUP_TRAINING_RUNTIME, IDLE_ECHO_TRAINING_RUNTIME, running),
      ),
    ).toBe(true);
  });

  it('is true when the group runtime is blocking', () => {
    const running = beginGroupTrainingSession({ sessionId: 1, startedAt: Date.now() });
    expect(selectTrainingSessionActive(state(running))).toBe(true);
  });

  it('is false once the group runtime is cancelled back to idle', () => {
    expect(selectTrainingSessionActive(state(cancelGroupTrainingSession()))).toBe(false);
  });

  it('treats the group results screen as non-blocking', () => {
    const results = completeGroupTrainingSession({
      accuracy: 1,
      groups: [],
      avgResponseMs: 0,
      score: 0,
    });
    expect(selectTrainingSessionActive(state(results))).toBe(false);
  });
});
