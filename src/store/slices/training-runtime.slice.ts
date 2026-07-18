import {
  beginChaseTrainingSession,
  cancelChaseTrainingSession,
  completeChaseTrainingSession,
  dismissChaseTrainingResults,
  IDLE_CHASE_TRAINING_RUNTIME,
  patchChaseTrainingRuntime,
  transitionChaseTrainingStatus,
} from '@/lib/training/chaseSessionMachine';
import type {
  BeginChaseTrainingSessionInput,
  ChaseSessionResultSummary,
  ChaseTrainingActiveSnapshot,
  ChaseTrainingRuntimePatch,
  ChaseTrainingRuntimeState,
} from '@/lib/training/chaseSessionMachine';
import {
  beginEchoTrainingSession,
  cancelEchoTrainingSession,
  completeEchoTrainingSession,
  dismissEchoTrainingResults,
  IDLE_ECHO_TRAINING_RUNTIME,
  setEchoTrainingCurrentGroup,
  setEchoTrainingGroups,
  setEchoTrainingScores,
  transitionEchoTrainingStatus,
  updateEchoTrainingCharacter,
} from '@/lib/training/echoSessionMachine';
import type {
  BeginEchoTrainingSessionInput,
  EchoCharacterProgress,
  EchoCharacterState,
  EchoSessionResultSummary,
  EchoTrainingActiveSnapshot,
  EchoTrainingRuntimeState,
} from '@/lib/training/echoSessionMachine';
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
import type {
  BeginIcrTrainingSessionInput,
  IcrTrainingRuntimeState,
} from '@/lib/training/icrSessionMachine';
import {
  beginIcrTrainingSession,
  cancelIcrTrainingSession,
  IDLE_ICR_TRAINING_RUNTIME,
  setIcrCountdown,
  setIcrRunning,
} from '@/lib/training/icrSessionMachine';
import type {
  PreviewPlaybackRuntimeState,
  PreviewPlaybackSource,
} from '@/lib/training/previewPlaybackMachine';
import {
  beginPreviewPlayback,
  cancelPreviewPlayback,
  endPreviewPlayback,
  IDLE_PREVIEW_PLAYBACK_RUNTIME,
} from '@/lib/training/previewPlaybackMachine';

import type { StoreSetter } from '../types';

export interface TrainingRuntimeSlice {
  groupTrainingRuntime: GroupTrainingRuntimeState;
  echoTrainingRuntime: EchoTrainingRuntimeState;
  chaseTrainingRuntime: ChaseTrainingRuntimeState;
  icrTrainingRuntime: IcrTrainingRuntimeState;
  previewPlaybackRuntime: PreviewPlaybackRuntimeState;
  restoreGroupTrainingRuntime: (state: GroupTrainingRuntimeState) => void;
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
  beginEchoTrainingSession: (input: BeginEchoTrainingSessionInput) => void;
  setEchoTrainingGroups: (groups: readonly string[]) => void;
  setEchoTrainingStatus: (
    status: EchoTrainingActiveSnapshot['status'],
    options?: {
      readonly pauseReason?: string;
      readonly errorMessage?: string;
    },
  ) => void;
  setEchoTrainingCurrentGroup: (
    groupIndex: number,
    groupProgress: readonly EchoCharacterProgress[],
  ) => void;
  updateEchoTrainingCharacter: (
    patch: {
      readonly index?: number;
      readonly characterState?: EchoCharacterState;
      readonly symbols?: string;
      readonly revealedCharacter?: string | null;
      readonly groupProgress?: readonly EchoCharacterProgress[];
    },
  ) => void;
  setEchoTrainingScores: (correctCharacters: number, incorrectCharacters: number) => void;
  completeEchoTrainingSession: (result: EchoSessionResultSummary) => void;
  cancelEchoTrainingSession: () => void;
  dismissEchoTrainingResults: () => void;
  beginChaseTrainingSession: (input: BeginChaseTrainingSessionInput) => void;
  setChaseTrainingStatus: (
    status: ChaseTrainingActiveSnapshot['status'],
    options?: {
      readonly pauseReason?: string;
      readonly errorMessage?: string;
    },
  ) => void;
  patchChaseTrainingRuntime: (patch: ChaseTrainingRuntimePatch) => void;
  completeChaseTrainingSession: (result: ChaseSessionResultSummary) => void;
  cancelChaseTrainingSession: () => void;
  dismissChaseTrainingResults: () => void;
  beginIcrTrainingSession: (input: BeginIcrTrainingSessionInput) => void;
  setIcrCountdown: (countdown: number) => void;
  setIcrRunning: () => void;
  cancelIcrTrainingSession: () => void;
  beginPreviewPlayback: (source: PreviewPlaybackSource) => void;
  endPreviewPlayback: (source: PreviewPlaybackSource) => void;
  cancelPreviewPlayback: () => void;
  /** Clears preview playback and ICR blocking state (safety net on mode change / unmount). */
  cancelAncillaryTrainingRuntimes: () => void;
}

