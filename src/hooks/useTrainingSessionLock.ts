'use client';

import { useCallback, useRef } from 'react';

import { useAppStore } from '@/store';

/**
 * One refcount “owner” for {@link acquireTrainingSessionLock} / {@link releaseTrainingSessionLock}:
 * pairs a single acquire with a single release so overlapping features don’t imbalance the global count.
 */
export function useTrainingSessionLock(): {
  readonly takeLock: () => void;
  readonly releaseLock: () => void;
} {
  const acquireTrainingSessionLock = useAppStore((s) => s.acquireTrainingSessionLock);
  const releaseTrainingSessionLock = useAppStore((s) => s.releaseTrainingSessionLock);
  const heldRef = useRef(false);

  const takeLock = useCallback((): void => {
    if (!heldRef.current) {
      acquireTrainingSessionLock();
      heldRef.current = true;
    }
  }, [acquireTrainingSessionLock]);

  const releaseLock = useCallback((): void => {
    if (heldRef.current) {
      releaseTrainingSessionLock();
      heldRef.current = false;
    }
  }, [releaseTrainingSessionLock]);

  return { takeLock, releaseLock };
}
