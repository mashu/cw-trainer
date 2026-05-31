'use client';

import { useCallback, useEffect, useRef } from 'react';

import type { PreviewPlaybackSource } from '@/lib/training/previewPlaybackMachine';
import { useAppStore } from '@/store';

/**
 * Owns one preview/text-player blocking-sync slot for a component instance.
 * Pairs begin/end in the hook and auto-releases on unmount so callers only
 * need {@link stopPlayback} on explicit stop/complete/error paths.
 */
export function usePreviewPlayback(source: PreviewPlaybackSource): {
  readonly startPlayback: () => void;
  readonly stopPlayback: () => void;
} {
  const beginPreviewPlayback = useAppStore((s) => s.beginPreviewPlayback);
  const endPreviewPlayback = useAppStore((s) => s.endPreviewPlayback);
  const heldRef = useRef(false);

  const stopPlayback = useCallback((): void => {
    if (heldRef.current) {
      endPreviewPlayback(source);
      heldRef.current = false;
    }
  }, [endPreviewPlayback, source]);

  const startPlayback = useCallback((): void => {
    if (!heldRef.current) {
      beginPreviewPlayback(source);
      heldRef.current = true;
    }
  }, [beginPreviewPlayback, source]);

  useEffect(() => {
    return (): void => {
      if (heldRef.current) {
        endPreviewPlayback(source);
        heldRef.current = false;
      }
    };
  }, [endPreviewPlayback, source]);

  return { startPlayback, stopPlayback };
}
