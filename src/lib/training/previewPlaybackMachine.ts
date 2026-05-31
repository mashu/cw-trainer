export type PreviewPlaybackSource = 'letter-preview' | 'text-player' | 'text-player-modal';

export type PreviewPlaybackRuntimeState =
  | { readonly status: 'idle' }
  | { readonly status: 'playing'; readonly source: PreviewPlaybackSource };

export const IDLE_PREVIEW_PLAYBACK_RUNTIME: PreviewPlaybackRuntimeState = {
  status: 'idle',
} as const;

export const isPreviewPlaybackRuntimeBlockingSync = (
  state: PreviewPlaybackRuntimeState,
): boolean => state.status === 'playing';

export function beginPreviewPlayback(
  state: PreviewPlaybackRuntimeState,
  source: PreviewPlaybackSource,
): PreviewPlaybackRuntimeState {
  if (state.status === 'playing') {
    return state;
  }
  return { status: 'playing', source };
}

export function endPreviewPlayback(
  state: PreviewPlaybackRuntimeState,
  source: PreviewPlaybackSource,
): PreviewPlaybackRuntimeState {
  if (state.status === 'idle' || state.source !== source) {
    return state;
  }
  return IDLE_PREVIEW_PLAYBACK_RUNTIME;
}

export function cancelPreviewPlayback(): PreviewPlaybackRuntimeState {
  return IDLE_PREVIEW_PLAYBACK_RUNTIME;
}
