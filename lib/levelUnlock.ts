import { MAX_DIGITS_LEVEL } from './constants';

const DIGITS_ASC: readonly string[] = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

/** Which side of mixed mode auto-level adjusts on the next qualifying session. */
export type MixedAutoLevelAxis = 'letters' | 'digits';

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
 * @deprecated Legacy coupled mixed levels — splits one level between letters and digits.
 * Mixed mode now uses independent {@link unlockedCharCountForLevel} / {@link digitsUnlockedCount}.
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

export function flipMixedAutoLevelAxis(axis: MixedAutoLevelAxis): MixedAutoLevelAxis {
  return axis === 'letters' ? 'digits' : 'letters';
}

/** Alternating letter/digit boosts applied during a Chase run (first increase is letters). */
export function mixedChaseLevelBoosts(levelOffset: number): {
  readonly letters: number;
  readonly digits: number;
} {
  const safe = Math.max(0, Math.floor(levelOffset));
  return {
    letters: Math.ceil(safe / 2),
    digits: Math.floor(safe / 2),
  };
}

/** Character that would unlock if the given mixed axis increases by one level. */
export function nextMixedUnlockPreviewChar(
  axis: MixedAutoLevelAxis,
  kochLevel: number,
  digitsLevel: number,
  sequence: readonly string[],
): string | null {
  if (axis === 'letters') {
    const nextIndex = unlockedCharCountForLevel(kochLevel);
    const nextChar = sequence[nextIndex];
    return nextChar ?? null;
  }
  const nextIndex = digitsUnlockedCount(digitsLevel);
  const nextDigit = DIGITS_ASC[nextIndex];
  return nextDigit ?? null;
}
