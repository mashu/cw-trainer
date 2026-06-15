import {
  applyAutoAdjustDirectionCountChange,
  normalizeAutoAdjustDirectionCounts,
} from '@/lib/autoAdjustCountSettings';

describe('autoAdjustCountSettings', () => {
  it('repairs both directions set to zero', () => {
    expect(normalizeAutoAdjustDirectionCounts(0, 0)).toEqual({ above: 1, below: 1 });
  });

  it('allows one direction disabled', () => {
    expect(normalizeAutoAdjustDirectionCounts(0, 3)).toEqual({ above: 0, below: 3 });
    expect(normalizeAutoAdjustDirectionCounts(5, 0)).toEqual({ above: 5, below: 0 });
  });

  it('bumps the other direction when setting one to zero while both are zero', () => {
    expect(applyAutoAdjustDirectionCountChange(0, 0, 'below', 0)).toEqual({
      above: 1,
      below: 0,
    });
    expect(applyAutoAdjustDirectionCountChange(0, 0, 'above', 0)).toEqual({
      above: 0,
      below: 1,
    });
  });

  it('keeps the other direction when only one is disabled', () => {
    expect(applyAutoAdjustDirectionCountChange(4, 2, 'below', 0)).toEqual({
      above: 4,
      below: 0,
    });
    expect(applyAutoAdjustDirectionCountChange(4, 2, 'above', 0)).toEqual({
      above: 0,
      below: 2,
    });
  });
});
