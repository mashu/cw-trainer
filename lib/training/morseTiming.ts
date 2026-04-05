import type { TrainingSettings } from '@/types';

/** PARIS-style dot duration in ms from character speed bounds (same formula as echo training). */
export function computeMorseDotMsFromSettings(
  settings: Pick<TrainingSettings, 'charWpmMin' | 'charWpmMax'>,
): number {
  const min = Math.max(1, settings.charWpmMin);
  const max = Math.max(min, settings.charWpmMax);
  return 1200 / Math.max(1, Math.round((min + max) / 2));
}
