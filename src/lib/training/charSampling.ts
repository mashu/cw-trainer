import { alignGroup } from '@/lib/groupAlignment';
import { computeCharPool, weightedRandomPick, type TrainingSettingsLite } from '@/lib/trainingUtils';
import type { CharacterSetMode, SessionResult, TrainingSettings } from '@/types';

/** Uninformative Beta(1, 1) prior mass per character before observations. */
export const CHAR_SAMPLING_PRIOR_ALPHA = 1;
export const CHAR_SAMPLING_PRIOR_BETA = 1;

const DIGITS_SET = new Set<string>(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);

export type CharBetaBelief = {
  readonly alpha: number;
  readonly beta: number;
};

export type CharSamplingState = {
  /** Beta(α, β) posterior sufficient statistics per character (includes prior). */
  readonly beliefs: Readonly<Record<string, CharBetaBelief>>;
  /** Characters sampled in the current session (for coverage balancing). */
  readonly sessionSampleCounts: Readonly<Record<string, number>>;
};

export type CharSamplingConfig = {
  readonly errorWeightStrength: number;
  readonly coverageStrength: number;
  readonly thompsonSampling: boolean;
  readonly mixedLettersPercent: number;
  readonly charSetMode: CharacterSetMode;
};

export type CharSamplingRow = {
  readonly character: string;
  readonly pError: number;
  readonly samplingWeight: number;
  readonly samplingProb: number;
  readonly sessionSamples: number;
  readonly alpha: number;
  readonly beta: number;
  readonly isLetter: boolean;
};

export type CharSamplingSnapshot = {
  readonly pool: readonly string[];
  readonly rows: readonly CharSamplingRow[];
  readonly config: CharSamplingConfig;
  readonly thompsonSampling: boolean;
};

export type RandomSource = {
  readonly random: () => number;
};

export const defaultRandomSource: RandomSource = { random: Math.random };

export function emptyCharSamplingState(): CharSamplingState {
  return { beliefs: {}, sessionSampleCounts: {} };
}

export function beliefForCharacter(
  state: CharSamplingState,
  character: string,
): CharBetaBelief {
  const existing = state.beliefs[character];
  if (existing) {
    return existing;
  }
  return { alpha: CHAR_SAMPLING_PRIOR_ALPHA, beta: CHAR_SAMPLING_PRIOR_BETA };
}

export function aggregateHistoricalBeliefs(
  sessions: readonly SessionResult[],
): Readonly<Record<string, CharBetaBelief>> {
  const beliefs: Record<string, CharBetaBelief> = {};

  sessions.forEach((session) => {
    Object.entries(session.letterAccuracy).forEach(([character, stats]) => {
      const errors = stats.total - stats.correct;
      const existing = beliefs[character] ?? {
        alpha: CHAR_SAMPLING_PRIOR_ALPHA,
        beta: CHAR_SAMPLING_PRIOR_BETA,
      };
      beliefs[character] = {
        alpha: existing.alpha + stats.correct,
        beta: existing.beta + errors,
      };
    });
  });

  return beliefs;
}

export function createInitialSamplingState(
  historicalSessions: readonly SessionResult[],
): CharSamplingState {
  return {
    beliefs: aggregateHistoricalBeliefs(historicalSessions),
    sessionSampleCounts: {},
  };
}

export function betaPosteriorMeanError(belief: CharBetaBelief): number {
  const denom = belief.alpha + belief.beta;
  if (denom <= 0) {
    return 0.5;
  }
  return belief.beta / denom;
}

