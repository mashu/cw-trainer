export type TrainingStatus = 'idle' | 'preparing' | 'playing' | 'waiting_input' | 'completed' | 'stopped' | 'aborted';

export interface TrainingMachineState {
  status: TrainingStatus;
  currentGroupIndex: number;
  sessionId: number;
}

export type TrainingAction =
  | { type: 'START' }
  | { type: 'PREPARED' }
  | { type: 'GROUP_START'; index: number }
  | { type: 'WAIT_INPUT' }
  | { type: 'INPUT_RECEIVED' }
  | { type: 'COMPLETE' }
  | { type: 'STOP' }
  | { type: 'ABORT' };

export function trainingReducer(state: TrainingMachineState, action: TrainingAction): TrainingMachineState {
  switch (action.type) {
    case 'START':
      return { status: 'preparing', currentGroupIndex: 0, sessionId: state.sessionId + 1 };
    case 'PREPARED':
      return { ...state, status: 'playing' };
    case 'GROUP_START':
      return { ...state, status: 'playing', currentGroupIndex: action.index };
    case 'WAIT_INPUT':
      return { ...state, status: 'waiting_input' };
    case 'INPUT_RECEIVED':
      return { ...state, status: 'playing' };
    case 'COMPLETE':
      return { ...state, status: 'completed' };
    case 'STOP':
      return { ...state, status: 'stopped' };
    case 'ABORT':
      return { ...state, status: 'aborted' };
    default:
      return state;
  }
}


