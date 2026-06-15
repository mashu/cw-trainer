import {
  MAX_DIGITS_LEVEL,
  MAX_KOCH_LEVEL_GUESS,
  MIN_DIGITS_LEVEL,
  MIN_KOCH_LEVEL,
} from './constants';

// ── Types ──────────────────────────────────────────────────────────────

/** Group training counters use `koch` / `digits` / `mixed`. Echo uses `echo-*` so level-advance rules stay independent. */
export type AutoAdjustMode =
  | 'koch'
  | 'digits'
  | 'mixed'
  | 'echo-koch'
  | 'echo-digits'
  | 'echo-mixed';

export interface AutoLevelAdjustConfig {
  /** Whether the feature is enabled at all. */
  readonly enabled: boolean;
  /** Which training mode the session ran in — drives storage namespace and label. */
  readonly mode: AutoAdjustMode;
  /** Accuracy percentage threshold (0-100). */
  readonly threshold: number;
  /** How many sessions above threshold needed to increase (0 = increase disabled). */
  readonly aboveThresholdCount: number;
  /** How many sessions below threshold needed to decrease (0 = decrease disabled). */
  readonly belowThresholdCount: number;
  /**
   * Active level for single-level modes (koch / digits).
   * Alphabet level when mode is mixed / echo-mixed.
   */
  readonly currentLevel: number;
  /** Upper bound for alphabet level (defaults to MAX_KOCH_LEVEL_GUESS). */
  readonly maxLevel?: number;
  /** Digits level when mode is mixed / echo-mixed (both levels move together). */
  readonly pairedDigitsLevel?: number;
  /** Upper bound for digits level in mixed mode (defaults to MAX_DIGITS_LEVEL). */
  readonly maxDigitsLevel?: number;
}

/** @deprecated Use AutoLevelAdjustConfig instead. */
export type KochAutoAdjustConfig = AutoLevelAdjustConfig;

export interface AutoLevelAdjustResult {
  /** -1, 0, or +1. */
  readonly delta: number;
  /** Next alphabet level (koch / mixed) or digits-only level. */
  readonly nextLevel: number;
  /** Next digits level when mixed / echo-mixed. */
  readonly nextDigitsLevel?: number;
  /** Human-readable notification message. */
  readonly message: string;
  /** Toast variant. */
  readonly messageType: 'success' | 'info';
}

/** @deprecated Use AutoLevelAdjustResult instead. */
export type KochAdjustResult = AutoLevelAdjustResult;

export type AutoAdjustCharSetMode = 'koch' | 'digits' | 'custom' | 'mixed';

export type AutoAdjustProfileVariant = 'group' | 'echo';

/** Snapshot for UI showing progress toward automatic level up / down. */
export interface AutoLevelAdjustProgressView {
  readonly levelLabel: string;
  readonly currentLevel: number;
  readonly currentDigitsLevel?: number;
  readonly adjustsBothLevels: boolean;
  readonly threshold: number;
  readonly aboveCount: number;
  readonly belowCount: number;
  /** Sessions at/above threshold required to increase (0 when increase is disabled). */
  readonly aboveTarget: number;
  /** Sessions below threshold required to decrease (0 when decrease is disabled). */
  readonly belowTarget: number;
  readonly aboveDisabled: boolean;
  readonly belowDisabled: boolean;
}

// ── Local-storage helpers ──────────────────────────────────────────────

function isMixedAdjustMode(mode: AutoAdjustMode): boolean {
  return mode === 'mixed' || mode === 'echo-mixed';
}

function storageKey(
  mode: AutoAdjustMode,
  level: number,
  pairedDigitsLevel?: number,
): string {
  if (isMixedAdjustMode(mode)) {
    return `cw_auto_adjust_${mode}_${level}_${pairedDigitsLevel ?? 0}`;
  }
  return `cw_auto_adjust_${mode}_${level}`;
}

