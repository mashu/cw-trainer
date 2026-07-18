import { MORSE_CODE } from '@/lib/morseConstants';

/** Lowest tone lane in the karaoke field. */
export const KARAOKE_TONE_MIN_HZ = 300;
/** Highest tone lane in the karaoke field. */
export const KARAOKE_TONE_MAX_HZ = 800;
/** Distance between adjacent tone lanes. */
export const KARAOKE_TONE_STEP_HZ = 50;
/** Number of tone lanes between 300 and 800 Hz inclusive. */
export const KARAOKE_LANE_COUNT =
  Math.floor((KARAOKE_TONE_MAX_HZ - KARAOKE_TONE_MIN_HZ) / KARAOKE_TONE_STEP_HZ) + 1;

/** How a heard letter was ultimately resolved. */
export type KaraokeOutcome = 'correct' | 'wrong' | 'missed';

/** Random source, injectable for deterministic tests. */
export type KaraokeRng = () => number;

const WPM_WANDER_STEP = 0.9;
const WPM_GAIN_ON_CORRECT = 0.45;
const WPM_LOSS_ON_WRONG = 1.1;
const WPM_LOSS_ON_MISS = 1.5;
const CALM_GAP_MULTIPLIER = 1.65;
const CALM_MIN_LETTERS = 5;
const CALM_EXTRA_LETTERS = 4;
const FLOW_MIN_LETTERS = 16;
const FLOW_EXTRA_LETTERS = 12;

export interface KaraokePace {
  /** Current effective pace (letters arrive at roughly this WPM). */
  readonly wpm: number;
  readonly minWpm: number;
  readonly maxWpm: number;
  /** Letters remaining in the current calm (breather) phase; 0 = flow phase. */
  readonly calmRemaining: number;
  /** Letters left in the flow phase before the next breather begins. */
  readonly lettersUntilCalm: number;
}

export function laneToneHz(laneIndex: number): number {
  const clamped = Math.max(0, Math.min(KARAOKE_LANE_COUNT - 1, Math.floor(laneIndex)));
  return KARAOKE_TONE_MIN_HZ + clamped * KARAOKE_TONE_STEP_HZ;
}

/**
 * Melodic lane walk: hop 1-3 lanes from the previous note so the stream sounds
 * like a tune instead of jumping wildly across the whole band.
 */
export function pickNextLane(previousLane: number | null, rng: KaraokeRng = Math.random): number {
  if (previousLane === null) {
    return Math.floor(rng() * KARAOKE_LANE_COUNT);
  }
  const magnitude = 1 + Math.floor(rng() * 3);
  const direction = rng() < 0.5 ? -1 : 1;
  let next = previousLane + direction * magnitude;
  if (next < 0 || next >= KARAOKE_LANE_COUNT) {
    next = previousLane - direction * magnitude;
  }
  return Math.max(0, Math.min(KARAOKE_LANE_COUNT - 1, next));
}

export function createKaraokePace(
  minWpm: number,
  maxWpm: number,
  rng: KaraokeRng = Math.random,
): KaraokePace {
  const safeMin = Math.max(3, Math.min(minWpm, maxWpm));
  const safeMax = Math.max(safeMin, maxWpm);
  return {
    wpm: safeMin + (safeMax - safeMin) * 0.3,
    minWpm: safeMin,
    maxWpm: safeMax,
    calmRemaining: 0,
    lettersUntilCalm: FLOW_MIN_LETTERS + Math.floor(rng() * FLOW_EXTRA_LETTERS),
  };
}

const clampWpm = (pace: KaraokePace, wpm: number): number =>
  Math.max(pace.minWpm, Math.min(pace.maxWpm, wpm));

/**
 * Per-letter drift: the pace wanders randomly inside the configured range and
 * the calm/flow phase counters advance by one letter.
 */
export function advanceKaraokePace(pace: KaraokePace, rng: KaraokeRng = Math.random): KaraokePace {
  const wandered = clampWpm(pace, pace.wpm + (rng() * 2 - 1) * WPM_WANDER_STEP);
  if (pace.calmRemaining > 0) {
    return { ...pace, wpm: wandered, calmRemaining: pace.calmRemaining - 1 };
  }
  if (pace.lettersUntilCalm <= 0) {
    return {
      ...pace,
      wpm: wandered,
      calmRemaining: CALM_MIN_LETTERS + Math.floor(rng() * CALM_EXTRA_LETTERS),
      lettersUntilCalm: FLOW_MIN_LETTERS + Math.floor(rng() * FLOW_EXTRA_LETTERS),
    };
  }
  return { ...pace, wpm: wandered, lettersUntilCalm: pace.lettersUntilCalm - 1 };
}

