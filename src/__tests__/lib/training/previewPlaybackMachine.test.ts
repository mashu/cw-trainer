import {
  beginPreviewPlayback,
  endPreviewPlayback,
  IDLE_PREVIEW_PLAYBACK_RUNTIME,
  isPreviewPlaybackRuntimeBlockingSync,
} from '@/lib/training/previewPlaybackMachine';

describe('previewPlaybackMachine', () => {
  it('is not blocking when idle', () => {
    expect(isPreviewPlaybackRuntimeBlockingSync(IDLE_PREVIEW_PLAYBACK_RUNTIME)).toBe(false);
  });

  it('begins playback from idle', () => {
    const playing = beginPreviewPlayback(IDLE_PREVIEW_PLAYBACK_RUNTIME, 'text-player');
    expect(playing).toEqual({ status: 'playing', source: 'text-player' });
    expect(isPreviewPlaybackRuntimeBlockingSync(playing)).toBe(true);
  });

  it('does not replace an existing playback source', () => {
    const playing = beginPreviewPlayback(
      { status: 'playing', source: 'letter-preview' },
      'text-player',
    );
    expect(playing).toEqual({ status: 'playing', source: 'letter-preview' });
  });

  it('ends playback only for matching source', () => {
    const playing = beginPreviewPlayback(IDLE_PREVIEW_PLAYBACK_RUNTIME, 'text-player-modal');
    expect(endPreviewPlayback(playing, 'text-player')).toBe(playing);
    expect(endPreviewPlayback(playing, 'text-player-modal')).toEqual(IDLE_PREVIEW_PLAYBACK_RUNTIME);
  });
});
