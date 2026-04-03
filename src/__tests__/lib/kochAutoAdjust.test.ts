import { describe, expect, it, beforeEach } from '@jest/globals';

import { evaluateAutoLevelAdjust } from '@/lib/kochAutoAdjust';

describe('evaluateAutoLevelAdjust', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('increases Koch level after one above-threshold session when aboveThresholdCount is 0', () => {
    const result = evaluateAutoLevelAdjust(0.95, {
      enabled: true,
      mode: 'koch',
      threshold: 90,
      aboveThresholdCount: 0,
      belowThresholdCount: 0,
      currentLevel: 5,
      maxLevel: 40,
    });
    expect(result).not.toBeNull();
    expect(result?.delta).toBe(1);
    expect(result?.nextLevel).toBe(6);
  });

  it('does not change level when disabled', () => {
    expect(
      evaluateAutoLevelAdjust(1, {
        enabled: false,
        mode: 'koch',
        threshold: 90,
        aboveThresholdCount: 0,
        belowThresholdCount: 0,
        currentLevel: 3,
        maxLevel: 40,
      }),
    ).toBeNull();
  });

  it('does not increase past maxLevel', () => {
    const result = evaluateAutoLevelAdjust(1, {
      enabled: true,
      mode: 'koch',
      threshold: 90,
      aboveThresholdCount: 0,
      belowThresholdCount: 0,
      currentLevel: 40,
      maxLevel: 40,
    });
    expect(result).toBeNull();
  });
});
