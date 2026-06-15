/** When one direction is set to 0 it is disabled; at least one direction must stay enabled. */
export function normalizeAutoAdjustDirectionCounts(
  above: number,
  below: number,
): { readonly above: number; readonly below: number } {
  const safeAbove = Math.max(0, Math.floor(above));
  const safeBelow = Math.max(0, Math.floor(below));
  if (safeAbove === 0 && safeBelow === 0) {
    return { above: 1, below: 1 };
  }
  return { above: safeAbove, below: safeBelow };
}

export function applyAutoAdjustDirectionCountChange(
  above: number,
  below: number,
  field: 'above' | 'below',
  nextValue: number,
): { readonly above: number; readonly below: number } {
  const safeNext = Math.max(0, Math.floor(nextValue));
  if (field === 'above') {
    if (safeNext === 0 && below === 0) {
      return { above: 0, below: 1 };
    }
    return { above: safeNext, below };
  }
  if (safeNext === 0 && above === 0) {
    return { above: 1, below: 0 };
  }
  return { above, below: safeNext };
}
