import { trainingModeFromSearch } from '@/lib/utils/trainingModeFromUrl';

describe('trainingModeFromSearch', () => {
  it('returns undefined for empty or missing mode', () => {
    expect(trainingModeFromSearch('')).toBeUndefined();
    expect(trainingModeFromSearch('?other=1')).toBeUndefined();
  });

  it('parses valid mode values', () => {
    expect(trainingModeFromSearch('?mode=icr')).toBe('icr');
    expect(trainingModeFromSearch('?mode=group')).toBe('group');
    expect(trainingModeFromSearch('?mode=echo')).toBe('echo');
    expect(trainingModeFromSearch('?mode=player')).toBe('player');
  });

  it('rejects unknown mode values', () => {
    expect(trainingModeFromSearch('?mode=foo')).toBeUndefined();
  });
});
