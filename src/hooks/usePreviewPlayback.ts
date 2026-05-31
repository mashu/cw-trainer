import { useCallback, useRef } from 'react';

import type { PreviewPlaybackSource } from '@/lib/training/previewPlaybackMachine';
import { useAppStore } from '@/store';

/**
 * One owner for preview/text-player playback blocking sync — pairs a single begin with a single end.
 */
export function usePreviewPlayback(source: PreviewPlaybackSource): {
  readonly takePlayback: () => void;
  readonly releasePlayback: () => void;
} {
  const beginPreviewPlayback = useAppStore((s) => s.beginPreviewPlayback);
  const endPreviewPlayback = useAppStore((s) => s.endPreviewPlayback);
  const heldRef = useRef(false);

  const takePlayback = useCallback((): void => {
    if (!heldRef.current) {
      beginPreviewPlayback(source);
      heldRef.current = true;
    }
  }, [beginPreviewPlayback, source]);

  const releasePlayback = useCallback((): void => {
    if (heldRef.current) {
      endPreviewPlayback(source);
      heldRef.current = false;
    }
  }, [endPreviewPlayback, source]);

  return { takePlayback, releasePlayback };
}
