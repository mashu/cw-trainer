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

  it('uses Chase timing settings for pressure ramping', () => {
    const fallMs = computeChaseFallMs({
      level: 3,
      targetIndex: 4,
      groupsPerLevel: 2,
      startFallMs: 5000,
      minFallMs: 2000,
      levelSpeedupMs: 500,
      groupSpeedupMs: 100,
    });

    expect(fallMs).toBe(3400);
  });

  it('unlocks more Koch characters as Chase levels increase', () => {
    const settings = computeChaseLevelSettings(DEFAULT_TRAINING_SETTINGS, 4);

    expect(settings.kochLevel).toBe(DEFAULT_TRAINING_SETTINGS.kochLevel + 2);
    expect(settings.digitsLevel).toBe(DEFAULT_TRAINING_SETTINGS.digitsLevel + 1);
  });

  it('keeps Chase character level fixed when Chase auto-level is disabled', () => {
    const settings = computeChaseLevelSettings(
      { ...DEFAULT_TRAINING_SETTINGS, chaseAutoLevelEnabled: false },
      4,
    );

    expect(settings.kochLevel).toBe(DEFAULT_TRAINING_SETTINGS.kochLevel);
  });

  it('tracks per-level completion progress', () => {
    expect(computeChaseLevelProgress(0)).toBe(0);
    expect(computeChaseLevelProgress(CHASE_GROUPS_PER_LEVEL)).toBe(1);
    expect(computeChaseLevelProgress(3, 6)).toBe(0.5);
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

  it('awards more points for longer groups', () => {
    const short = resolveChaseTarget({
      expected: 'KM',
      received: 'KM',
      outcome: 'correct',
      level: 1,
      lives: 3,
      score: 0,
      streak: 0,
      remainingMs: 1000,
    });
    const long = resolveChaseTarget({
      expected: 'KMURE',
      received: 'KMURE',
      outcome: 'correct',
      level: 1,
      lives: 3,
      score: 0,
      streak: 0,
      remainingMs: 1000,
    });

    expect(long.scoreDelta).toBeGreaterThan(short.scoreDelta);
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
