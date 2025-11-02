import type { CharacterSetMode } from './domain';

/** Response envelope for API errors. */
export interface ApiErrorResponse {
  readonly message: string;
  readonly code: string;
  readonly status: number;
  readonly details?: Readonly<Record<string, unknown>>;
}

/** DTO representation of training settings exchanged via HTTP. */
export interface TrainingSettingsDto {
  readonly kochLevel: number;
  readonly charSetMode: CharacterSetMode;
  readonly digitsLevel: number;
  readonly customSet: readonly string[];
  readonly sideToneMin: number;
  readonly sideToneMax: number;
  readonly steepness: number;
  readonly sessionDuration: number;
  readonly charsPerGroup: number;
  readonly numGroups: number;
  readonly charWpm: number;
  readonly effectiveWpm: number;
  readonly linkSpeeds: boolean;
  readonly extraWordSpaceMultiplier: number;
  readonly groupTimeout: number;
  readonly minGroupSize: number;
  readonly maxGroupSize: number;
  readonly interactiveMode: boolean;
  readonly envelopeSmoothing: number;
  readonly autoAdjustKoch: boolean;
  readonly autoAdjustThreshold: number;
}

/** DTO for a single group result. */
export interface SessionGroupDto {
  readonly sent: string;
  readonly received: string;
  readonly correct: boolean;
}

/** DTO for timing information. */
export interface SessionTimingDto {
  readonly timeToCompleteMs: number;
  readonly perCharMs?: number;
}

/** DTO for persisted session results. */
export interface SessionResultDto {
  readonly date: string;
  readonly timestamp: number;
  readonly startedAt: number;
  readonly finishedAt: number;
  readonly groups: readonly SessionGroupDto[];
  readonly groupTimings: readonly SessionTimingDto[];
  readonly accuracy: number;
  readonly letterAccuracy: Readonly<
    Record<string, { readonly correct: number; readonly total: number }>
  >;
  readonly alphabetSize: number;
  readonly avgResponseMs: number;
  readonly totalChars: number;
  readonly effectiveAlphabetSize: number;
  readonly score: number;
  readonly firestoreId?: string;
}

/** Payload for creating or updating training sessions via API. */
export interface UpsertSessionRequest {
  readonly session: SessionResultDto;
  readonly settings: TrainingSettingsDto;
}

/** API response when sessions are fetched. */
export interface SessionListResponse {
  readonly sessions: readonly SessionResultDto[];
}