function randomNormal(rng: RandomSource): number {
  let u = 0;
  let v = 0;
  while (u === 0) {
    u = rng.random();
  }
  while (v === 0) {
    v = rng.random();
  }
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function sampleGamma(shape: number, rng: RandomSource): number {
  if (shape <= 0) {
    return 0;
  }
  if (shape < 1) {
    const boosted = sampleGamma(shape + 1, rng);
    return boosted * Math.pow(rng.random(), 1 / shape);
  }

  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  while (true) {
    let x = 0;
    let v = 0;
    do {
      x = randomNormal(rng);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = rng.random();
    if (u < 1 - 0.0331 * x * x * x * x) {
      return d * v;
    }
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
      return d * v;
    }
  }
}

export function sampleBeta(
  alpha: number,
  beta: number,
  rng: RandomSource = defaultRandomSource,
): number {
  const x = sampleGamma(alpha, rng);
  const y = sampleGamma(beta, rng);
  const denom = x + y;
  if (denom <= 0) {
    return 0.5;
  }
  return x / denom;
}

export function charSamplingConfigFromSettings(
  settings: Pick<
    TrainingSettings,
    | 'errorWeightStrength'
    | 'charSamplingCoverageStrength'
    | 'charSamplingThompson'
    | 'mixedLettersPercent'
    | 'charSetMode'
  >,
): CharSamplingConfig {
  return {
    errorWeightStrength: settings.errorWeightStrength ?? 0,
    coverageStrength: settings.charSamplingCoverageStrength ?? 1,
    thompsonSampling: settings.charSamplingThompson ?? false,
    mixedLettersPercent: settings.mixedLettersPercent ?? 70,
    charSetMode: settings.charSetMode ?? 'koch',
  };
}

function coverageFactors(
  pool: readonly string[],
  sessionSampleCounts: Readonly<Record<string, number>>,
  coverageStrength: number,
): Readonly<Record<string, number>> {
  if (coverageStrength <= 0) {
    return Object.fromEntries(pool.map((character) => [character, 1]));
  }

  const totalSamples = pool.reduce(
    (sum, character) => sum + (sessionSampleCounts[character] ?? 0),
    0,
  );
  const expectedPerChar = pool.length > 0 ? totalSamples / pool.length : 0;
  const factors: Record<string, number> = {};

  pool.forEach((character) => {
    const seen = sessionSampleCounts[character] ?? 0;
    const deficit =
      expectedPerChar > 0 ? Math.max(0, expectedPerChar - seen) / expectedPerChar : 1;
    factors[character] = 1 + coverageStrength * deficit;
  });

  return factors;
}

function difficultyFactor(pError: number, errorWeightStrength: number): number {
  if (errorWeightStrength <= 0) {
    return 1;
  }
  return 1 + pError * errorWeightStrength;
}

export function computeRawSamplingWeights(
  pool: readonly string[],
  state: CharSamplingState,
  config: CharSamplingConfig,
  rng: RandomSource = defaultRandomSource,
): Readonly<Record<string, number>> {
  const coverage = coverageFactors(pool, state.sessionSampleCounts, config.coverageStrength);
  const weights: Record<string, number> = {};

  pool.forEach((character) => {
    const belief = beliefForCharacter(state, character);
    const pError = config.thompsonSampling
      ? sampleBeta(belief.alpha, belief.beta, rng)
      : betaPosteriorMeanError(belief);
    const coverageFactor = coverage[character] ?? 1;
    weights[character] = difficultyFactor(pError, config.errorWeightStrength) * coverageFactor;
  });

  return weights;
}

export function normalizeWeights(
  pool: readonly string[],
  weights: Readonly<Record<string, number>>,
): Readonly<Record<string, number>> {
  let total = 0;
  pool.forEach((character) => {
    total += weights[character] ?? 0;
  });
  if (total <= 0) {
    const uniform = pool.length > 0 ? 1 / pool.length : 0;
    return Object.fromEntries(pool.map((character) => [character, uniform]));
  }
  return Object.fromEntries(
    pool.map((character) => [character, (weights[character] ?? 0) / total]),
  );
}

export function buildCharSamplingSnapshot(
  settings: TrainingSettings,
  historicalSessions: readonly SessionResult[],
  sessionState: CharSamplingState = createInitialSamplingState(historicalSessions),
): CharSamplingSnapshot {
  const poolSettings: TrainingSettingsLite = {
    kochLevel: settings.kochLevel,
    minGroupSize: settings.minGroupSize,
    maxGroupSize: settings.maxGroupSize,
    charSetMode: settings.charSetMode,
    ...(settings.digitsLevel !== undefined ? { digitsLevel: settings.digitsLevel } : {}),
    ...(settings.charSetMode === 'mixed'
      ? { mixedLettersPercent: settings.mixedLettersPercent ?? 70 }
      : {}),
    ...(settings.customSet.length > 0 ? { customSet: [...settings.customSet] } : {}),
    ...(settings.customSequence && settings.customSequence.length > 0
      ? { customSequence: [...settings.customSequence] }
      : {}),
    ...(settings.slidingWindowStart !== undefined
      ? { slidingWindowStart: settings.slidingWindowStart }
      : {}),
    ...(settings.slidingWindowEnd !== undefined
      ? { slidingWindowEnd: settings.slidingWindowEnd }
      : {}),
  };
  const pool = computeCharPool(poolSettings);
  const config = charSamplingConfigFromSettings(settings);
  const rawWeights = computeRawSamplingWeights(pool, sessionState, config);
  const samplingProb = normalizeWeights(pool, rawWeights);

  const rows: CharSamplingRow[] = pool.map((character) => {
    const belief = beliefForCharacter(sessionState, character);
    return {
      character,
      pError: betaPosteriorMeanError(belief),
      samplingWeight: rawWeights[character] ?? 1,
      samplingProb: samplingProb[character] ?? 0,
      sessionSamples: sessionState.sessionSampleCounts[character] ?? 0,
      alpha: belief.alpha,
      beta: belief.beta,
      isLetter: !DIGITS_SET.has(character),
    };
  });

  return {
    pool,
    rows,
    config,
    thompsonSampling: config.thompsonSampling,
  };
}

function pickFromPool(
  pool: readonly string[],
  weights: Readonly<Record<string, number>>,
  rng: RandomSource,
): string {
  if (pool.length === 0) {
    return '';
  }
  const weightList = pool.map((character) => weights[character] ?? 1);
  return weightedRandomPick(pool, weightList, rng.random);
}

export function sampleTrainingGroup(
  pool: readonly string[],
  groupSize: number,
  state: CharSamplingState,
  config: CharSamplingConfig,
  rng: RandomSource = defaultRandomSource,
): { readonly group: string; readonly state: CharSamplingState } {
  if (pool.length === 0 || groupSize <= 0) {
    return { group: '', state };
  }

  const rawWeights = computeRawSamplingWeights(pool, state, config, rng);
  const lettersSubset = pool.filter((character) => !DIGITS_SET.has(character));
  const digitsSubset = pool.filter((character) => DIGITS_SET.has(character));
  const useMixedSplit =
    config.charSetMode === 'mixed' && lettersSubset.length > 0 && digitsSubset.length > 0;
  const mixedLettersPct = Math.max(0, Math.min(100, config.mixedLettersPercent)) / 100;

  let group = '';
  for (let i = 0; i < groupSize; i += 1) {
    if (useMixedSplit) {
      const pickLetters = rng.random() < mixedLettersPct;
      const subset = pickLetters ? lettersSubset : digitsSubset;
      const fallbackSubset = subset.length > 0 ? subset : pool;
      group += pickFromPool(fallbackSubset, rawWeights, rng);
    } else {
      group += pickFromPool(pool, rawWeights, rng);
    }
  }

  const sessionSampleCounts = { ...state.sessionSampleCounts };
  for (const character of group) {
    sessionSampleCounts[character] = (sessionSampleCounts[character] ?? 0) + 1;
  }

  return {
    group,
    state: {
      beliefs: state.beliefs,
      sessionSampleCounts,
    },
  };
}

export function updateSamplingStateFromAnswer(
  state: CharSamplingState,
  sent: string,
  received: string,
): CharSamplingState {
  const alignment = alignGroup(sent, received);
  const beliefs = { ...state.beliefs };

  alignment.forEach((pair) => {
    const character = pair.sentChar;
    if (!character) {
      return;
    }
    const belief = beliefForCharacter(state, character);
    beliefs[character] = pair.match
      ? { alpha: belief.alpha + 1, beta: belief.beta }
      : { alpha: belief.alpha, beta: belief.beta + 1 };
  });

  return {
    beliefs,
    sessionSampleCounts: state.sessionSampleCounts,
  };
}
