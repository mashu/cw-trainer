export type EchoCharacterState =
  | 'idle'
  | 'playing'
  | 'awaiting'
  | 'receiving'
  | 'correct'
  | 'error';

export interface EchoCharacterProgress {
  readonly revealedCharacter: string | null;
  readonly status: 'pending' | 'correct' | 'error';
}

export interface EchoSessionResultSummary {
  readonly accuracy: number;
  readonly groups: ReadonlyArray<{ sent: string; received: string; correct: boolean }>;
  readonly avgResponseMs: number;
  readonly score: number;
  readonly sendingScore: number;
  readonly correctCharacters: number;
  readonly incorrectCharacters: number;
}

export interface EchoTrainingActiveSnapshot {
  readonly status: 'starting' | 'running' | 'completing' | 'failed' | 'paused';
  readonly sessionId: number;
  readonly startedAt: number;
  readonly currentGroup: number;
  readonly sentGroups: readonly string[];
  readonly currentCharacterIndex: number;
  readonly currentCharacterState: EchoCharacterState;
  readonly currentSymbols: string;
  readonly revealedCharacter: string | null;
  readonly currentGroupProgress: readonly EchoCharacterProgress[];
  readonly correctCharacters: number;
  readonly incorrectCharacters: number;
  readonly pauseReason?: string;
  readonly errorMessage?: string;
}

export interface EchoTrainingResultsSnapshot {
  readonly status: 'results';
  readonly result: EchoSessionResultSummary;
}

export type EchoTrainingRuntimeState =
  | { readonly status: 'idle' }
  | EchoTrainingActiveSnapshot
  | EchoTrainingResultsSnapshot;

export interface BeginEchoTrainingSessionInput {
  readonly sessionId: number;
  readonly startedAt: number;
}

export const IDLE_ECHO_TRAINING_RUNTIME: EchoTrainingRuntimeState = {
  status: 'idle',
} as const;

const isActiveSnapshot = (
  state: EchoTrainingRuntimeState,
): state is EchoTrainingActiveSnapshot => state.status !== 'idle' && state.status !== 'results';

export const isEchoTrainingRuntimeActive = (state: EchoTrainingRuntimeState): boolean =>
  isActiveSnapshot(state);

export const isEchoTrainingRuntimeBlockingSync = (
  state: EchoTrainingRuntimeState,
): boolean =>
  state.status === 'starting' ||
  state.status === 'running' ||
  state.status === 'completing' ||
  state.status === 'paused' ||
  state.status === 'failed';

export function beginEchoTrainingSession(
  input: BeginEchoTrainingSessionInput,
): EchoTrainingRuntimeState {
  return {
    status: 'starting',
    sessionId: input.sessionId,
    startedAt: input.startedAt,
    currentGroup: 0,
    sentGroups: [],
    currentCharacterIndex: 0,
    currentCharacterState: 'idle',
    currentSymbols: '',
    revealedCharacter: null,
    currentGroupProgress: [],
    correctCharacters: 0,
    incorrectCharacters: 0,
  };
}

export function setEchoTrainingGroups(
  state: EchoTrainingRuntimeState,
  groups: readonly string[],
): EchoTrainingRuntimeState {
  if (!isActiveSnapshot(state)) return state;
  return { ...state, sentGroups: [...groups] };
}

export function transitionEchoTrainingStatus(
  state: EchoTrainingRuntimeState,
  status: EchoTrainingActiveSnapshot['status'],
  options?: {
    readonly pauseReason?: string;
    readonly errorMessage?: string;
  },
): EchoTrainingRuntimeState {
  if (!isActiveSnapshot(state)) return state;
  return {
    ...state,
    status,
    ...(options?.pauseReason !== undefined ? { pauseReason: options.pauseReason } : {}),
    ...(options?.errorMessage !== undefined ? { errorMessage: options.errorMessage } : {}),
  };
}

export function setEchoTrainingCurrentGroup(
  state: EchoTrainingRuntimeState,
  groupIndex: number,
  groupProgress: readonly EchoCharacterProgress[],
): EchoTrainingRuntimeState {
  if (!isActiveSnapshot(state)) return state;
  return {
    ...state,
    currentGroup: groupIndex,
    currentGroupProgress: [...groupProgress],
    currentCharacterIndex: 0,
    currentCharacterState: 'idle',
    currentSymbols: '',
    revealedCharacter: null,
  };
}

export function updateEchoTrainingCharacter(
  state: EchoTrainingRuntimeState,
  patch: {
    readonly index?: number;
    readonly characterState?: EchoCharacterState;
    readonly symbols?: string;
    readonly revealedCharacter?: string | null;
    readonly groupProgress?: readonly EchoCharacterProgress[];
  },
): EchoTrainingRuntimeState {
  if (!isActiveSnapshot(state)) return state;
  return {
    ...state,
    ...(patch.index !== undefined ? { currentCharacterIndex: patch.index } : {}),
    ...(patch.characterState !== undefined
      ? { currentCharacterState: patch.characterState }
      : {}),
    ...(patch.symbols !== undefined ? { currentSymbols: patch.symbols } : {}),
    ...(patch.revealedCharacter !== undefined
      ? { revealedCharacter: patch.revealedCharacter }
      : {}),
    ...(patch.groupProgress !== undefined
      ? { currentGroupProgress: [...patch.groupProgress] }
      : {}),
  };
}

export function setEchoTrainingScores(
  state: EchoTrainingRuntimeState,
  correctCharacters: number,
  incorrectCharacters: number,
): EchoTrainingRuntimeState {
  if (!isActiveSnapshot(state)) return state;
  return { ...state, correctCharacters, incorrectCharacters };
}

export function completeEchoTrainingSession(
  result: EchoSessionResultSummary,
): EchoTrainingRuntimeState {
  return { status: 'results', result };
}

export function cancelEchoTrainingSession(): EchoTrainingRuntimeState {
  return IDLE_ECHO_TRAINING_RUNTIME;
}

export function dismissEchoTrainingResults(): EchoTrainingRuntimeState {
  return IDLE_ECHO_TRAINING_RUNTIME;
}
