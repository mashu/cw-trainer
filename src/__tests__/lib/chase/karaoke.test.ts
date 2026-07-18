import { DEFAULT_TRAINING_SETTINGS } from '@/config/training.config';
import {
  advanceKaraokePace,
  applyKaraokeOutcomeToPace,
  CHASE_LETTERS_PER_LEVEL,
  computeChaseLevelProgress,
  computeChaseLevelSettings,
  computeKaraokeAccuracy,
  createKaraokePace,
  KARAOKE_LANE_COUNT,
  KARAOKE_TONE_MAX_HZ,
  KARAOKE_TONE_MIN_HZ,
  karaokeCharAudioMs,
  karaokeGapMs,
  karaokeLeadMs,
  karaokeScoreDelta,
  karaokeSlotMs,
  karaokeWindowMs,
  laneToneHz,
  pickNextLane,
  resolveKaraokeKeystroke,
} from '@/lib/chase';

describe('karaoke tone lanes', () => {
  it('spans 300-800 Hz in 50 Hz steps', () => {
    expect(KARAOKE_LANE_COUNT).toBe(11);
    expect(laneToneHz(0)).toBe(KARAOKE_TONE_MIN_HZ);
    expect(laneToneHz(KARAOKE_LANE_COUNT - 1)).toBe(KARAOKE_TONE_MAX_HZ);
    expect(laneToneHz(5)).toBe(550);
  });

  it('clamps out-of-range lane indexes', () => {
    expect(laneToneHz(-3)).toBe(KARAOKE_TONE_MIN_HZ);
    expect(laneToneHz(99)).toBe(KARAOKE_TONE_MAX_HZ);
  });

  it('walks melodically between adjacent lanes and stays in range', () => {
    let lane = pickNextLane(null, () => 0.5);
    for (let i = 0; i < 200; i++) {
      const next = pickNextLane(lane, Math.random);
      expect(next).toBeGreaterThanOrEqual(0);
      expect(next).toBeLessThan(KARAOKE_LANE_COUNT);
      expect(Math.abs(next - lane)).toBeLessThanOrEqual(3);
      lane = next;
    }
  });
});

describe('karaoke pace', () => {
  it('starts inside the configured range and never leaves it', () => {
    let pace = createKaraokePace(10, 25, () => 0.5);
    expect(pace.wpm).toBeGreaterThanOrEqual(10);
    expect(pace.wpm).toBeLessThanOrEqual(25);
    for (let i = 0; i < 300; i++) {
      pace = advanceKaraokePace(pace);
      expect(pace.wpm).toBeGreaterThanOrEqual(10);
      expect(pace.wpm).toBeLessThanOrEqual(25);
    }
  });

  it('slows down on mistakes and speeds up on clean copy', () => {
    const pace = createKaraokePace(10, 25, () => 0.5);
    expect(applyKaraokeOutcomeToPace(pace, 'correct').wpm).toBeGreaterThan(pace.wpm);
    expect(applyKaraokeOutcomeToPace(pace, 'wrong').wpm).toBeLessThan(pace.wpm);
    expect(applyKaraokeOutcomeToPace(pace, 'missed').wpm).toBeLessThan(
      applyKaraokeOutcomeToPace(pace, 'wrong').wpm,
    );
  });

  it('cycles between flow and calm breather phases', () => {
    let pace = createKaraokePace(10, 25, () => 0.5);
    expect(pace.calmRemaining).toBe(0);
    const seenCalm: boolean[] = [];
    for (let i = 0; i < 120; i++) {
      pace = advanceKaraokePace(pace, () => 0.5);
      seenCalm.push(pace.calmRemaining > 0);
    }
    expect(seenCalm).toContain(true);
    expect(seenCalm).toContain(false);
    // Calm phases end and flow resumes.
    expect(seenCalm.lastIndexOf(false)).toBeGreaterThan(seenCalm.indexOf(true));
  });

  it('stretches the gap between letters during a breather', () => {
    const flowing = { ...createKaraokePace(10, 25, () => 0.5), calmRemaining: 0 };
    const calm = { ...flowing, calmRemaining: 3 };
    expect(karaokeGapMs(calm)).toBeGreaterThan(karaokeGapMs(flowing));
  });

  it('derives slot, lead, and window times from the pace', () => {
    expect(karaokeSlotMs(20)).toBe(600);
    expect(karaokeSlotMs(12)).toBe(1000);
    expect(karaokeLeadMs(20)).toBeGreaterThanOrEqual(1600);
    expect(karaokeWindowMs(20)).toBeGreaterThanOrEqual(1400);
    // Slower pace gives more travel and answer time.
    expect(karaokeLeadMs(8)).toBeGreaterThan(karaokeLeadMs(30));
    expect(karaokeWindowMs(8)).toBeGreaterThan(karaokeWindowMs(30));
  });

  it('estimates per-character audio duration', () => {
    // E = one dot = 1 unit; T = one dash = 3 units.
    expect(karaokeCharAudioMs('E', 20)).toBe(60);
    expect(karaokeCharAudioMs('T', 20)).toBe(180);
    expect(karaokeCharAudioMs('0', 20)).toBeGreaterThan(karaokeCharAudioMs('E', 20));
    expect(karaokeCharAudioMs('#', 20)).toBe(0);
  });
});

