'use client';

import { selectTrainingSessionActive, useAppStore } from '@/store';

/**
 * Reactive flag for whether any training activity should block background sync,
 * settings auto-save, or data reloads. Derived from runtime machines only
 * (see {@link selectTrainingSessionActive}).
 */
export function useTrainingSessionActive(): boolean {
  return useAppStore(selectTrainingSessionActive);
}
