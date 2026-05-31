import { groupTrainingRuntimeSchema } from '@/lib/validators';
import type { SessionTiming } from '@/types';

export type GroupTrainingRuntimeStatus =
  | 'idle'
  | 'starting'
  | 'playingGroup'
  | 'waitingForAnswer'
  | 'paused'
  | 'completing'
  | 'results'
  | 'failed';

export type GroupTrainingAudioStatus =
  | 'idle'
  | 'running'
  | 'suspended'
  | 'closed'
  | 'failed';

export interface GroupSessionResultSummary {
  readonly accuracy: number;
  readonly groups: ReadonlyArray<{
    readonly sent: string;
    readonly received: string;
    readonly correct: boolean;
  }>;
  readonly avgResponseMs: number;
  readonly score: number;
}

export interface GroupTrainingActiveSnapshot {
  readonly status:
    | 'starting'
    | 'playingGroup'
    | 'waitingForAnswer'
    | 'paused'
    | 'completing'
    | 'failed';
  readonly sessionId: number;
  readonly startedAt: number;
  readonly groups: readonly string[];
  readonly userInput: readonly string[];
  readonly confirmedGroups: Readonly<Record<number, boolean>>;
  readonly currentGroup: number;
  readonly currentFocusedGroup: number;
  readonly groupStartAt: readonly number[];
  readonly groupEndAt: readonly number[];
  readonly groupAnswerAt: readonly number[];
  readonly audioStatus: GroupTrainingAudioStatus;
  readonly pauseReason?: string;
  readonly errorMessage?: string;
}

export interface GroupTrainingResultsSnapshot {
  readonly status: 'results';
  readonly result: GroupSessionResultSummary;
}

export type GroupTrainingRuntimeState =
  | { readonly status: 'idle' }
  | GroupTrainingActiveSnapshot
  | GroupTrainingResultsSnapshot;

export interface BeginGroupTrainingSessionInput {
  readonly sessionId: number;
  readonly startedAt: number;
}

export const IDLE_GROUP_TRAINING_RUNTIME: GroupTrainingRuntimeState = {
  status: 'idle',
} as const;

const isActiveSnapshot = (
  state: GroupTrainingRuntimeState,
): state is GroupTrainingActiveSnapshot =>
  state.status !== 'idle' && state.status !== 'results';

export const isGroupTrainingRuntimeActive = (
  state: GroupTrainingRuntimeState,
): boolean => isActiveSnapshot(state);

export const isGroupTrainingRuntimeBlockingSync = (
  state: GroupTrainingRuntimeState,
): boolean =>
  state.status === 'starting' ||
  state.status === 'playingGroup' ||
  state.status === 'waitingForAnswer' ||
  state.status === 'paused' ||
  state.status === 'completing' ||
  state.status === 'failed';

/**
 * True when the session was paused with no live audio loop (reload restore, unmount
 * recovery). Playback refs are absent — inputs and Submit must be disabled; Stop only.
 * Tab-visibility pauses during a live run keep audio non-closed and remain interactive.
 */
export function isGroupTrainingPlaybackFrozen(
  state: GroupTrainingRuntimeState,
): boolean {
  if (state.status !== 'paused') return false;
  return state.audioStatus === 'closed';
}

export function beginGroupTrainingSession(
  input: BeginGroupTrainingSessionInput,
): GroupTrainingRuntimeState {
  return {
    status: 'starting',
    sessionId: input.sessionId,
    startedAt: input.startedAt,
    groups: [],
    userInput: [],
    confirmedGroups: {},
    currentGroup: 0,
    currentFocusedGroup: 0,
    groupStartAt: [],
    groupEndAt: [],
    groupAnswerAt: [],
    audioStatus: 'idle',
  };
}

export function setGroupTrainingGroups(
  state: GroupTrainingRuntimeState,
  groups: readonly string[],
): GroupTrainingRuntimeState {
  if (!isActiveSnapshot(state)) return state;
  return {
    ...state,
    groups: [...groups],
    userInput: Array.from({ length: groups.length }, () => ''),
    confirmedGroups: {},
  };
}

export function transitionGroupTrainingStatus(
  state: GroupTrainingRuntimeState,
  status: GroupTrainingActiveSnapshot['status'],
  options?: {
    readonly pauseReason?: string;
    readonly errorMessage?: string;
  },
): GroupTrainingRuntimeState {
  if (!isActiveSnapshot(state)) return state;
  return {
    ...state,
    status,
    ...(options?.pauseReason !== undefined ? { pauseReason: options.pauseReason } : {}),
    ...(options?.errorMessage !== undefined ? { errorMessage: options.errorMessage } : {}),
  };
}

export function setGroupTrainingAudioStatus(
  state: GroupTrainingRuntimeState,
  audioStatus: GroupTrainingAudioStatus,
): GroupTrainingRuntimeState {
  if (!isActiveSnapshot(state)) return state;
  return { ...state, audioStatus };
}

export function setCurrentGroupTrainingIndex(
  state: GroupTrainingRuntimeState,
  index: number,
): GroupTrainingRuntimeState {
  if (!isActiveSnapshot(state)) return state;
  const boundedIndex = Math.max(0, Math.min(Math.max(0, state.groups.length - 1), index));
  return {
    ...state,
    currentGroup: boundedIndex,
    currentFocusedGroup: boundedIndex,
  };
}

export function setCurrentGroupTrainingFocus(
  state: GroupTrainingRuntimeState,
  index: number,
): GroupTrainingRuntimeState {
  if (!isActiveSnapshot(state)) return state;
  const boundedIndex = Math.max(0, Math.min(Math.max(0, state.groups.length - 1), index));
  return { ...state, currentFocusedGroup: boundedIndex };
}

