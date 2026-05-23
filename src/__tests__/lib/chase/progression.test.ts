import { DEFAULT_TRAINING_SETTINGS } from '@/config/training.config';
import {
  CHASE_GROUPS_PER_LEVEL,
  CHASE_MIN_FALL_MS,
  computeChaseFallMs,
  computeChaseLevelProgress,
  computeChaseLevelSettings,
  resolveChaseTarget,
} from '@/lib/chase';

describe('chase progression', () => {
  it('ramps fall timing down without going below the minimum', () => {
    const early = computeChaseFallMs({ level: 1, targetIndex: 0 });
    const late = computeChaseFallMs({ level: 12, targetIndex: 80 });

    expect(late).toBeLessThan(early);
    expect(late).toBeGreaterThanOrEqual(CHASE_MIN_FALL_MS);
  });

  it('unlocks more Koch characters as Chase levels increase', () => {
    const settings = computeChaseLevelSettings(DEFAULT_TRAINING_SETTINGS, 4);

    expect(settings.kochLevel).toBe(DEFAULT_TRAINING_SETTINGS.kochLevel + 3);
  });

  it('tracks per-level completion progress', () => {
    expect(computeChaseLevelProgress(0)).toBe(0);
    expect(computeChaseLevelProgress(CHASE_GROUPS_PER_LEVEL)).toBe(1);
  });

  it('awards streak score for correct groups', () => {
    const result = resolveChaseTarget({
      expected: 'KM',
      received: 'KM',
      outcome: 'correct',
      level: 2,
      lives: 3,
      score: 100,
      streak: 1,
      remainingMs: 2500,
    });

    expect(result.correct).toBe(true);
    expect(result.lives).toBe(3);
    expect(result.streak).toBe(2);
    expect(result.score).toBeGreaterThan(100);
  });

  it('removes a life and resets streak for wrong groups', () => {
    const result = resolveChaseTarget({
      expected: 'KM',
      received: 'KK',
      outcome: 'wrong',
      level: 2,
      lives: 3,
      score: 100,
      streak: 4,
      remainingMs: 1200,
    });

    expect(result.correct).toBe(false);
    expect(result.lives).toBe(2);
    expect(result.streak).toBe(0);
    expect(result.score).toBe(100);
  });
});
