import { MAX_KOCH_LEVEL_GUESS } from './constants';

// ── Types ──────────────────────────────────────────────────────────────

export type AutoAdjustMode = 'koch' | 'digits' | 'mixed';

export interface AutoLevelAdjustConfig {
  /** Whether the feature is enabled at all. */
  readonly enabled: boolean;
  /** Which training mode the session ran in — drives storage namespace and label. */
  readonly mode: AutoAdjustMode;
  /** Accuracy percentage threshold (0-100). */
  readonly threshold: number;
  /** How many sessions above threshold needed to increase (0 = immediate). */
  readonly aboveThresholdCount: number;
  /** How many sessions below threshold needed to decrease (0 = immediate). */
  readonly belowThresholdCount: number;
  /** Current level for this mode (kochLevel for koch/mixed, digitsLevel for digits). */
  readonly currentLevel: number;
  /** Upper bound for level (defaults to MAX_KOCH_LEVEL_GUESS). */
  readonly maxLevel?: number;
}

/** @deprecated Use AutoLevelAdjustConfig instead. */
export type KochAutoAdjustConfig = AutoLevelAdjustConfig;

export interface AutoLevelAdjustResult {
  /** -1, 0, or +1. */
  readonly delta: number;
  /** The level to switch to (already clamped). */
  readonly nextLevel: number;
  /** Human-readable notification message. */
  readonly message: string;
  /** Toast variant. */
  readonly messageType: 'success' | 'info';
}

/** @deprecated Use AutoLevelAdjustResult instead. */
export type KochAdjustResult = AutoLevelAdjustResult;

// ── Local-storage helpers ──────────────────────────────────────────────

function storageKey(mode: AutoAdjustMode, level: number): string {
  return `cw_auto_adjust_${mode}_${level}`;
}

function loadCounts(mode: AutoAdjustMode, level: number): { above: number; below: number } {
  try {
    if (typeof window === 'undefined') return { above: 0, below: 0 };
    const raw = window.localStorage.getItem(storageKey(mode, level));
    if (!raw) return { above: 0, below: 0 };
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null) {
      const obj = parsed as Record<string, unknown>;
      return {
        above: typeof obj['above'] === 'number' ? obj['above'] : 0,
        below: typeof obj['below'] === 'number' ? obj['below'] : 0,
      };
    }
  } catch {
    /* corrupted data, start fresh */
  }
  return { above: 0, below: 0 };
}

function saveCounts(
  mode: AutoAdjustMode,
  level: number,
  counts: { above: number; below: number },
): void {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(
        storageKey(mode, level),
        JSON.stringify(counts),
      );
    }
  } catch {
    /* localStorage quota or privacy error */
  }
}

function clearCounts(mode: AutoAdjustMode, ...levels: number[]): void {
  try {
    if (typeof window !== 'undefined') {
      levels.forEach((l) => window.localStorage.removeItem(storageKey(mode, l)));
    }
  } catch {
    /* no-op */
  }
}

// ── Mode labels ─────────────────────────────────────────────────────────

const MODE_LABELS: Record<AutoAdjustMode, string> = {
  koch: 'Alphabet level',
  digits: 'Digits level',
  mixed: 'Alphabet level (mixed)',
};

// ── Core logic ─────────────────────────────────────────────────────────

/**
 * Evaluate whether the training level should change after a session.
 *
 * Reads / writes mode-specific localStorage counters and returns the
 * adjustment decision (or `null` if no change is needed).
 */
export function evaluateAutoLevelAdjust(
  accuracyFraction: number,
  config: AutoLevelAdjustConfig,
): AutoLevelAdjustResult | null {
  if (!config.enabled) return null;

  const { mode, aboveThresholdCount, belowThresholdCount, currentLevel } = config;
  const threshold = Math.max(0, Math.min(100, config.threshold));
  const maxLevel = config.maxLevel ?? MAX_KOCH_LEVEL_GUESS;
  const accuracyPct = (accuracyFraction || 0) * 100;

  const counts = loadCounts(mode, currentLevel);
  if (accuracyPct >= threshold) {
    counts.above += 1;
  } else {
    counts.below += 1;
  }
  saveCounts(mode, currentLevel, counts);

  const shouldIncrease =
    (aboveThresholdCount === 0 && counts.above > 0) ||
    (aboveThresholdCount > 0 && counts.above >= aboveThresholdCount);
  const shouldDecrease =
    (belowThresholdCount === 0 && counts.below > 0) ||
    (belowThresholdCount > 0 && counts.below >= belowThresholdCount);

  let delta = 0;
  if (shouldIncrease && shouldDecrease) {
    delta = counts.above >= counts.below ? 1 : -1;
  } else if (shouldIncrease) {
    delta = 1;
  } else if (shouldDecrease) {
    delta = -1;
  }

  if (delta === 0) return null;

  const nextLevel = Math.max(1, Math.min((currentLevel || 1) + delta, maxLevel));
  if (nextLevel === currentLevel) return null;

  clearCounts(mode, currentLevel, nextLevel);

  const countText =
    delta > 0
      ? aboveThresholdCount === 0
        ? '1 session above'
        : `${counts.above} sessions above`
      : belowThresholdCount === 0
        ? '1 session below'
        : `${counts.below} sessions below`;

  const label = MODE_LABELS[mode];

  return {
    delta,
    nextLevel,
    message: `${label} ${delta > 0 ? 'increased' : 'decreased'} to ${nextLevel} (accuracy ${Math.round(accuracyPct)}%, threshold ${threshold}%, ${countText})`,
    messageType: delta > 0 ? 'success' : 'info',
  };
}

/** @deprecated Use evaluateAutoLevelAdjust instead. */
export const evaluateKochAutoAdjust = evaluateAutoLevelAdjust;
