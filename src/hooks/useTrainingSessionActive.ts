'use client';

import { selectTrainingSessionActive, useAppStore } from '@/store';

/**
 * Reactive flag for whether any training activity should block background sync,
 * settings auto-save, or data reloads. Combines preview/player lock refcount with
 * group, echo, and chase runtime machines (see {@link selectTrainingSessionActive}).
 */
export function useTrainingSessionActive(): boolean {
  return useAppStore(selectTrainingSessionActive);
}
