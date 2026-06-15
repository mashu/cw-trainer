import { MAX_DIGITS_LEVEL } from './constants';

/** Total characters unlocked at training level L (level 1 → 2 characters). */
export function unlockedCharCountForLevel(level: number): number {
  const safeLevel = Math.max(1, Math.floor(level));
  return safeLevel + 1;
}

/** Digits unlocked at digits level L (level 1 → digits 0–1). */
export function digitsUnlockedCount(level: number): number {
  return Math.min(unlockedCharCountForLevel(level), MAX_DIGITS_LEVEL);
}

/**
 * Mixed mode splits `level + 1` total characters between letters and digits.
 * Level 1 → 1 letter + 1 digit; level 2 → 2 letters + 1 digit; etc.
 */
export function mixedModeUnlockCounts(level: number): {
  readonly letters: number;
  readonly digits: number;
} {
  const total = unlockedCharCountForLevel(level);
  return {
    letters: Math.max(1, Math.ceil(total / 2)),
    digits: Math.max(1, Math.floor(total / 2)),
  };
}
