import { isGroupTrainingRuntimeBlockingSync } from '@/lib/training/groupSessionMachine';

import type { AppStore } from './create-app-store';

/**
 * True when training-like activity should block background sync / settings auto-save.
 *
 * Two independent sources are OR'd:
 * - A non-group feature holds a refcount lock (echo, chase, ICR, text/letter players)
 *   via `trainingSessionLockCount`.
 * - The group training runtime machine is in a blocking state.
 *
 * Group training does NOT take a manual lock — its blocking state is derived directly
 * from `groupTrainingRuntime`, so the lock count and the machine can never desync.
 */
export const selectTrainingSessionActive = (
  state: Pick<AppStore, 'trainingSessionLockCount' | 'groupTrainingRuntime'>,
): boolean =>
  state.trainingSessionLockCount > 0 ||
  isGroupTrainingRuntimeBlockingSync(state.groupTrainingRuntime);
