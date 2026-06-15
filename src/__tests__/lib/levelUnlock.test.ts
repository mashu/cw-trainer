import {
  digitsUnlockedCount,
  mixedModeUnlockCounts,
  unlockedCharCountForLevel,
} from '@/lib/levelUnlock';

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

  it('splits mixed mode counts between letters and digits', () => {
    expect(mixedModeUnlockCounts(1)).toEqual({ letters: 1, digits: 1 });
    expect(mixedModeUnlockCounts(2)).toEqual({ letters: 2, digits: 1 });
    expect(mixedModeUnlockCounts(3)).toEqual({ letters: 2, digits: 2 });
    expect(mixedModeUnlockCounts(4)).toEqual({ letters: 3, digits: 2 });
  });
});
