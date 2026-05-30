export type ActivityHeatmapColorMode = 'volume' | 'accuracy';

export const ACTIVITY_HEATMAP_EMPTY_COLOR = '#e5e7eb';

export const ACTIVITY_HEATMAP_NO_ACCURACY_COLOR = '#cbd5e1';

/** Red (0) → green (120) on a fixed 0–1 scale. */
export function hslFromNormalizedValue(n: number): string {
  const clamped = Math.min(1, Math.max(0, n));
  const hue = 120 * clamped;
  return `hsl(${hue}, 75%, 45%)`;
}

export function computeColorForCount(count: number, maxCount: number): string {
  if (count <= 0) return ACTIVITY_HEATMAP_EMPTY_COLOR;
  const n = Math.min(1, count / Math.max(1, maxCount));
  return hslFromNormalizedValue(n);
}

export function computeColorForAccuracy(
  sessionCount: number,
  avgAccuracy: number | undefined,
): string {
  if (sessionCount <= 0) return ACTIVITY_HEATMAP_EMPTY_COLOR;
  if (avgAccuracy === undefined) return ACTIVITY_HEATMAP_NO_ACCURACY_COLOR;
  return hslFromNormalizedValue(avgAccuracy);
}

export type ActivityCellColorInput = {
  readonly count: number;
  readonly sessionCount: number;
  readonly maxCountInWindow: number;
  readonly avgAccuracy?: number | undefined;
};

export function computeActivityCellColor(
  mode: ActivityHeatmapColorMode,
  input: ActivityCellColorInput,
): string {
  if (mode === 'volume') {
    return computeColorForCount(input.count, input.maxCountInWindow);
  }
  return computeColorForAccuracy(input.sessionCount, input.avgAccuracy);
}

export function volumeLegendStops(maxCountInWindow: number): readonly number[] {
  const step = Math.max(1, Math.ceil(maxCountInWindow / 3));
  return [0, step, step * 2, maxCountInWindow] as const;
}

export const ACCURACY_LEGEND_STOPS = [0, 0.5, 0.75, 1] as const;

export function formatAccuracyLegendLabel(accuracy: number): string {
  return `${Math.round(accuracy * 100)}%`;
}
