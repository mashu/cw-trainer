import {
  ACCURACY_LEGEND_STOPS,
  computeActivityCellColor,
  computeColorForAccuracy,
  computeColorForCount,
  formatAccuracyLegendLabel,
  volumeLegendStops,
} from '@/lib/charts/activityHeatmapColors';

describe('activityHeatmapColors', (): void => {
  describe('computeColorForCount', (): void => {
    it('returns empty color for zero count', (): void => {
      expect(computeColorForCount(0, 100)).toBe('#e5e7eb');
    });

    it('scales hue with count relative to max', (): void => {
      expect(computeColorForCount(50, 100)).toBe('hsl(60, 75%, 45%)');
      expect(computeColorForCount(100, 100)).toBe('hsl(120, 75%, 45%)');
    });
  });

  describe('computeColorForAccuracy', (): void => {
    it('returns empty color when there are no sessions', (): void => {
      expect(computeColorForAccuracy(0, 0.9)).toBe('#e5e7eb');
    });

    it('returns neutral color when accuracy is missing', (): void => {
      expect(computeColorForAccuracy(2, undefined)).toBe('#cbd5e1');
    });

    it('maps accuracy to green at 100%', (): void => {
      expect(computeColorForAccuracy(1, 1)).toBe('hsl(120, 75%, 45%)');
    });
  });

  describe('computeActivityCellColor', (): void => {
    const base = { count: 10, sessionCount: 1, maxCountInWindow: 20, avgAccuracy: 0.8 };

    it('uses volume mode by default input', (): void => {
      expect(computeActivityCellColor('volume', base)).toBe(computeColorForCount(10, 20));
    });

    it('uses accuracy mode when selected', (): void => {
      expect(computeActivityCellColor('accuracy', base)).toBe(computeColorForAccuracy(1, 0.8));
    });
  });

  describe('legends', (): void => {
    it('builds volume stops from max count', (): void => {
      expect(volumeLegendStops(9)).toEqual([0, 3, 6, 9]);
    });

    it('formats accuracy legend labels', (): void => {
      expect(formatAccuracyLegendLabel(0.75)).toBe('75%');
      expect(ACCURACY_LEGEND_STOPS).toHaveLength(4);
    });
  });
});