function loadCounts(
  mode: AutoAdjustMode,
  level: number,
  pairedDigitsLevel?: number,
): { above: number; below: number } {
  try {
    if (typeof window === 'undefined') return { above: 0, below: 0 };
    const raw = window.localStorage.getItem(storageKey(mode, level, pairedDigitsLevel));
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
  pairedDigitsLevel?: number,
): void {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(
        storageKey(mode, level, pairedDigitsLevel),
        JSON.stringify(counts),
      );
    }
  } catch {
    /* localStorage quota or privacy error */
  }
}

function removeLevelCounts(
  mode: AutoAdjustMode,
  level: number,
  pairedDigitsLevel?: number,
): void {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(storageKey(mode, level, pairedDigitsLevel));
    }
  } catch {
    /* no-op */
  }
}

// ── Mode labels ─────────────────────────────────────────────────────────

const MODE_LABELS: Record<AutoAdjustMode, string> = {
  koch: 'Alphabet level',
  digits: 'Digits level',
  mixed: 'Mixed mode',
  'echo-koch': 'Echo alphabet level',
  'echo-digits': 'Echo digits level',
  'echo-mixed': 'Echo mixed mode',
};

function sessionTarget(countSetting: number): number {
  return countSetting > 0 ? countSetting : 0;
}

function mixedDigitsLevel(config: AutoLevelAdjustConfig): number {
  return config.pairedDigitsLevel ?? MIN_DIGITS_LEVEL;
}

/** Maps character-set + training profile to the auto-adjust storage namespace. */
export function resolveAutoAdjustMode(
  charSetMode: AutoAdjustCharSetMode | undefined,
  profile: AutoAdjustProfileVariant,
): AutoAdjustMode {
  const base: AutoAdjustMode =
    charSetMode === 'digits' ? 'digits' : charSetMode === 'mixed' ? 'mixed' : 'koch';
  if (profile === 'group') {
    return base;
  }
  return base === 'digits' ? 'echo-digits' : base === 'mixed' ? 'echo-mixed' : 'echo-koch';
}

/** Read persisted above/below session counters for the current level (no mutation). */
export function getAutoLevelAdjustCounts(
  mode: AutoAdjustMode,
  level: number,
  pairedDigitsLevel?: number,
): { readonly above: number; readonly below: number } {
  return loadCounts(mode, level, pairedDigitsLevel);
}

/**
 * Build display data for level-adjust progress bars.
 * Uses the same thresholds as {@link evaluateAutoLevelAdjust}.
 */
export function buildAutoLevelAdjustProgressView(
  config: Pick<
    AutoLevelAdjustConfig,
    | 'enabled'
    | 'mode'
    | 'threshold'
    | 'aboveThresholdCount'
    | 'belowThresholdCount'
    | 'currentLevel'
    | 'pairedDigitsLevel'
  >,
): AutoLevelAdjustProgressView | null {
  if (!config.enabled) {
    return null;
  }

  const mixed = isMixedAdjustMode(config.mode);
  const digitsLevel = mixed ? mixedDigitsLevel(config) : undefined;
  const threshold = Math.max(0, Math.min(100, config.threshold));
  const counts = getAutoLevelAdjustCounts(config.mode, config.currentLevel, digitsLevel);
  const aboveTarget = sessionTarget(Math.max(0, config.aboveThresholdCount));
  const belowTarget = sessionTarget(Math.max(0, config.belowThresholdCount));

  return {
    levelLabel: MODE_LABELS[config.mode],
    currentLevel: config.currentLevel,
    ...(digitsLevel !== undefined ? { currentDigitsLevel: digitsLevel } : {}),
    adjustsBothLevels: mixed,
    threshold,
    aboveCount: counts.above,
    belowCount: counts.below,
    aboveTarget,
    belowTarget,
    aboveDisabled: config.aboveThresholdCount === 0,
    belowDisabled: config.belowThresholdCount === 0,
  };
}

// ── Core logic ─────────────────────────────────────────────────────────

/**
 * Evaluate whether the training level should change after a session.
 *
 * Reads / writes mode-specific localStorage counters and returns the
 * adjustment decision (or `null` if no change is needed).
 *
 * Mixed mode adjusts alphabet and digits levels together by the same delta.
 */
