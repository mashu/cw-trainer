'use client';

import { selectTrainingSessionActive, useAppStore } from '@/store';

/**
 * Reactive flag for whether any training activity should block background sync,
 * settings auto-save, or data reloads. Combines the non-group lock refcount with
 * the group runtime machine (see {@link selectTrainingSessionActive}).
 */
export function useTrainingSessionActive(): boolean {
  return useAppStore(selectTrainingSessionActive);
}
