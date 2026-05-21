const DIGIT_CHARS = new Set<string>(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);

export function isDigitChar(char: string): boolean {
  return DIGIT_CHARS.has(char);
}

export function splitLettersAndDigits(pool: readonly string[]): {
  readonly letters: readonly string[];
  readonly digits: readonly string[];
} {
  const letters: string[] = [];
  const digits: string[] = [];
  for (const char of pool) {
    if (isDigitChar(char)) {
      digits.push(char);
    } else {
      letters.push(char);
    }
  }
  return { letters, digits };
}

/** Default carousel index: newest character not in the previous-level pool. */
export function defaultCharPreviewIndex(
  pool: readonly string[],
  previousPool: readonly string[],
): number {
  if (pool.length === 0) {
    return 0;
  }
  const newChars = pool.filter((char) => !previousPool.includes(char));
  if (newChars.length > 0) {
    const lastNew = newChars[newChars.length - 1];
    const idx = lastNew ? pool.indexOf(lastNew) : -1;
    if (idx >= 0) {
      return idx;
    }
  }
  return pool.length - 1;
}
