import type { KaraokeOutcome } from '@/lib/chase';

/** Lifecycle of one karaoke note flying across the timeline. */
export type ChaseNoteStatus = 'incoming' | 'heard' | KaraokeOutcome;

export interface ChaseNoteSnapshot {
  readonly id: number;
  /** The letter this note carries (revealed in the UI only after resolution). */
  readonly char: string;
  /** Tone lane index, 0 = lowest (300 Hz). */
  readonly laneIndex: number;
  readonly toneHz: number;
  /** When the note appeared at the right edge of the timeline. */
  readonly spawnedAt: number;
  /** When the note crosses the hit line and its audio plays. */
  readonly hitAt: number;
  /** End of the answer window; unanswered notes are missed after this. */
  readonly windowEndAt: number;
  readonly status: ChaseNoteStatus;
  /** What the user typed when this note was resolved by a keystroke. */
  readonly typedChar?: string;
  readonly resolvedAt?: number;
}

export interface ChaseRecentLetterSnapshot {
  readonly id: number;
  readonly char: string;
  readonly outcome: KaraokeOutcome;
}

export interface ChaseSessionResultSummary {
  readonly accuracy: number;
  readonly score: number;
  readonly maxLevel: number;
  readonly durationMs: number;
  readonly bestCombo: number;
  readonly lettersTotal: number;
  readonly correctCount: number;
  readonly wrongCount: number;
  readonly missedCount: number;
  readonly peakWpm: number;
  readonly avgResponseMs: number;
  readonly letters: ReadonlyArray<{
    readonly char: string;
    readonly typed: string;
    readonly outcome: KaraokeOutcome;
  }>;
}

export interface ChaseTrainingActiveSnapshot {
  readonly status: 'starting' | 'running' | 'completing' | 'failed' | 'paused';
  readonly sessionId: number;
  readonly startedAt: number;
  readonly notes: readonly ChaseNoteSnapshot[];
  readonly recentLetters: readonly ChaseRecentLetterSnapshot[];
  readonly wpm: number;
  readonly calm: boolean;
  readonly level: number;
  readonly score: number;
  readonly combo: number;
  readonly bestCombo: number;
  readonly correctInLevel: number;
  readonly lettersHeard: number;
  readonly correctCount: number;
  readonly wrongCount: number;
  readonly missedCount: number;
  readonly errorMessage?: string;
  readonly pauseReason?: string;
}

export interface ChaseTrainingResultsSnapshot {
  readonly status: 'results';
  readonly result: ChaseSessionResultSummary;
}

export type ChaseTrainingRuntimeState =
  | { readonly status: 'idle' }
  | ChaseTrainingActiveSnapshot
  | ChaseTrainingResultsSnapshot;

/** Fields the session loop may update while a run is active. */
export type ChaseTrainingRuntimePatch = Partial<
  Pick<
    ChaseTrainingActiveSnapshot,
    | 'notes'
    | 'recentLetters'
    | 'wpm'
    | 'calm'
    | 'level'
    | 'score'
    | 'combo'
    | 'bestCombo'
    | 'correctInLevel'
    | 'lettersHeard'
    | 'correctCount'
    | 'wrongCount'
    | 'missedCount'
  >
>;

export interface BeginChaseTrainingSessionInput {
  readonly sessionId: number;
  readonly startedAt: number;
  readonly startWpm: number;
}

export const IDLE_CHASE_TRAINING_RUNTIME: ChaseTrainingRuntimeState = {
  status: 'idle',
} as const;

const isActiveSnapshot = (
  state: ChaseTrainingRuntimeState,
): state is ChaseTrainingActiveSnapshot => state.status !== 'idle' && state.status !== 'results';

export const isChaseTrainingRuntimeActive = (state: ChaseTrainingRuntimeState): boolean =>
  isActiveSnapshot(state);

export const isChaseTrainingRuntimeBlockingSync = (
  state: ChaseTrainingRuntimeState,
): boolean =>
  state.status === 'starting' ||
  state.status === 'running' ||
  state.status === 'completing' ||
  state.status === 'paused' ||
  state.status === 'failed';

export function beginChaseTrainingSession(
  input: BeginChaseTrainingSessionInput,
): ChaseTrainingRuntimeState {
  return {
    status: 'starting',
    sessionId: input.sessionId,
    startedAt: input.startedAt,
    notes: [],
    recentLetters: [],
    wpm: input.startWpm,
    calm: false,
    level: 1,
    score: 0,
    combo: 0,
    bestCombo: 0,
    correctInLevel: 0,
    lettersHeard: 0,
    correctCount: 0,
    wrongCount: 0,
    missedCount: 0,
  };
}

export function transitionChaseTrainingStatus(
  state: ChaseTrainingRuntimeState,
  status: ChaseTrainingActiveSnapshot['status'],
  options?: {
    readonly pauseReason?: string;
    readonly errorMessage?: string;
  },
): ChaseTrainingRuntimeState {
  if (!isActiveSnapshot(state)) return state;
  return {
    ...state,
    status,
    ...(options?.pauseReason !== undefined ? { pauseReason: options.pauseReason } : {}),
    ...(options?.errorMessage !== undefined ? { errorMessage: options.errorMessage } : {}),
  };
}

export function patchChaseTrainingRuntime(
  state: ChaseTrainingRuntimeState,
  patch: ChaseTrainingRuntimePatch,
): ChaseTrainingRuntimeState {
  if (!isActiveSnapshot(state)) return state;
  return { ...state, ...patch };
}

export function completeChaseTrainingSession(
  result: ChaseSessionResultSummary,
): ChaseTrainingRuntimeState {
  return { status: 'results', result };
}

export function cancelChaseTrainingSession(): ChaseTrainingRuntimeState {
  return IDLE_CHASE_TRAINING_RUNTIME;
}

export function dismissChaseTrainingResults(): ChaseTrainingRuntimeState {
  return IDLE_CHASE_TRAINING_RUNTIME;
}
