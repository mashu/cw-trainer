import { describe, expect, it, beforeEach } from '@jest/globals';

import {
  buildAutoLevelAdjustProgressView,
  evaluateAutoLevelAdjust,
  getAutoLevelAdjustCounts,
  resolveAutoAdjustMode,
} from '@/lib/kochAutoAdjust';

describe('evaluateAutoLevelAdjust', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('increases Koch level after one above-threshold session when aboveThresholdCount is 1', () => {
    const result = evaluateAutoLevelAdjust(0.95, {
      enabled: true,
      mode: 'koch',
      threshold: 90,
      aboveThresholdCount: 1,
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

  it('does not increase when aboveThresholdCount is zero (increase disabled)', () => {
    const result = evaluateAutoLevelAdjust(0.95, {
      enabled: true,
      mode: 'koch',
      threshold: 90,
      aboveThresholdCount: 0,
      belowThresholdCount: 2,
      currentLevel: 5,
      maxLevel: 40,
    });
    expect(result).toBeNull();
  });

  it('does not decrease when belowThresholdCount is zero (decrease disabled)', () => {
    const result = evaluateAutoLevelAdjust(0.5, {
      enabled: true,
      mode: 'koch',
      threshold: 90,
      aboveThresholdCount: 3,
      belowThresholdCount: 0,
      currentLevel: 5,
      maxLevel: 40,
    });
    expect(result).toBeNull();
  });

  it('does not increase past maxLevel', () => {
    const result = evaluateAutoLevelAdjust(1, {
      enabled: true,
      mode: 'koch',
      threshold: 90,
      aboveThresholdCount: 1,
      belowThresholdCount: 0,
      currentLevel: 40,
      maxLevel: 40,
    });
    expect(result).toBeNull();
  });

  it('increases only digits level in digits mode', () => {
    const result = evaluateAutoLevelAdjust(0.95, {
      enabled: true,
      mode: 'digits',
      threshold: 90,
      aboveThresholdCount: 1,
      belowThresholdCount: 0,
      currentLevel: 4,
      maxLevel: 10,
    });
    expect(result?.nextLevel).toBe(5);
    expect(result?.nextDigitsLevel).toBeUndefined();
  });

  it('increases both alphabet and digits levels in mixed mode', () => {
    const result = evaluateAutoLevelAdjust(0.95, {
      enabled: true,
      mode: 'mixed',
      threshold: 90,
      aboveThresholdCount: 1,
      belowThresholdCount: 0,
      currentLevel: 3,
      pairedDigitsLevel: 6,
      maxLevel: 40,
      maxDigitsLevel: 10,
    });
    expect(result).toMatchObject({
      delta: 1,
      nextLevel: 4,
      nextDigitsLevel: 7,
    });
    expect(getAutoLevelAdjustCounts('mixed', 4, 7)).toEqual({ above: 0, below: 0 });
  });

  it('can raise digits in mixed mode when alphabet is already at max', () => {
    const result = evaluateAutoLevelAdjust(0.95, {
      enabled: true,
      mode: 'mixed',
      threshold: 90,
      aboveThresholdCount: 1,
      belowThresholdCount: 0,
      currentLevel: 40,
      pairedDigitsLevel: 5,
      maxLevel: 40,
      maxDigitsLevel: 10,
    });
    expect(result).toMatchObject({
      nextLevel: 40,
      nextDigitsLevel: 6,
    });
  });
});

describe('resolveAutoAdjustMode', () => {
  it('maps echo profile to echo-prefixed storage modes', () => {
    expect(resolveAutoAdjustMode('digits', 'echo')).toBe('echo-digits');
    expect(resolveAutoAdjustMode('koch', 'group')).toBe('koch');
  });
});

describe('buildAutoLevelAdjustProgressView', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when auto-adjust is disabled', () => {
    expect(
      buildAutoLevelAdjustProgressView({
        enabled: false,
        mode: 'koch',
        threshold: 90,
        aboveThresholdCount: 3,
        belowThresholdCount: 2,
        currentLevel: 4,
      }),
    ).toBeNull();
  });

  it('reflects persisted session counts and targets', () => {
    evaluateAutoLevelAdjust(0.95, {
      enabled: true,
      mode: 'koch',
      threshold: 90,
      aboveThresholdCount: 3,
      belowThresholdCount: 2,
      currentLevel: 4,
      maxLevel: 40,
    });
    evaluateAutoLevelAdjust(0.5, {
      enabled: true,
      mode: 'koch',
      threshold: 90,
      aboveThresholdCount: 3,
      belowThresholdCount: 2,
      currentLevel: 4,
      maxLevel: 40,
    });

    expect(getAutoLevelAdjustCounts('koch', 4)).toEqual({ above: 1, below: 1 });

    const view = buildAutoLevelAdjustProgressView({
      enabled: true,
      mode: 'koch',
      threshold: 90,
      aboveThresholdCount: 3,
      belowThresholdCount: 2,
      currentLevel: 4,
    });

    expect(view).toMatchObject({
      aboveCount: 1,
      belowCount: 1,
      aboveTarget: 3,
      belowTarget: 2,
      aboveDisabled: false,
      belowDisabled: false,
      currentLevel: 4,
      threshold: 90,
    });
  });

  it('marks direction disabled when increase/decrease counts are 0', () => {
    const view = buildAutoLevelAdjustProgressView({
      enabled: true,
      mode: 'koch',
      threshold: 85,
      aboveThresholdCount: 0,
      belowThresholdCount: 3,
      currentLevel: 2,
    });
    expect(view?.aboveTarget).toBe(0);
    expect(view?.belowTarget).toBe(3);
    expect(view?.aboveDisabled).toBe(true);
    expect(view?.belowDisabled).toBe(false);
  });

  it('uses composite storage for mixed mode progress', () => {
    evaluateAutoLevelAdjust(0.95, {
      enabled: true,
      mode: 'mixed',
      threshold: 90,
      aboveThresholdCount: 2,
      belowThresholdCount: 2,
      currentLevel: 2,
      pairedDigitsLevel: 5,
      maxLevel: 40,
      maxDigitsLevel: 10,
    });

    const view = buildAutoLevelAdjustProgressView({
      enabled: true,
      mode: 'mixed',
      threshold: 90,
      aboveThresholdCount: 2,
      belowThresholdCount: 2,
      currentLevel: 2,
      pairedDigitsLevel: 5,
    });

    expect(view).toMatchObject({
      adjustsBothLevels: true,
      currentLevel: 2,
      currentDigitsLevel: 5,
      aboveCount: 1,
    });
    expect(getAutoLevelAdjustCounts('mixed', 2, 5)).toEqual({ above: 1, below: 0 });
    expect(getAutoLevelAdjustCounts('mixed', 2)).toEqual({ above: 0, below: 0 });
  });
});
