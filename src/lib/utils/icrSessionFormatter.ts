import { localDateForTimestamp } from '@/lib/localDate';
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
  readonly charSetMode?: 'koch' | 'digits' | 'custom' | 'mixed';
  readonly digitsLevel?: number;
  readonly mixedLettersPercent?: number;
  readonly customSet?: string[];
  readonly charWpmMin: number;
  readonly charWpmMax: number;
  readonly effectiveWpmMin?: number;
  readonly effectiveWpmMax?: number;
  readonly sideToneMin: number;
  readonly sideToneMax: number;
  readonly volumeMin?: number;
  readonly volumeMax?: number;
  readonly linkVolume?: boolean;
  readonly steepness: number;
  readonly envelopeSmoothing?: number;
  readonly qsbEnabled?: boolean;
  readonly qsbDepth?: number;
  readonly qsbRateHz?: number;
  readonly qrnEnabled?: boolean;
  readonly qrnLevel?: number;
  readonly qrmEnabled?: boolean;
  readonly qrmLevel?: number;
  readonly qrmProfile?: 'whistle' | 'ringing' | 'mixed';
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
    charWpmMin: clampNumber(Math.round(snapshot.charWpmMin || 0), 1, 200),
    charWpmMax: clampNumber(Math.round(snapshot.charWpmMax || 0), 1, 200),
    sideToneMin: clampNumber(Math.round(snapshot.sideToneMin || 0), 0, 10_000),
    sideToneMax: clampNumber(Math.round(snapshot.sideToneMax || 0), 0, 10_000),
    steepness: Number.isFinite(snapshot.steepness) ? snapshot.steepness : 0,
    ...(snapshot.charSetMode !== undefined ? { charSetMode: snapshot.charSetMode } : {}),
    ...(typeof snapshot.digitsLevel === 'number' 
      ? { digitsLevel: clampNumber(Math.round(snapshot.digitsLevel), 0, 10) } 
      : {}),
    ...(typeof snapshot.mixedLettersPercent === 'number'
      ? { mixedLettersPercent: clampNumber(Math.round(snapshot.mixedLettersPercent), 0, 100) }
      : {}),
    ...(Array.isArray(snapshot.customSet) && snapshot.customSet.length > 0
      ? { 
          customSet: snapshot.customSet
            .map((entry) => (typeof entry === 'string' ? entry.trim().toUpperCase() : ''))
            .filter((entry) => entry.length > 0)
        } 
      : {}),
    ...(typeof snapshot.effectiveWpmMin === 'number'
      ? { effectiveWpmMin: clampNumber(Math.round(snapshot.effectiveWpmMin), 1, 200) }
      : {}),
    ...(typeof snapshot.effectiveWpmMax === 'number'
      ? { effectiveWpmMax: clampNumber(Math.round(snapshot.effectiveWpmMax), 1, 200) }
      : {}),
    ...(Number.isFinite(snapshot.envelopeSmoothing)
      ? { envelopeSmoothing: snapshot.envelopeSmoothing }
      : {}),
    ...(typeof snapshot.volumeMin === 'number' && snapshot.volumeMin >= 0.1 && snapshot.volumeMin <= 1
      ? { volumeMin: snapshot.volumeMin }
      : {}),
    ...(typeof snapshot.volumeMax === 'number' && snapshot.volumeMax >= 0.1 && snapshot.volumeMax <= 1
      ? { volumeMax: snapshot.volumeMax }
      : {}),
    ...(typeof snapshot.linkVolume === 'boolean'
      ? { linkVolume: snapshot.linkVolume }
      : {}),
    ...(typeof snapshot.qsbEnabled === 'boolean'
      ? { qsbEnabled: snapshot.qsbEnabled }
      : {}),
    ...(typeof snapshot.qsbDepth === 'number'
      ? { qsbDepth: clampNumber(snapshot.qsbDepth, 0, 1) }
      : {}),
    ...(typeof snapshot.qsbRateHz === 'number'
      ? { qsbRateHz: clampNumber(snapshot.qsbRateHz, 0.03, 1.5) }
      : {}),
    ...(typeof snapshot.qrnEnabled === 'boolean'
      ? { qrnEnabled: snapshot.qrnEnabled }
      : {}),
    ...(typeof snapshot.qrnLevel === 'number'
      ? { qrnLevel: clampNumber(snapshot.qrnLevel, 0, 1) }
      : {}),
    ...(typeof snapshot.qrmEnabled === 'boolean'
      ? { qrmEnabled: snapshot.qrmEnabled }
      : {}),
    ...(typeof snapshot.qrmLevel === 'number'
      ? { qrmLevel: clampNumber(snapshot.qrmLevel, 0, 1) }
      : {}),
    ...(snapshot.qrmProfile === 'whistle' || snapshot.qrmProfile === 'ringing' || snapshot.qrmProfile === 'mixed'
      ? { qrmProfile: snapshot.qrmProfile }
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
  const date = localDateForTimestamp(timestampValue);

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


