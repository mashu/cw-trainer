import {
  clampExtraSpacingMultiplier,
  EXTRA_SPACING_MULTIPLIER_MIN,
} from '@/lib/extraSpacing';
import { computeTrainingGroupGapMs } from '@/lib/trainingSessionPlayback';

describe('clampExtraSpacingMultiplier', () => {
  it('defaults to 1 when value is missing', () => {
    expect(clampExtraSpacingMultiplier(undefined)).toBe(1);
    expect(clampExtraSpacingMultiplier(null)).toBe(1);
  });

  it('clamps below minimum', () => {
    expect(clampExtraSpacingMultiplier(0.05)).toBe(EXTRA_SPACING_MULTIPLIER_MIN);
  });

  it('passes through values at or above minimum', () => {
    expect(clampExtraSpacingMultiplier(0.1)).toBe(0.1);
    expect(clampExtraSpacingMultiplier(1.5)).toBe(1.5);
  });
});

describe('computeTrainingGroupGapMs', () => {
  const base = {
    effectiveWpmMin: 20,
    charWpmMin: 20,
    extraWordSpaceMultiplier: 1,
  } as const;

  it('scales group gap with multiplier below 1', () => {
    const standard = computeTrainingGroupGapMs(base);
    const tight = computeTrainingGroupGapMs({
      ...base,
      extraWordSpaceMultiplier: 0.1,
    });
    expect(tight).toBeLessThan(standard);
    expect(tight).toBe(Math.round((7 * 1.2) / 20 * 0.1 * 1000));
  });
});
