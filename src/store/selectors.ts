import { isChaseTrainingRuntimeBlockingSync } from '@/lib/training/chaseSessionMachine';
import { isEchoTrainingRuntimeBlockingSync } from '@/lib/training/echoSessionMachine';
import { isGroupTrainingRuntimeBlockingSync } from '@/lib/training/groupSessionMachine';

import type { AppStore } from './create-app-store';

/**
 * True when training-like activity should block background sync / settings auto-save.
 *
 * Three runtime machines (group, echo, chase) each expose a blocking state directly.
 * A refcount lock remains only for ICR, text player, and letter preview.
 */
export const selectTrainingSessionActive = (
  state: Pick<
    AppStore,
    | 'trainingSessionLockCount'
    | 'groupTrainingRuntime'
    | 'echoTrainingRuntime'
    | 'chaseTrainingRuntime'
  >,
): boolean =>
  state.trainingSessionLockCount > 0 ||
  isGroupTrainingRuntimeBlockingSync(state.groupTrainingRuntime) ||
  isEchoTrainingRuntimeBlockingSync(state.echoTrainingRuntime) ||
  isChaseTrainingRuntimeBlockingSync(state.chaseTrainingRuntime);
