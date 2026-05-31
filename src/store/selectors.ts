import { isChaseTrainingRuntimeBlockingSync } from '@/lib/training/chaseSessionMachine';
import { isEchoTrainingRuntimeBlockingSync } from '@/lib/training/echoSessionMachine';
import { isGroupTrainingRuntimeBlockingSync } from '@/lib/training/groupSessionMachine';
import { isIcrTrainingRuntimeBlockingSync } from '@/lib/training/icrSessionMachine';
import { isPreviewPlaybackRuntimeBlockingSync } from '@/lib/training/previewPlaybackMachine';

import type { AppStore } from './create-app-store';

/**
 * True when training-like activity should block background sync / settings auto-save.
 *
 * Derived from runtime machines only — no manual lock refcount.
 */
export const selectTrainingSessionActive = (
  state: Pick<
    AppStore,
    | 'groupTrainingRuntime'
    | 'echoTrainingRuntime'
    | 'chaseTrainingRuntime'
    | 'icrTrainingRuntime'
    | 'previewPlaybackRuntime'
  >,
): boolean =>
  isGroupTrainingRuntimeBlockingSync(state.groupTrainingRuntime) ||
  isEchoTrainingRuntimeBlockingSync(state.echoTrainingRuntime) ||
  isChaseTrainingRuntimeBlockingSync(state.chaseTrainingRuntime) ||
  isIcrTrainingRuntimeBlockingSync(state.icrTrainingRuntime) ||
  isPreviewPlaybackRuntimeBlockingSync(state.previewPlaybackRuntime);
