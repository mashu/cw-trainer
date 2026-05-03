/**
 * Uniform random permutation (Fisher–Yates). Returns a new array; input is not mutated.
 */
export function shuffleArray<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const atI = copy[i];
    const atJ = copy[j];
    if (atI === undefined || atJ === undefined) {
      continue;
    }
    copy[i] = atJ;
    copy[j] = atI;
  }
  return copy;
}
