import type { ChaseResolveOutcome } from '@/lib/chase';

export interface ChaseTargetSnapshot {
  readonly id: number;
  readonly group: string;
  readonly lanePercent: number;
  readonly level: number;
  readonly spawnedAt: number;
  readonly deadlineAt: number;
  readonly fallMs: number;
}

export interface ChaseResolvedTargetSnapshot {
  readonly sent: string;
  readonly received: string;
  readonly outcome: ChaseResolveOutcome;
  readonly scoreDelta: number;
}

export interface ChaseSessionResultSummary {
  readonly accuracy: number;
  readonly groups: ReadonlyArray<{
    readonly sent: string;
    readonly received: string;
    readonly correct: boolean;
  }>;
  readonly avgResponseMs: number;
  readonly score: number;
  readonly maxLevel: number;
  readonly survivedMs: number;
  readonly bestStreak: number;
  readonly livesLost: number;
}

export interface ChaseTrainingActiveSnapshot {
  readonly status: 'starting' | 'running' | 'completing' | 'failed' | 'paused';
  readonly sessionId: number;
  readonly startedAt: number;
  readonly target: ChaseTargetSnapshot | null;
  readonly lastResolvedTarget: ChaseResolvedTargetSnapshot | null;
  readonly userInput: string;
  readonly lives: number;
  readonly level: number;
  readonly score: number;
  readonly streak: number;
  readonly bestStreak: number;
  readonly correctInLevel: number;
  readonly groupsCompleted: number;
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

export interface BeginChaseTrainingSessionInput {
  readonly sessionId: number;
  readonly startedAt: number;
  readonly lives: number;
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
    target: null,
    lastResolvedTarget: null,
    userInput: '',
    lives: input.lives,
    level: 1,
    score: 0,
    streak: 0,
    bestStreak: 0,
    correctInLevel: 0,
    groupsCompleted: 0,
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
  patch: Partial<
    Pick<
      ChaseTrainingActiveSnapshot,
      | 'target'
      | 'lastResolvedTarget'
      | 'userInput'
      | 'lives'
      | 'level'
      | 'score'
      | 'streak'
      | 'bestStreak'
      | 'correctInLevel'
      | 'groupsCompleted'
    >
  >,
): ChaseTrainingRuntimeState {
  if (!isActiveSnapshot(state)) return state;
  return {
    ...state,
    ...(patch.target !== undefined ? { target: patch.target } : {}),
    ...(patch.lastResolvedTarget !== undefined
      ? { lastResolvedTarget: patch.lastResolvedTarget }
      : {}),
    ...(patch.userInput !== undefined ? { userInput: patch.userInput } : {}),
    ...(patch.lives !== undefined ? { lives: patch.lives } : {}),
    ...(patch.level !== undefined ? { level: patch.level } : {}),
    ...(patch.score !== undefined ? { score: patch.score } : {}),
    ...(patch.streak !== undefined ? { streak: patch.streak } : {}),
    ...(patch.bestStreak !== undefined ? { bestStreak: patch.bestStreak } : {}),
    ...(patch.correctInLevel !== undefined ? { correctInLevel: patch.correctInLevel } : {}),
    ...(patch.groupsCompleted !== undefined ? { groupsCompleted: patch.groupsCompleted } : {}),
  };
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