export function updateGroupTrainingInput(
  state: GroupTrainingRuntimeState,
  index: number,
  value: string,
): GroupTrainingRuntimeState {
  if (!isActiveSnapshot(state)) return state;
  const nextInput = [...state.userInput];
  nextInput[index] = value;
  return { ...state, userInput: nextInput };
}

export function confirmGroupTrainingAnswer(
  state: GroupTrainingRuntimeState,
  index: number,
  value: string,
  answeredAt: number,
): GroupTrainingRuntimeState {
  if (!isActiveSnapshot(state)) return state;
  const nextInput = [...state.userInput];
  nextInput[index] = value;
  const nextConfirmed = { ...state.confirmedGroups, [index]: true };
  const nextAnsweredAt = [...state.groupAnswerAt];
  if (!nextAnsweredAt[index]) {
    nextAnsweredAt[index] = answeredAt;
  }
  const nextIndex = Math.min(index + 1, Math.max(0, state.groups.length - 1));
  return {
    ...state,
    userInput: nextInput,
    confirmedGroups: nextConfirmed,
    groupAnswerAt: nextAnsweredAt,
    currentFocusedGroup: nextIndex,
  };
}

export function recordGroupTrainingStart(
  state: GroupTrainingRuntimeState,
  index: number,
  startedAt: number,
): GroupTrainingRuntimeState {
  if (!isActiveSnapshot(state)) return state;
  const nextStartAt = [...state.groupStartAt];
  nextStartAt[index] = startedAt;
  return { ...state, groupStartAt: nextStartAt };
}

export function recordGroupTrainingEnd(
  state: GroupTrainingRuntimeState,
  index: number,
  endedAt: number,
): GroupTrainingRuntimeState {
  if (!isActiveSnapshot(state)) return state;
  const nextEndAt = [...state.groupEndAt];
  nextEndAt[index] = endedAt;
  return { ...state, groupEndAt: nextEndAt };
}

export function recordGroupTrainingAnswerTime(
  state: GroupTrainingRuntimeState,
  index: number,
  answeredAt: number,
): GroupTrainingRuntimeState {
  if (!isActiveSnapshot(state)) return state;
  const nextAnswerAt = [...state.groupAnswerAt];
  if (!nextAnswerAt[index]) {
    nextAnswerAt[index] = answeredAt;
  }
  return { ...state, groupAnswerAt: nextAnswerAt };
}

export function completeGroupTrainingSession(
  result: GroupSessionResultSummary,
): GroupTrainingRuntimeState {
  return { status: 'results', result };
}

export function cancelGroupTrainingSession(): GroupTrainingRuntimeState {
  return IDLE_GROUP_TRAINING_RUNTIME;
}

export function dismissGroupTrainingResults(): GroupTrainingRuntimeState {
  return IDLE_GROUP_TRAINING_RUNTIME;
}

/** Reason shown when a session is restored after a hard reload. */
export const REHYDRATED_SESSION_PAUSE_REASON = 'Session was interrupted by a reload.';

/**
 * Maps a persisted (untrusted) runtime snapshot back into a safe in-memory state after a
 * hard reload. Audio, timers, and the playback loop cannot survive a reload, so any
 * in-progress (active) status is coerced to `paused` — the user keeps their typed answers
 * and timings and can Stop and start a fresh run. `results` is preserved so an accidental
 * reload on the results screen still shows the last result. Anything invalid resolves to idle.
 */
export function rehydrateGroupTrainingRuntime(persisted: unknown): GroupTrainingRuntimeState {
  const parsed = groupTrainingRuntimeSchema.safeParse(persisted);
  if (!parsed.success) return IDLE_GROUP_TRAINING_RUNTIME;
  const data = parsed.data;

  if (data.status === 'idle') return IDLE_GROUP_TRAINING_RUNTIME;
  if (data.status === 'results') return { status: 'results', result: data.result };

  const pauseReason =
    data.status === 'failed' && data.errorMessage
      ? `${REHYDRATED_SESSION_PAUSE_REASON} (${data.errorMessage})`
      : REHYDRATED_SESSION_PAUSE_REASON;

  return {
    status: 'paused',
    sessionId: data.sessionId,
    startedAt: data.startedAt,
    groups: [...data.groups],
    userInput: [...data.userInput],
    confirmedGroups: { ...data.confirmedGroups },
    currentGroup: data.currentGroup,
    currentFocusedGroup: data.currentFocusedGroup,
    groupStartAt: [...data.groupStartAt],
    groupEndAt: [...data.groupEndAt],
    groupAnswerAt: [...data.groupAnswerAt],
    audioStatus: 'closed',
    pauseReason,
  };
}

export function buildGroupTrainingTimings(
  state: GroupTrainingRuntimeState,
  fallbackTimeoutMs: number,
): readonly SessionTiming[] {
  if (!isActiveSnapshot(state)) return [];
  return state.groups.map((sent, index) => {
    const endAt = state.groupEndAt[index] || 0;
    const rawAnswerAt = state.groupAnswerAt[index] || 0;
    const fallbackAnswerAt = endAt > 0 && fallbackTimeoutMs > 0 ? endAt + fallbackTimeoutMs : 0;
    const answerAt = rawAnswerAt > 0 ? rawAnswerAt : fallbackAnswerAt;
    const delta = Math.max(0, answerAt - endAt);
    const perCharMs = sent.length > 0 ? Math.round(delta / sent.length) : 0;
    return {
      timeToCompleteMs: Number.isFinite(delta) ? delta : 0,
      perCharMs,
    };
  });
}
