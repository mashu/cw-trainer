import type { IcrSettings, IcrSessionResult, IcrTrialResult, IcrAudioSnapshot, IcrLetterStats } from '@/types';

export type RawIcrTrial = {
  readonly target?: string;
  readonly heardAt?: number;
  readonly stopAt?: number;
  readonly reactionMs?: number;
  readonly typed?: string;
  readonly correct?: boolean;
};

export type SharedAudioSnapshot = {
  readonly kochLevel: number;
  readonly charSetMode?: 'koch' | 'digits' | 'custom';
  readonly digitsLevel?: number;
  readonly customSet?: string[];
  readonly charWpm: number;
  readonly effectiveWpm?: number;
  readonly sideToneMin: number;
  readonly sideToneMax: number;
  readonly steepness: number;
  readonly envelopeSmoothing?: number;
};

export interface FormatIcrSessionParams {
  readonly trials: readonly RawIcrTrial[];
  readonly sharedAudio: SharedAudioSnapshot;
  readonly icrSettings: IcrSettings;
  readonly timestamp?: number;
}

const clampNumber = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const normalizeTrial = (trial: RawIcrTrial): IcrTrialResult => {
  const target = typeof trial.target === 'string' ? trial.target.trim().toUpperCase().slice(-1) : '';
  const typedRaw = typeof trial.typed === 'string' ? trial.typed.trim().toUpperCase().slice(-1) : undefined;
  const heardAt = typeof trial.heardAt === 'number' && Number.isFinite(trial.heardAt)
    ? Math.max(0, Math.round(trial.heardAt))
    : 0;
  const stopAt = typeof trial.stopAt === 'number' && Number.isFinite(trial.stopAt)
    ? Math.max(0, Math.round(trial.stopAt))
    : undefined;
  const reactionMs = typeof trial.reactionMs === 'number' && Number.isFinite(trial.reactionMs)
    ? Math.max(0, Math.round(trial.reactionMs))
    : undefined;
  const correct = typedRaw ? typedRaw === target : undefined;

  return {
    target,
    heardAt,
    ...(stopAt !== undefined ? { stopAt } : {}),
    ...(reactionMs !== undefined ? { reactionMs } : {}),
    ...(typedRaw !== undefined ? { typed: typedRaw } : {}),
    ...(correct !== undefined ? { correct } : {}),
  };
};

const normalizeSharedAudio = (snapshot: SharedAudioSnapshot): IcrAudioSnapshot => {
  return {
    kochLevel: clampNumber(Math.round(snapshot.kochLevel || 0), 0, 100),
    charWpm: clampNumber(Math.round(snapshot.charWpm || 0), 1, 200),
    sideToneMin: clampNumber(Math.round(snapshot.sideToneMin || 0), 0, 10_000),
    sideToneMax: clampNumber(Math.round(snapshot.sideToneMax || 0), 0, 10_000),
    steepness: Number.isFinite(snapshot.steepness) ? snapshot.steepness : 0,
    ...(snapshot.charSetMode !== undefined ? { charSetMode: snapshot.charSetMode } : {}),
    ...(typeof snapshot.digitsLevel === 'number' 
      ? { digitsLevel: clampNumber(Math.round(snapshot.digitsLevel), 0, 10) } 
      : {}),
    ...(Array.isArray(snapshot.customSet) && snapshot.customSet.length > 0
      ? { 
          customSet: snapshot.customSet
            .map((entry) => (typeof entry === 'string' ? entry.trim().toUpperCase() : ''))
            .filter((entry) => entry.length > 0)
        } 
      : {}),
    ...(typeof snapshot.effectiveWpm === 'number'
      ? { effectiveWpm: clampNumber(Math.round(snapshot.effectiveWpm), 1, 200) }
      : {}),
    ...(Number.isFinite(snapshot.envelopeSmoothing)
      ? { envelopeSmoothing: snapshot.envelopeSmoothing }
      : {}),
  };
};

export const formatSession = ({
  trials,
  sharedAudio,
  icrSettings,
  timestamp,
}: FormatIcrSessionParams): IcrSessionResult | null => {
  if (!trials.length) {
    return null;
  }

  const normalizedTrials = trials.map(normalizeTrial);
  const answeredTrials = normalizedTrials.filter((trial) => Boolean(trial.typed));

  if (!answeredTrials.length) {
    return null;
  }

  const timestampValue = typeof timestamp === 'number' && Number.isFinite(timestamp)
    ? Math.round(timestamp)
    : Date.now();
  const dateStr = new Date(timestampValue).toISOString().split('T')[0];
  const date = dateStr || new Date().toISOString().split('T')[0] || '';
  if (!date) throw new Error('Failed to generate date string');

  const reactionSamples = answeredTrials
    .map((trial) => trial.reactionMs)
    .filter((value): value is number => typeof value === 'number' && value > 0);
  const averageReactionMs = reactionSamples.length
    ? Math.round(reactionSamples.reduce((sum, value) => sum + value, 0) / reactionSamples.length)
    : 0;

  const correctCount = answeredTrials.filter((trial) => trial.correct).length;
  const accuracyPercent = Math.round((correctCount / answeredTrials.length) * 100);

  const perLetterAggregates: Record<string, { correct: number; total: number; reactions: number[] }> = {};
  normalizedTrials.forEach((trial) => {
    const letter = trial.target;
    if (!letter) {
      return;
    }
    if (!perLetterAggregates[letter]) {
      perLetterAggregates[letter] = { correct: 0, total: 0, reactions: [] };
    }
    if (trial.typed) {
      perLetterAggregates[letter].total += 1;
      if (trial.correct) {
        perLetterAggregates[letter].correct += 1;
      }
    }
    if (typeof trial.reactionMs === 'number' && trial.reactionMs > 0) {
      perLetterAggregates[letter].reactions.push(trial.reactionMs);
    }
  });

  const perLetter: Record<string, IcrLetterStats> = {};
  Object.entries(perLetterAggregates).forEach(([letter, aggregate]) => {
    const averageReaction = aggregate.reactions.length
      ? Math.round(aggregate.reactions.reduce((sum, value) => sum + value, 0) / aggregate.reactions.length)
      : 0;
    perLetter[letter] = {
      correct: aggregate.correct,
      total: aggregate.total,
      averageReactionMs: averageReaction,
    };
  });

  return {
    timestamp: timestampValue,
    date,
    trials: normalizedTrials,
    averageReactionMs,
    accuracyPercent,
    settingsSnapshot: {
      audio: normalizeSharedAudio(sharedAudio),
      icr: icrSettings,
    },
    perLetter,
  };
};