/**
 * Performance feedback: clean copy nudges the pace up, mistakes pull it down
 * harder so a rough patch quickly gets breathing room again.
 */
export function applyKaraokeOutcomeToPace(pace: KaraokePace, outcome: KaraokeOutcome): KaraokePace {
  const delta =
    outcome === 'correct'
      ? WPM_GAIN_ON_CORRECT
      : outcome === 'wrong'
        ? -WPM_LOSS_ON_WRONG
        : -WPM_LOSS_ON_MISS;
  return { ...pace, wpm: clampWpm(pace, pace.wpm + delta) };
}

/** Average time budget for one letter (incl. spacing) at the given pace. */
export function karaokeSlotMs(wpm: number): number {
  return 12000 / Math.max(3, wpm);
}

/** Gap between consecutive letter starts; breathers stretch it out. */
export function karaokeGapMs(pace: KaraokePace): number {
  const slot = karaokeSlotMs(pace.wpm);
  return Math.round(pace.calmRemaining > 0 ? slot * CALM_GAP_MULTIPLIER : slot);
}

/** Visual travel time from the right edge to the hit line. */
export function karaokeLeadMs(wpm: number): number {
  return Math.round(Math.max(1600, Math.min(5600, karaokeSlotMs(wpm) * 3.2)));
}

/** Answer window after a letter is heard before it counts as missed. */
export function karaokeWindowMs(wpm: number): number {
  return Math.round(Math.max(1400, Math.min(5200, karaokeSlotMs(wpm) * 2.8)));
}

/**
 * Duration of one character's Morse audio (ms) at the given character WPM.
 * Used as a floor so the next letter never starts before this one finishes.
 */
export function karaokeCharAudioMs(char: string, charWpm: number): number {
  const pattern = MORSE_CODE[char.toUpperCase()] ?? '';
  if (pattern.length === 0) return 0;
  let units = 0;
  for (const symbol of pattern) {
    units += symbol === '-' ? 3 : 1;
  }
  units += pattern.length - 1;
  return Math.ceil((units * 1200) / Math.max(1, charWpm));
}

export interface KaraokePendingNote {
  readonly id: number;
  readonly char: string;
}

export interface KaraokeKeystrokeResolution {
  readonly id: number;
  readonly outcome: KaraokeOutcome;
}

/**
 * Resolve one typed character against the queue of heard-but-unanswered notes
 * (oldest first). Matching a later note abandons every earlier note as missed —
 * the "let go and move on" mechanic. A character matching nothing marks the
 * oldest pending note wrong. With an empty queue the keystroke is ignored.
 */
export function resolveKaraokeKeystroke(
  pending: readonly KaraokePendingNote[],
  typedChar: string,
): readonly KaraokeKeystrokeResolution[] {
  if (pending.length === 0) return [];
  const typed = typedChar.toUpperCase();
  const matchIndex = pending.findIndex((note) => note.char.toUpperCase() === typed);
  if (matchIndex === -1) {
    const oldest = pending[0];
    return oldest ? [{ id: oldest.id, outcome: 'wrong' }] : [];
  }
  const resolutions: KaraokeKeystrokeResolution[] = [];
  for (let i = 0; i < matchIndex; i++) {
    const note = pending[i];
    if (note) resolutions.push({ id: note.id, outcome: 'missed' });
  }
  const matched = pending[matchIndex];
  if (matched) resolutions.push({ id: matched.id, outcome: 'correct' });
  return resolutions;
}

/** Points for a clean copy: faster pace and longer combos pay more. */
export function karaokeScoreDelta(comboAfter: number, wpm: number, level: number): number {
  const comboBonus = Math.min(25, comboAfter) * 2;
  return Math.round(10 + wpm + comboBonus + (level - 1) * 5);
}

export function computeKaraokeAccuracy(correct: number, resolvedTotal: number): number {
  if (resolvedTotal <= 0) return 0;
  return Math.max(0, Math.min(1, correct / resolvedTotal));
}
