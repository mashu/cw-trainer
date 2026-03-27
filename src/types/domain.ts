import type { SessionResultDto, TrainingSettingsDto } from './api';

/** Unique identifier for a user. */
export type UserId = string;

/** Supported authentication providers. */
export type AuthProvider = 'google' | 'anonymous';

/**
 * Basic representation of an authenticated user inside the application domain.
 */
export interface AppUser {
  /** Stable unique identifier from the auth provider. */
  readonly id: UserId;
  /** Primary email address. */
  readonly email: string;
  /** Optional human readable display name. */
  readonly displayName?: string;
  /** Optional avatar URL supplied by the provider. */
  readonly photoUrl?: string;
  /** Last authentication provider used to log in. */
  readonly provider: AuthProvider;
}

/**
 * Training session modes describing how character groups are generated.
 */
export type CharacterSetMode = 'koch' | 'digits' | 'custom' | 'mixed';

/** High-level training modes exposed in the UI. */
export type TrainingMode = 'group' | 'icr' | 'echo' | 'player';

/** Persisted session families stored in the shared session history. */
export type SessionMode = 'group' | 'echo';

/** Echo-mode keyer behaviour when sending with paddles. */
export type EchoKeyerMode = 'manual' | 'iambic-b';

/**
 * Interactive Copy Response (ICR) configuration shared across components.
 */
export interface IcrSettings {
  readonly trialsPerSession: number;
  readonly trialDelayMs: number;
  readonly vadEnabled: boolean;
  readonly vadThreshold: number;
  readonly vadHoldMs: number;
  readonly micDeviceId?: string;
  /** Speaker→mic latency (ms) from calibration; used to reject echo. null = not calibrated. */
  readonly calibrationLatencyMs?: number | null;
  readonly bucketGreenMaxMs: number;
  readonly bucketYellowMaxMs: number;
  readonly bucketOrangeMaxMs: number;
}

/** Snapshot of audio parameters used during an ICR session. */
export interface IcrAudioSnapshot {
  readonly kochLevel: number;
  readonly charSetMode?: CharacterSetMode;
  readonly digitsLevel?: number;
  readonly mixedLettersPercent?: number;
  readonly customSet?: readonly string[];
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
}

/** Per-trial result captured during an ICR session. */
export interface IcrTrialResult {
  readonly target: string;
  readonly heardAt: number;
  readonly stopAt?: number;
  readonly reactionMs?: number;
  readonly typed?: string;
  readonly correct?: boolean;
}

/** Summarised per-letter metrics for an ICR session. */
export interface IcrLetterStats {
  readonly correct: number;
  readonly total: number;
  readonly averageReactionMs: number;
}

/** Aggregated record describing the outcome of an ICR session. */
export interface IcrSessionResult {
  readonly timestamp: number;
  readonly date: string;
  readonly trials: readonly IcrTrialResult[];
  readonly averageReactionMs: number;
  readonly accuracyPercent: number;
  readonly settingsSnapshot: {
    readonly audio: IcrAudioSnapshot;
    readonly icr: IcrSettings;
  };
  readonly perLetter: Readonly<Record<string, IcrLetterStats>>;
}

/**
 * Runtime configuration for an interactive Morse training session.
 */
export interface TrainingSettings {
  readonly kochLevel: number;
  readonly charSetMode: CharacterSetMode;
  readonly digitsLevel: number;
  /** When charSetMode is 'mixed': 0–100 = percent of characters that are letters (rest digits). Default 70. */
  readonly mixedLettersPercent?: number;
  readonly customSet: readonly string[];
  readonly customSequence?: readonly string[]; // Custom sequence order for Koch mode
  /** 1-based start index of character range within unlocked sequence (1 = first). Default 1. */
  readonly slidingWindowStart?: number;
  /** 1-based end index (inclusive) within unlocked sequence. Default = last unlocked (e.g. 40). */
  readonly slidingWindowEnd?: number;
  readonly sideToneMin: number;
  readonly sideToneMax: number;
  /** Volume (loudness) 0.1–1.0. When linkVolume is true or min=max, fixed volume; else sampled per symbol for weak-signal training. */
  readonly volumeMin: number;
  readonly volumeMax: number;
  readonly linkVolume: boolean;
  readonly steepness: number;
  readonly sessionDuration: number;
  readonly charsPerGroup: number;
  readonly numGroups: number;
  readonly charWpmMin: number;
  readonly charWpmMax: number;
  readonly linkCharWpm: boolean;
  readonly effectiveWpmMin: number;
  readonly effectiveWpmMax: number;
  readonly linkEffectiveWpm: boolean;
  readonly linkCharToEffective: boolean;
  readonly echoKeyerMode?: EchoKeyerMode;
  readonly extraWordSpaceMultiplier: number;
  readonly groupTimeout: number;
  readonly minGroupSize: number;
  readonly maxGroupSize: number;
  readonly linkGroupSize: boolean;
  readonly envelopeSmoothing: number;
  readonly autoAdjustKoch: boolean;
  readonly autoAdjustThreshold: number;
  readonly autoAdjustBelowThresholdCount: number;
  readonly autoAdjustAboveThresholdCount: number;
  readonly errorWeightStrength: number;
}

/**
 * Result for a single transmitted character group.
 */
export interface SessionGroup {
  readonly sent: string;
  readonly received: string;
  readonly correct: boolean;
}

/**
 * Timing metadata captured for a group answer.
 */
export interface SessionTiming {
  readonly timeToCompleteMs: number;
  readonly perCharMs?: number;
}

/**
 * Per-letter accuracy stats aggregated for a training session.
 */
export interface LetterAccuracy {
  readonly correct: number;
  readonly total: number;
}

/**
 * Domain model encapsulating an entire training session outcome.
 */
export interface SessionResult {
  readonly date: string;
  readonly timestamp: number;
  readonly startedAt: number;
  readonly finishedAt: number;
  readonly groups: readonly SessionGroup[];
  readonly groupTimings: readonly SessionTiming[];
  readonly accuracy: number;
  readonly letterAccuracy: Readonly<Record<string, LetterAccuracy>>;
  readonly alphabetSize: number;
  readonly avgResponseMs: number;
  readonly totalChars: number;
  readonly effectiveAlphabetSize: number;
  readonly score: number;
  readonly mode?: SessionMode;
  readonly firestoreId?: string;
}

/** Aggregate statistics for calendar heatmap visualisations. */
export interface DailyAggregate {
  readonly date: string;
  readonly sessionCount: number;
  readonly totalCharacters: number;
}

/** Per-character accuracy summary used in analytics views. */
export interface LetterStatistic {
  readonly character: string;
  readonly accuracy: number;
  readonly total: number;
  readonly correct: number;
}

/**
 * Mapping utilities between DTOs and domain models.
 */
export interface DomainMapper {
  readonly toDomainSession: (dto: SessionResultDto) => SessionResult;
  readonly toDtoSession: (result: SessionResult) => SessionResultDto;
  readonly toDomainSettings: (dto: TrainingSettingsDto) => TrainingSettings;
  readonly toDtoSettings: (settings: TrainingSettings) => TrainingSettingsDto;
}
