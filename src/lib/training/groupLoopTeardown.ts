/**
 * Pure decision for what a group-training playback loop should do once it exits.
 *
 * The playback loop in `useTrainingSession` is a detached async routine whose store
 * writes and audio teardown run against state that is *shared* across sessions. If a
 * newer session takes ownership (e.g. the user pressed "Train Again" before a stale
 * loop finished unwinding), the stale loop must become completely inert — otherwise
 * its teardown would cancel the live session (bouncing the UI back to the home screen)
 * and clear the new session's audio, while audio it scheduled keeps playing. This was
 * the single most common training regression; encoding the decision as a pure,
 * unit-tested function keeps it from silently regressing again.
 */
export type GroupLoopTeardownDecision =
  /** A newer session owns the runtime/audio — do nothing at all. */
  | 'inert'
  /** Clean finish — transition to `completing` and process results. */
  | 'completing'
  /** Aborted before any results (e.g. Stop) — return the runtime to idle/home. */
  | 'cancel'
  /** Results already shown, or a playback failure left a `failed` runtime — keep it. */
  | 'preserve';

export interface GroupLoopTeardownInput {
  /** True when a newer `startTraining` has taken over (its sessionId differs from this loop's). */
  readonly superseded: boolean;
  /** True when this loop's abort flag was set (Stop, Submit, visibility, or playback issue). */
  readonly aborted: boolean;
  /** True once `processResults` has already run for this session (e.g. via Submit). */
  readonly resultsProcessed: boolean;
  /** True when playback failed/suspended and a `failed` runtime should stay visible. */
  readonly endedDueToPlaybackIssue: boolean;
}

/**
 * Decide how a finished playback loop should tear down. The `superseded` check comes
 * first and is the load-bearing guarantee: a stale loop never mutates shared session
 * or audio state once a newer session exists.
 */
export function decideGroupLoopTeardown(
  input: GroupLoopTeardownInput,
): GroupLoopTeardownDecision {
  if (input.superseded) {
    return 'inert';
  }
  if (!input.aborted && !input.resultsProcessed) {
    return 'completing';
  }
  if (input.resultsProcessed || input.endedDueToPlaybackIssue) {
    return 'preserve';
  }
  return 'cancel';
}
