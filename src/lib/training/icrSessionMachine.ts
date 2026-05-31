export type IcrTrainingRuntimeState =
  | { readonly status: 'idle' }
  | { readonly status: 'countdown'; readonly sessionId: number; readonly countdown: number }
  | { readonly status: 'running'; readonly sessionId: number };

export interface BeginIcrTrainingSessionInput {
  readonly sessionId: number;
}

export const IDLE_ICR_TRAINING_RUNTIME: IcrTrainingRuntimeState = {
  status: 'idle',
} as const;

export const isIcrTrainingRuntimeBlockingSync = (state: IcrTrainingRuntimeState): boolean =>
  state.status === 'countdown' || state.status === 'running';

export function beginIcrTrainingSession(
  input: BeginIcrTrainingSessionInput,
): IcrTrainingRuntimeState {
  return { status: 'countdown', sessionId: input.sessionId, countdown: 3 };
}

export function setIcrCountdown(
  state: IcrTrainingRuntimeState,
  countdown: number,
): IcrTrainingRuntimeState {
  if (state.status !== 'countdown') {
    return state;
  }
  return { ...state, countdown };
}

export function setIcrRunning(state: IcrTrainingRuntimeState): IcrTrainingRuntimeState {
  if (state.status !== 'countdown' && state.status !== 'running') {
    return state;
  }
  return { status: 'running', sessionId: state.sessionId };
}

export function cancelIcrTrainingSession(): IcrTrainingRuntimeState {
  return IDLE_ICR_TRAINING_RUNTIME;
}
