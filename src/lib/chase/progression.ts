import { MAX_DIGITS_LEVEL, MAX_KOCH_LEVEL_GUESS } from '@/lib/constants';
import { mixedChaseLevelBoosts } from '@/lib/levelUnlock';
import type { TrainingSettings } from '@/types';

export const CHASE_LETTERS_PER_LEVEL = 10;

/**
 * Expand the character set as the karaoke run levels up. Each level past the
 * first unlocks one more character from the active training sequence (when
 * auto-level is enabled).
 */
export function computeChaseLevelSettings(
  settings: TrainingSettings,
  level: number,
): TrainingSettings {
  const levelOffset = settings.chaseAutoLevelEnabled ? Math.max(0, Math.floor(level) - 1) : 0;
  const charSetMode = settings.charSetMode ?? 'koch';

  if (charSetMode === 'digits') {
    return {
      ...settings,
      digitsLevel: Math.min(MAX_DIGITS_LEVEL, settings.digitsLevel + levelOffset),
    };
  }

  if (charSetMode === 'mixed') {
    const boosts = mixedChaseLevelBoosts(levelOffset);
    return {
      ...settings,
      kochLevel: Math.min(MAX_KOCH_LEVEL_GUESS, settings.kochLevel + boosts.letters),
      digitsLevel: Math.min(MAX_DIGITS_LEVEL, settings.digitsLevel + boosts.digits),
    };
  }

  if (charSetMode === 'custom') {
    return settings;
  }

  return {
    ...settings,
    kochLevel: Math.min(MAX_KOCH_LEVEL_GUESS, settings.kochLevel + levelOffset),
  };
}

export function computeChaseLevelProgress(
  correctInLevel: number,
  lettersPerLevel: number = CHASE_LETTERS_PER_LEVEL,
): number {
  return Math.max(0, Math.min(1, correctInLevel / Math.max(1, lettersPerLevel)));
}