export function evaluateAutoLevelAdjust(
  accuracyFraction: number,
  config: AutoLevelAdjustConfig,
): AutoLevelAdjustResult | null {
  if (!config.enabled) return null;

  const { mode, aboveThresholdCount, belowThresholdCount, currentLevel } = config;
  const mixed = isMixedAdjustMode(mode);
  const digitsLevel = mixed ? mixedDigitsLevel(config) : undefined;
  const threshold = Math.max(0, Math.min(100, config.threshold));
  const maxKochLevel = config.maxLevel ?? MAX_KOCH_LEVEL_GUESS;
  const maxDigits = config.maxDigitsLevel ?? MAX_DIGITS_LEVEL;
  const accuracyPct = (accuracyFraction || 0) * 100;

  const counts = loadCounts(mode, currentLevel, digitsLevel);
  if (accuracyPct >= threshold) {
    counts.above += 1;
  } else {
    counts.below += 1;
  }
  saveCounts(mode, currentLevel, counts, digitsLevel);

  const increaseEnabled = aboveThresholdCount > 0;
  const decreaseEnabled = belowThresholdCount > 0;

  const shouldIncrease =
    increaseEnabled && counts.above >= aboveThresholdCount;
  const shouldDecrease =
    decreaseEnabled && counts.below >= belowThresholdCount;

  let delta = 0;
  if (shouldIncrease && shouldDecrease) {
    delta = counts.above >= counts.below ? 1 : -1;
  } else if (shouldIncrease) {
    delta = 1;
  } else if (shouldDecrease) {
    delta = -1;
  }

  if (delta === 0) return null;

  const nextLevel = Math.max(
    MIN_KOCH_LEVEL,
    Math.min((currentLevel || MIN_KOCH_LEVEL) + delta, maxKochLevel),
  );

  if (!mixed) {
    if (nextLevel === currentLevel) return null;

    removeLevelCounts(mode, currentLevel);
    removeLevelCounts(mode, nextLevel);

    const countText =
      delta > 0
        ? aboveThresholdCount === 0
          ? ''
          : `${counts.above} sessions above`
        : belowThresholdCount === 0
          ? ''
          : `${counts.below} sessions below`;

    const label = MODE_LABELS[mode];
    const countSuffix = countText ? `, ${countText}` : '';

    return {
      delta,
      nextLevel,
      message: `${label} ${delta > 0 ? 'increased' : 'decreased'} to ${nextLevel} (accuracy ${Math.round(accuracyPct)}%, threshold ${threshold}%${countSuffix})`,
      messageType: delta > 0 ? 'success' : 'info',
    };
  }

  const currentDigits = mixedDigitsLevel(config);
  const nextDigitsLevel = Math.max(
    MIN_DIGITS_LEVEL,
    Math.min(currentDigits + delta, maxDigits),
  );

  if (nextLevel === currentLevel && nextDigitsLevel === currentDigits) {
    return null;
  }

  removeLevelCounts(mode, currentLevel, currentDigits);
  removeLevelCounts(mode, nextLevel, nextDigitsLevel);

  const countText =
    delta > 0
      ? aboveThresholdCount === 0
        ? ''
        : `${counts.above} sessions above`
      : belowThresholdCount === 0
        ? ''
        : `${counts.below} sessions below`;
  const countSuffix = countText ? `, ${countText}` : '';

  return {
    delta,
    nextLevel,
    nextDigitsLevel,
    message: `Mixed levels ${delta > 0 ? 'increased' : 'decreased'} — alphabet ${nextLevel}, digits ${nextDigitsLevel} (accuracy ${Math.round(accuracyPct)}%, threshold ${threshold}%${countSuffix})`,
    messageType: delta > 0 ? 'success' : 'info',
  };
}

/** @deprecated Use evaluateAutoLevelAdjust instead. */
export const evaluateKochAutoAdjust = evaluateAutoLevelAdjust;
