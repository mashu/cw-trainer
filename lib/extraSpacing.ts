/** Minimum multiplier for {@link extraWordSpaceMultiplier} (settings key name is historical). */
export const EXTRA_SPACING_MULTIPLIER_MIN = 0.1;

/** User-facing label — same timing applies between groups (Group/Echo) and at spaces (Player). */
export const EXTRA_SPACING_LABEL = 'Extra spacing';

export const EXTRA_SPACING_SETTINGS_HELP =
  'Multiplies the standard Morse word-space pause (7 units at effective speed). ' +
  'Applies between groups in Group/Echo and at spaces between words in Player. ' +
  '1 = standard; below 1 = tighter; above 1 = longer.';

export function clampExtraSpacingMultiplier(
  value: number | undefined | null,
): number {
  return Math.max(EXTRA_SPACING_MULTIPLIER_MIN, value ?? 1);
}
