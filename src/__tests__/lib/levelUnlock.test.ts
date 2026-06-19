import {
  digitsUnlockedCount,
  flipMixedAutoLevelAxis,
  mixedChaseLevelBoosts,
  mixedModeUnlockCounts,
  nextMixedUnlockPreviewChar,
  unlockedCharCountForLevel,
} from '@/lib/levelUnlock';
import { LCWO_SEQUENCE } from '@/lib/morseConstants';

describe('levelUnlock', () => {
  it('unlocks level + 1 characters for alphabet/digits levels', () => {
    expect(unlockedCharCountForLevel(1)).toBe(2);
    expect(unlockedCharCountForLevel(2)).toBe(3);
    expect(unlockedCharCountForLevel(5)).toBe(6);
  });

  it('caps digits unlock at 10', () => {
    expect(digitsUnlockedCount(1)).toBe(2);
    expect(digitsUnlockedCount(9)).toBe(10);
    expect(digitsUnlockedCount(10)).toBe(10);
  });

  it('splits legacy coupled mixed mode counts between letters and digits', () => {
    expect(mixedModeUnlockCounts(1)).toEqual({ letters: 1, digits: 1 });
    expect(mixedModeUnlockCounts(2)).toEqual({ letters: 2, digits: 1 });
    expect(mixedModeUnlockCounts(3)).toEqual({ letters: 2, digits: 2 });
    expect(mixedModeUnlockCounts(4)).toEqual({ letters: 3, digits: 2 });
  });

  it('flips mixed auto-level axis', () => {
    expect(flipMixedAutoLevelAxis('letters')).toBe('digits');
    expect(flipMixedAutoLevelAxis('digits')).toBe('letters');
  });

  it('alternates chase boosts between letters and digits', () => {
    expect(mixedChaseLevelBoosts(0)).toEqual({ letters: 0, digits: 0 });
    expect(mixedChaseLevelBoosts(1)).toEqual({ letters: 1, digits: 0 });
    expect(mixedChaseLevelBoosts(2)).toEqual({ letters: 1, digits: 1 });
    expect(mixedChaseLevelBoosts(3)).toEqual({ letters: 2, digits: 1 });
  });

  it('previews the next mixed unlock character per axis', () => {
    expect(nextMixedUnlockPreviewChar('letters', 1, 1, LCWO_SEQUENCE)).toBe('U');
    expect(nextMixedUnlockPreviewChar('digits', 1, 1, LCWO_SEQUENCE)).toBe('2');
  });
});