interface CreateTrainingRuntimeSliceParams {
  readonly set: StoreSetter<TrainingRuntimeSlice>;
}

export const createTrainingRuntimeSlice = ({
  set,
}: CreateTrainingRuntimeSliceParams): TrainingRuntimeSlice => ({
  groupTrainingRuntime: IDLE_GROUP_TRAINING_RUNTIME,
  echoTrainingRuntime: IDLE_ECHO_TRAINING_RUNTIME,
  chaseTrainingRuntime: IDLE_CHASE_TRAINING_RUNTIME,
  icrTrainingRuntime: IDLE_ICR_TRAINING_RUNTIME,
  previewPlaybackRuntime: IDLE_PREVIEW_PLAYBACK_RUNTIME,

  restoreGroupTrainingRuntime: (state): void => {
    set((current) =>
      current.groupTrainingRuntime.status === 'idle' ? { groupTrainingRuntime: state } : {},
    );
  },

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

  beginEchoTrainingSession: (input): void => {
    set({ echoTrainingRuntime: beginEchoTrainingSession(input) });
  },

  setEchoTrainingGroups: (groups): void => {
    set((state) => ({
      echoTrainingRuntime: setEchoTrainingGroups(state.echoTrainingRuntime, groups),
    }));
  },

  setEchoTrainingStatus: (status, options): void => {
    set((state) => ({
      echoTrainingRuntime: transitionEchoTrainingStatus(
        state.echoTrainingRuntime,
        status,
        options,
      ),
    }));
  },

  setEchoTrainingCurrentGroup: (groupIndex, groupProgress): void => {
    set((state) => ({
      echoTrainingRuntime: setEchoTrainingCurrentGroup(
        state.echoTrainingRuntime,
        groupIndex,
        groupProgress,
      ),
    }));
  },

  updateEchoTrainingCharacter: (patch): void => {
    set((state) => ({
      echoTrainingRuntime: updateEchoTrainingCharacter(state.echoTrainingRuntime, patch),
    }));
  },

  setEchoTrainingScores: (correctCharacters, incorrectCharacters): void => {
    set((state) => ({
      echoTrainingRuntime: setEchoTrainingScores(
        state.echoTrainingRuntime,
        correctCharacters,
        incorrectCharacters,
      ),
    }));
  },

  completeEchoTrainingSession: (result): void => {
    set({ echoTrainingRuntime: completeEchoTrainingSession(result) });
  },

  cancelEchoTrainingSession: (): void => {
    set({ echoTrainingRuntime: cancelEchoTrainingSession() });
  },

  dismissEchoTrainingResults: (): void => {
    set({ echoTrainingRuntime: dismissEchoTrainingResults() });
  },

  beginChaseTrainingSession: (input): void => {
    set({ chaseTrainingRuntime: beginChaseTrainingSession(input) });
  },

  setChaseTrainingStatus: (status, options): void => {
    set((state) => ({
      chaseTrainingRuntime: transitionChaseTrainingStatus(
        state.chaseTrainingRuntime,
        status,
        options,
      ),
    }));
  },

  patchChaseTrainingRuntime: (patch): void => {
    set((state) => ({
      chaseTrainingRuntime: patchChaseTrainingRuntime(state.chaseTrainingRuntime, patch),
    }));
  },

  completeChaseTrainingSession: (result): void => {
    set({ chaseTrainingRuntime: completeChaseTrainingSession(result) });
  },

  cancelChaseTrainingSession: (): void => {
    set({ chaseTrainingRuntime: cancelChaseTrainingSession() });
  },

  dismissChaseTrainingResults: (): void => {
    set({ chaseTrainingRuntime: dismissChaseTrainingResults() });
  },

  beginIcrTrainingSession: (input): void => {
    set({ icrTrainingRuntime: beginIcrTrainingSession(input) });
  },

  setIcrCountdown: (countdown): void => {
    set((state) => ({
      icrTrainingRuntime: setIcrCountdown(state.icrTrainingRuntime, countdown),
    }));
  },

  setIcrRunning: (): void => {
    set((state) => ({
      icrTrainingRuntime: setIcrRunning(state.icrTrainingRuntime),
    }));
  },

  cancelIcrTrainingSession: (): void => {
    set({ icrTrainingRuntime: cancelIcrTrainingSession() });
  },

  beginPreviewPlayback: (source): void => {
    set((state) => ({
      previewPlaybackRuntime: beginPreviewPlayback(state.previewPlaybackRuntime, source),
    }));
  },

  endPreviewPlayback: (source): void => {
    set((state) => ({
      previewPlaybackRuntime: endPreviewPlayback(state.previewPlaybackRuntime, source),
    }));
  },

  cancelPreviewPlayback: (): void => {
    set({ previewPlaybackRuntime: cancelPreviewPlayback() });
  },

  cancelAncillaryTrainingRuntimes: (): void => {
    set({
      previewPlaybackRuntime: cancelPreviewPlayback(),
      icrTrainingRuntime: cancelIcrTrainingSession(),
    });
  },
});
