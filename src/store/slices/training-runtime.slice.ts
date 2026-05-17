import {
  beginGroupTrainingSession,
  cancelGroupTrainingSession,
  completeGroupTrainingSession,
  confirmGroupTrainingAnswer,
  dismissGroupTrainingResults,
  IDLE_GROUP_TRAINING_RUNTIME,
  recordGroupTrainingAnswerTime,
  recordGroupTrainingEnd,
  recordGroupTrainingStart,
  setCurrentGroupTrainingFocus,
  setCurrentGroupTrainingIndex,
  setGroupTrainingAudioStatus,
  setGroupTrainingGroups,
  transitionGroupTrainingStatus,
  updateGroupTrainingInput,
} from '@/lib/training/groupSessionMachine';
import type {
  BeginGroupTrainingSessionInput,
  GroupSessionResultSummary,
  GroupTrainingActiveSnapshot,
  GroupTrainingAudioStatus,
  GroupTrainingRuntimeState,
} from '@/lib/training/groupSessionMachine';

import type { StoreSetter } from '../types';

export interface TrainingRuntimeSlice {
  groupTrainingRuntime: GroupTrainingRuntimeState;
  beginGroupTrainingSession: (input: BeginGroupTrainingSessionInput) => void;
  setGroupTrainingGroups: (groups: readonly string[]) => void;
  setGroupTrainingStatus: (
    status: GroupTrainingActiveSnapshot['status'],
    options?: {
      readonly pauseReason?: string;
      readonly errorMessage?: string;
    },
  ) => void;
  setGroupTrainingAudioStatus: (status: GroupTrainingAudioStatus) => void;
  setGroupTrainingCurrentGroup: (index: number) => void;
  setGroupTrainingFocusedGroup: (index: number) => void;
  updateGroupTrainingInput: (index: number, value: string) => void;
  confirmGroupTrainingAnswer: (index: number, value: string, answeredAt: number) => void;
  recordGroupTrainingStart: (index: number, startedAt: number) => void;
  recordGroupTrainingEnd: (index: number, endedAt: number) => void;
  recordGroupTrainingAnswerTime: (index: number, answeredAt: number) => void;
  completeGroupTrainingSession: (result: GroupSessionResultSummary) => void;
  cancelGroupTrainingSession: () => void;
  dismissGroupTrainingResults: () => void;
}

interface CreateTrainingRuntimeSliceParams {
  readonly set: StoreSetter<TrainingRuntimeSlice>;
}

export const createTrainingRuntimeSlice = ({
  set,
}: CreateTrainingRuntimeSliceParams): TrainingRuntimeSlice => ({
  groupTrainingRuntime: IDLE_GROUP_TRAINING_RUNTIME,

  beginGroupTrainingSession: (input): void => {
    set({ groupTrainingRuntime: beginGroupTrainingSession(input) });
  },

  setGroupTrainingGroups: (groups): void => {
    set((state) => ({
      groupTrainingRuntime: setGroupTrainingGroups(state.groupTrainingRuntime, groups),
    }));
  },

  setGroupTrainingStatus: (status, options): void => {
    set((state) => ({
      groupTrainingRuntime: transitionGroupTrainingStatus(
        state.groupTrainingRuntime,
        status,
        options,
      ),
    }));
  },

  setGroupTrainingAudioStatus: (status): void => {
    set((state) => ({
      groupTrainingRuntime: setGroupTrainingAudioStatus(state.groupTrainingRuntime, status),
    }));
  },

  setGroupTrainingCurrentGroup: (index): void => {
    set((state) => ({
      groupTrainingRuntime: setCurrentGroupTrainingIndex(state.groupTrainingRuntime, index),
    }));
  },

  setGroupTrainingFocusedGroup: (index): void => {
    set((state) => ({
      groupTrainingRuntime: setCurrentGroupTrainingFocus(state.groupTrainingRuntime, index),
    }));
  },

  updateGroupTrainingInput: (index, value): void => {
    set((state) => ({
      groupTrainingRuntime: updateGroupTrainingInput(state.groupTrainingRuntime, index, value),
    }));
  },

  confirmGroupTrainingAnswer: (index, value, answeredAt): void => {
    set((state) => ({
      groupTrainingRuntime: confirmGroupTrainingAnswer(
        state.groupTrainingRuntime,
        index,
        value,
        answeredAt,
      ),
    }));
  },

  recordGroupTrainingStart: (index, startedAt): void => {
    set((state) => ({
      groupTrainingRuntime: recordGroupTrainingStart(
        state.groupTrainingRuntime,
        index,
        startedAt,
      ),
    }));
  },

  recordGroupTrainingEnd: (index, endedAt): void => {
    set((state) => ({
      groupTrainingRuntime: recordGroupTrainingEnd(state.groupTrainingRuntime, index, endedAt),
    }));
  },

  recordGroupTrainingAnswerTime: (index, answeredAt): void => {
    set((state) => ({
      groupTrainingRuntime: recordGroupTrainingAnswerTime(
        state.groupTrainingRuntime,
        index,
        answeredAt,
      ),
    }));
  },

  completeGroupTrainingSession: (result): void => {
    set({ groupTrainingRuntime: completeGroupTrainingSession(result) });
  },

  cancelGroupTrainingSession: (): void => {
    set({ groupTrainingRuntime: cancelGroupTrainingSession() });
  },

  dismissGroupTrainingResults: (): void => {
    set({ groupTrainingRuntime: dismissGroupTrainingResults() });
  },
});
