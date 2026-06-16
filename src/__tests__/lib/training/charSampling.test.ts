import { DEFAULT_TRAINING_SETTINGS } from '@/config/training.config';
import {
  betaPosteriorMeanError,
  buildCharSamplingSnapshot,
  computeRawSamplingWeights,
  createInitialSamplingState,
  normalizeWeights,
  sampleBeta,
  sampleTrainingGroup,
  updateSamplingStateFromAnswer,
  type CharSamplingConfig,
  type RandomSource,
} from '@/lib/training/charSampling';
import type { SessionResult, TrainingSettings } from '@/types';

const baseSettings: TrainingSettings = {
  ...DEFAULT_TRAINING_SETTINGS,
  kochLevel: 1,
  charSetMode: 'koch',
  minGroupSize: 3,
  maxGroupSize: 3,
  errorWeightStrength: 4,
  charSamplingCoverageStrength: 1,
  charSamplingThompson: false,
};

const makeSession = (
  letterAccuracy: SessionResult['letterAccuracy'],
): SessionResult => ({
  date: '2026-01-01',
  timestamp: 1,
  startedAt: 1,
  finishedAt: 2,
  groups: [],
  groupTimings: [],
  accuracy: 0.5,
  letterAccuracy,
  alphabetSize: 2,
  totalChars: 4,
  effectiveAlphabetSize: 2,
  avgResponseMs: 1000,
  score: 1,
  mode: 'group',
});

describe('charSampling', () => {
  it('builds Beta posteriors from historical letter accuracy', () => {
    const state = createInitialSamplingState([
      makeSession({
        K: { correct: 1, total: 3 },
        M: { correct: 3, total: 3 },
      }),
    ]);

    const kBelief = state.beliefs['K'];
    const mBelief = state.beliefs['M'];
    expect(kBelief).toEqual({ alpha: 2, beta: 3 });
    expect(mBelief).toEqual({ alpha: 4, beta: 1 });
    expect(betaPosteriorMeanError(kBelief!)).toBeCloseTo(3 / 5);
    expect(betaPosteriorMeanError(mBelief!)).toBeCloseTo(1 / 5);
  });

  it('updates beliefs after a group answer', () => {
    const initial = createInitialSamplingState([]);
    const updated = updateSamplingStateFromAnswer(initial, 'KM', 'KN');
    expect(updated.beliefs['K']?.alpha).toBe(2);
    expect(updated.beliefs['M']?.beta).toBe(2);
  });

  it('biases sampling toward high-error characters', () => {
    const state = createInitialSamplingState([
      makeSession({
        K: { correct: 0, total: 10 },
        M: { correct: 10, total: 10 },
      }),
    ]);
    const pool = ['K', 'M'];
    const config: CharSamplingConfig = {
      errorWeightStrength: 4,
      coverageStrength: 0,
      thompsonSampling: false,
      mixedLettersPercent: 70,
      charSetMode: 'koch',
    };
    const weights = computeRawSamplingWeights(pool, state, config);
    expect(weights['K'] ?? 0).toBeGreaterThan(weights['M'] ?? 0);
  });

  it('applies mixed-mode letter/digit split while respecting weights', () => {
    const state = createInitialSamplingState([
      makeSession({
        K: { correct: 0, total: 8 },
        '0': { correct: 8, total: 8 },
      }),
    ]);
    const pool = ['K', '0'];
    const config: CharSamplingConfig = {
      errorWeightStrength: 4,
      coverageStrength: 0,
      thompsonSampling: false,
      mixedLettersPercent: 100,
      charSetMode: 'mixed',
    };

    let letterCount = 0;
    for (let i = 0; i < 200; i += 1) {
      const sampled = sampleTrainingGroup(pool, 1, state, config);
      if (sampled.group === 'K') {
        letterCount += 1;
      }
    }
    expect(letterCount).toBeGreaterThan(120);
  });

  it('boosts under-sampled characters via coverage strength', () => {
    const state = {
      beliefs: {},
      sessionSampleCounts: { K: 20, M: 0 },
    };
    const pool = ['K', 'M'];
    const config: CharSamplingConfig = {
      errorWeightStrength: 0,
      coverageStrength: 2,
      thompsonSampling: false,
      mixedLettersPercent: 70,
      charSetMode: 'koch',
    };
    const weights = computeRawSamplingWeights(pool, state, config);
    expect(weights['M'] ?? 0).toBeGreaterThan(weights['K'] ?? 0);
  });

  it('normalizes sampling probabilities to one', () => {
    const probs = normalizeWeights(['K', 'M'], { K: 3, M: 1 });
    expect((probs['K'] ?? 0) + (probs['M'] ?? 0)).toBeCloseTo(1);
  });

  it('supports deterministic Thompson draws with injected randomness', () => {
    const rng: RandomSource = {
      random: (() => {
        let i = 0;
        const values = [0.2, 0.8, 0.1, 0.9, 0.3, 0.7];
        return () => {
          const value = values[i % values.length] ?? 0.5;
          i += 1;
          return value;
        };
      })(),
    };
    const draw = sampleBeta(2, 8, rng);
    expect(draw).toBeGreaterThanOrEqual(0);
    expect(draw).toBeLessThanOrEqual(1);
  });

  it('builds a snapshot for the sampling panel', () => {
    const snapshot = buildCharSamplingSnapshot(
      baseSettings,
      [makeSession({ K: { correct: 1, total: 2 }, M: { correct: 2, total: 2 } })],
    );
    expect(snapshot.rows.length).toBeGreaterThan(0);
    expect(snapshot.rows.some((row) => row.character === 'K')).toBe(true);
    const totalProb = snapshot.rows.reduce((sum, row) => sum + row.samplingProb, 0);
    expect(totalProb).toBeCloseTo(1, 5);
  });
});
