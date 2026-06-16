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
export type TrainingMode = 'group' | 'icr' | 'echo' | 'chase' | 'player';

/** Persisted session families stored in the shared session history. */
export type SessionMode = 'group' | 'echo' | 'chase';

/** Echo-mode keyer behaviour when sending with paddles. */
export type EchoKeyerMode = 'manual' | 'iambic-b';

/** Characteristic CW-band interference profiles for QRM simulation. */
export type QrmProfile = 'whistle' | 'ringing' | 'mixed';

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
  readonly qsbEnabled?: boolean;
  readonly qsbDepth?: number;
  readonly qsbRateHz?: number;
  readonly qrnEnabled?: boolean;
  readonly qrnLevel?: number;
  readonly qrmEnabled?: boolean;
  readonly qrmLevel?: number;
  readonly qrmProfile?: QrmProfile;
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
  /** Scales standard word-space timing between groups (Group/Echo) and at spaces (Player). */
  readonly extraWordSpaceMultiplier: number;
  readonly groupTimeout: number;
  /** Group-only: block typing in the active group until Morse playback finishes. Default true. */
  readonly lockInputDuringGroupPlayback?: boolean;
  readonly minGroupSize: number;
  readonly maxGroupSize: number;
  readonly linkGroupSize: boolean;
  readonly envelopeSmoothing: number;
  readonly qsbEnabled: boolean;
  readonly qsbDepth: number;
  readonly qsbRateHz: number;
  readonly qrnEnabled: boolean;
  readonly qrnLevel: number;
  readonly qrmEnabled: boolean;
  readonly qrmLevel: number;
  readonly qrmProfile: QrmProfile;
  readonly receiverBackgroundGain: number;
  readonly receiverBackgroundExcitationRate: number;
  readonly receiverBackgroundResonance: number;
  readonly receiverBackgroundDecay: number;
  readonly receiverBackgroundOffsetHz: number;
  readonly receiverBackgroundOffsetModDepthHz: number;
  readonly receiverBackgroundOffsetModRateHz: number;
  readonly autoAdjustKoch: boolean;
  readonly autoAdjustThreshold: number;
  readonly autoAdjustBelowThresholdCount: number;
  readonly autoAdjustAboveThresholdCount: number;
  /** Echo-only: auto level from echo session accuracy (separate counters from group training). */
  readonly echoAutoAdjustKoch: boolean;
  readonly echoAutoAdjustThreshold: number;
  readonly echoAutoAdjustBelowThresholdCount: number;
  readonly echoAutoAdjustAboveThresholdCount: number;
  /** Chase-only: lives available at the start of an arcade run. */
  readonly chaseLives: number;
  /** Chase-only: whether completed levels unlock more characters during the run. */
  readonly chaseAutoLevelEnabled: boolean;
  /** Chase-only: correct groups needed before level pressure/unlocks advance. */
  readonly chaseGroupsPerLevel: number;
  /** Chase-only: initial falling target time budget in milliseconds. */
  readonly chaseStartFallMs: number;
  /** Chase-only: lower bound for falling target time budget in milliseconds. */
  readonly chaseMinFallMs: number;
  /** Chase-only: milliseconds removed from fall time each Chase level. */
  readonly chaseLevelSpeedupMs: number;
  /** Chase-only: milliseconds removed from fall time for each completed Chase target. */
  readonly chaseGroupSpeedupMs: number;
  readonly errorWeightStrength: number;
  /** Biases sampling toward under-practiced characters within a session (0 = off). */
  readonly charSamplingCoverageStrength?: number;
  /** When true, draw per-character error rates from Beta posteriors before each group. */
  readonly charSamplingThompson?: boolean;
  /** Player-only: speak each character after its Morse repeats. */
  readonly playerAnnounceLetters?: boolean;
  /** Player-only: Morse repeats for one character before speech. */
  readonly playerLetterRepeatCount?: number;
  /** Player-only: choose letters randomly from the current unlocked alphabet instead of typed text. */
  readonly playerRandomizeLetters?: boolean;
  /** Player-only: delay after a character has completed Morse/speech. */
  readonly playerDelaySeconds?: number;
  /** Player-only: browser speechSynthesis voice URI; empty means browser default. */
  readonly playerSpeechVoiceURI?: string;
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
  /** Koch / custom alphabet level at session time (when persisted). */
  readonly kochLevel?: number;
  /** Digits level at session time (digits / mixed modes). */
  readonly digitsLevel?: number;
  /** Character-set mode at session time. */
  readonly charSetMode?: CharacterSetMode;
}

/** Aggregate statistics for calendar heatmap visualisations. */
export interface DailyAggregate {
  readonly date: string;
  readonly sessionCount: number;
  readonly totalCharacters: number;
}

/** One session row for activity heatmaps (calendar cells, tooltips). */
export interface HeatmapSession {
  readonly date: string;
  readonly timestamp: number;
  readonly count: number;
  readonly durationMs?: number;
  readonly groupCount?: number;
  readonly accuracy?: number;
}

/** Per-character accuracy summary used in analytics views. */
export interface LetterStatistic {
  readonly character: string;
  readonly accuracy: number;
  readonly total: number;
  readonly correct: number;
}
