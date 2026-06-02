import { decideGroupLoopTeardown } from '@/lib/training/groupLoopTeardown';

describe('decideGroupLoopTeardown', () => {
  const base = {
    superseded: false,
    aborted: false,
    resultsProcessed: false,
    endedDueToPlaybackIssue: false,
  } as const;

  it('is inert whenever a newer session has taken over, regardless of other flags', () => {
    expect(decideGroupLoopTeardown({ ...base, superseded: true })).toBe('inert');
    expect(
      decideGroupLoopTeardown({
        superseded: true,
        aborted: true,
        resultsProcessed: true,
        endedDueToPlaybackIssue: true,
      }),
    ).toBe('inert');
  });

  it('completes a clean, unaborted finish', () => {
    expect(decideGroupLoopTeardown(base)).toBe('completing');
  });

  it('preserves an already-processed (submitted) session', () => {
    expect(decideGroupLoopTeardown({ ...base, aborted: true, resultsProcessed: true })).toBe(
      'preserve',
    );
  });

  it('preserves a failed runtime after a playback issue', () => {
    expect(
      decideGroupLoopTeardown({ ...base, aborted: true, endedDueToPlaybackIssue: true }),
    ).toBe('preserve');
  });

  it('cancels (returns to home) when aborted before any results, e.g. Stop', () => {
    expect(decideGroupLoopTeardown({ ...base, aborted: true })).toBe('cancel');
  });
});
