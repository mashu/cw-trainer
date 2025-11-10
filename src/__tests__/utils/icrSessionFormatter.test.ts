import { describe, expect, it } from '@jest/globals';

import type { RawIcrTrial } from '@/lib/utils/icrSessionFormatter';
import { formatSession } from '@/lib/utils/icrSessionFormatter';

const sharedAudioSnapshot = {
  kochLevel: 5,
  charSetMode: 'koch' as const,
  digitsLevel: 2,
  customSet: ['a', 'b', 'c'],
  charWpm: 18,
  effectiveWpm: 12,
  sideToneMin: 600,
  sideToneMax: 700,
  steepness: 5,
  envelopeSmoothing: 0,
};

const icrSettings = {
  trialsPerSession: 30,
  trialDelayMs: 750,
  vadEnabled: true,
  vadThreshold: 0.08,
  vadHoldMs: 80,
  bucketGreenMaxMs: 350,
  bucketYellowMaxMs: 800,
};

describe('formatSession', () => {
  it('returns null when there are no trials', () => {
    expect(
      formatSession({
        trials: [],
        sharedAudio: sharedAudioSnapshot,
        icrSettings,
      }),
    ).toBeNull();
  });

  it('returns null when no trials have typed results', () => {
    const trials: RawIcrTrial[] = [
      { target: 'a', heardAt: 100, stopAt: 120, reactionMs: 20 },
    ];

    expect(
      formatSession({
        trials,
        sharedAudio: sharedAudioSnapshot,
        icrSettings,
      }),
    ).toBeNull();
  });

  it('normalises trials and aggregates stats correctly', () => {
    const trials: RawIcrTrial[] = [
      {
        target: 'a',
        heardAt: 1_000,
        stopAt: 1_150,
        reactionMs: 150,
        typed: 'a',
        correct: true,
      },
      {
        target: 'b',
        heardAt: 2_000,
        stopAt: 2_220,
        reactionMs: 220,
        typed: 'c',
        correct: false,
      },
      {
        target: 'd',
        heardAt: 3_000,
        stopAt: 3_150,
        reactionMs: 150,
        typed: 'd',
        correct: true,
      },
    ];

    const result = formatSession({
      trials,
      sharedAudio: sharedAudioSnapshot,
      icrSettings,
      timestamp: 1_694_000_000_000,
    });

    expect(result).not.toBeNull();
    expect(result).toMatchObject({
      timestamp: 1_694_000_000_000,
      averageReactionMs: Math.round((150 + 220 + 150) / 3),
      accuracyPercent: Math.round((2 / 3) * 100),
    });

    expect(result?.trials).toHaveLength(3);
    expect(result?.trials[0]).toMatchObject({
      target: 'A',
      typed: 'A',
      correct: true,
    });

    expect(result?.perLetter['A']).toEqual({ correct: 1, total: 1, averageReactionMs: 150 });
    expect(result?.perLetter['B']).toEqual({ correct: 0, total: 1, averageReactionMs: 220 });
    expect(result?.perLetter['D']).toEqual({ correct: 1, total: 1, averageReactionMs: 150 });

    expect(result?.settingsSnapshot.audio).toMatchObject({
      kochLevel: 5,
      charWpm: 18,
      sideToneMin: 600,
      sideToneMax: 700,
    });
    expect(result?.settingsSnapshot.icr).toMatchObject({ trialsPerSession: 30, trialDelayMs: 750 });
  });
});
