import { renderHook } from '@testing-library/react';

import { DEFAULT_TRAINING_SETTINGS } from '@/config/training.config';
import { useAutoLevelAdjustProgress } from '@/hooks/useAutoLevelAdjustProgress';

describe('useAutoLevelAdjustProgress', () => {
  it('returns null when auto-adjust is disabled', () => {
    const settings = { ...DEFAULT_TRAINING_SETTINGS, autoAdjustKoch: false };
    const { result } = renderHook(() =>
      useAutoLevelAdjustProgress(settings, 'group', 0),
    );
    expect(result.current).toBeNull();
  });

  it('returns progress view for enabled Koch group profile', () => {
    const settings = {
      ...DEFAULT_TRAINING_SETTINGS,
      autoAdjustKoch: true,
      charSetMode: 'koch' as const,
      kochLevel: 4,
      autoAdjustThreshold: 90,
      autoAdjustAboveThresholdCount: 2,
      autoAdjustBelowThresholdCount: 1,
    };
    const { result } = renderHook(() =>
      useAutoLevelAdjustProgress(settings, 'group', 1),
    );

    expect(result.current).not.toBeNull();
    expect(result.current?.currentLevel).toBe(4);
    expect(result.current?.threshold).toBe(90);
  });

  it('uses echo counters for echo profile', () => {
    const settings = {
      ...DEFAULT_TRAINING_SETTINGS,
      echoAutoAdjustKoch: true,
      echoAutoAdjustThreshold: 85,
      echoAutoAdjustAboveThresholdCount: 3,
      echoAutoAdjustBelowThresholdCount: 0,
    };
    const { result } = renderHook(() =>
      useAutoLevelAdjustProgress(settings, 'echo', 2),
    );

    expect(result.current?.threshold).toBe(85);
    expect(result.current?.aboveTarget).toBe(3);
  });
});
