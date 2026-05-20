import { useMemo } from 'react';

import {
  buildAutoLevelAdjustProgressView,
  resolveAutoAdjustMode,
  type AutoAdjustProfileVariant,
  type AutoLevelAdjustProgressView,
} from '@/lib/kochAutoAdjust';
import type { TrainingSettings } from '@/types';

/**
 * Reads local auto-level session counters for the active profile and character set.
 * Pass `refreshKey` (e.g. session count) so counts update after a completed session.
 */
export function useAutoLevelAdjustProgress(
  settings: TrainingSettings,
  profile: AutoAdjustProfileVariant,
  refreshKey: number,
): AutoLevelAdjustProgressView | null {
  return useMemo(() => {
    const enabled =
      profile === 'echo' ? settings.echoAutoAdjustKoch : settings.autoAdjustKoch;
    if (!enabled) {
      return null;
    }

    const charSetMode = settings.charSetMode ?? 'koch';
    const mode = resolveAutoAdjustMode(charSetMode, profile);
    const isMixed = charSetMode === 'mixed';
    const isDigits = charSetMode === 'digits';
    const currentLevel = isDigits ? (settings.digitsLevel ?? 10) : settings.kochLevel;
    const threshold =
      profile === 'echo'
        ? (settings.echoAutoAdjustThreshold ?? 90)
        : (settings.autoAdjustThreshold ?? 90);
    const aboveThresholdCount = Math.max(
      0,
      profile === 'echo'
        ? (settings.echoAutoAdjustAboveThresholdCount ?? 0)
        : (settings.autoAdjustAboveThresholdCount ?? 0),
    );
    const belowThresholdCount = Math.max(
      0,
      profile === 'echo'
        ? (settings.echoAutoAdjustBelowThresholdCount ?? 0)
        : (settings.autoAdjustBelowThresholdCount ?? 0),
    );

    return buildAutoLevelAdjustProgressView({
      enabled: true,
      mode,
      threshold,
      aboveThresholdCount,
      belowThresholdCount,
      currentLevel,
      ...(isMixed ? { pairedDigitsLevel: settings.digitsLevel ?? 10 } : {}),
    });
  }, [
    profile,
    refreshKey,
    settings.autoAdjustKoch,
    settings.echoAutoAdjustKoch,
    settings.autoAdjustThreshold,
    settings.echoAutoAdjustThreshold,
    settings.autoAdjustAboveThresholdCount,
    settings.autoAdjustBelowThresholdCount,
    settings.echoAutoAdjustAboveThresholdCount,
    settings.echoAutoAdjustBelowThresholdCount,
    settings.charSetMode,
    settings.kochLevel,
    settings.digitsLevel,
  ]);
}