describe('resolveKaraokeKeystroke', () => {
  const pending = [
    { id: 1, char: 'K' },
    { id: 2, char: 'M' },
    { id: 3, char: 'R' },
  ];

  it('matches the oldest pending note', () => {
    expect(resolveKaraokeKeystroke(pending, 'k')).toEqual([{ id: 1, outcome: 'correct' }]);
  });

  it('typing ahead marks the earlier letters missed', () => {
    expect(resolveKaraokeKeystroke(pending, 'R')).toEqual([
      { id: 1, outcome: 'missed' },
      { id: 2, outcome: 'missed' },
      { id: 3, outcome: 'correct' },
    ]);
  });

  it('marks the oldest note wrong when nothing matches', () => {
    expect(resolveKaraokeKeystroke(pending, 'Z')).toEqual([{ id: 1, outcome: 'wrong' }]);
  });

  it('ignores keystrokes when nothing is pending', () => {
    expect(resolveKaraokeKeystroke([], 'K')).toEqual([]);
  });
});

describe('karaoke scoring and accuracy', () => {
  it('pays more for faster pace and longer combos', () => {
    expect(karaokeScoreDelta(5, 25, 1)).toBeGreaterThan(karaokeScoreDelta(5, 12, 1));
    expect(karaokeScoreDelta(10, 20, 1)).toBeGreaterThan(karaokeScoreDelta(1, 20, 1));
    expect(karaokeScoreDelta(1, 20, 4)).toBeGreaterThan(karaokeScoreDelta(1, 20, 1));
  });

  it('computes accuracy over resolved letters', () => {
    expect(computeKaraokeAccuracy(0, 0)).toBe(0);
    expect(computeKaraokeAccuracy(3, 4)).toBe(0.75);
    expect(computeKaraokeAccuracy(9, 9)).toBe(1);
  });
});

describe('chase level progression', () => {
  it('unlocks more Koch characters as levels increase', () => {
    const settings = computeChaseLevelSettings(DEFAULT_TRAINING_SETTINGS, 4);

    expect(settings.kochLevel).toBe(DEFAULT_TRAINING_SETTINGS.kochLevel + 2);
    expect(settings.digitsLevel).toBe(DEFAULT_TRAINING_SETTINGS.digitsLevel + 1);
  });

  it('keeps the character level fixed when auto-level is disabled', () => {
    const settings = computeChaseLevelSettings(
      { ...DEFAULT_TRAINING_SETTINGS, chaseAutoLevelEnabled: false },
      4,
    );

    expect(settings.kochLevel).toBe(DEFAULT_TRAINING_SETTINGS.kochLevel);
  });

  it('tracks per-level completion progress', () => {
    expect(computeChaseLevelProgress(0)).toBe(0);
    expect(computeChaseLevelProgress(CHASE_LETTERS_PER_LEVEL)).toBe(1);
    expect(computeChaseLevelProgress(3, 6)).toBe(0.5);
  });
});
