'use client';

import { useCallback } from 'react';

import type { TrainingSettingsInput } from '@/lib/validators';
import { useAppStore } from '@/store';
import type { AsyncStatus } from '@/store';
import type { TrainingSettings } from '@/types';

export interface UseTrainingSettingsStateResult {
  trainingSettings: TrainingSettings;
  trainingSettingsStatus: AsyncStatus;
  trainingSettingsError?: string;
  trainingSettingsSaving: boolean;
}

export const useTrainingSettingsState = (): UseTrainingSettingsStateResult =>
  useAppStore((state) => ({
    trainingSettings: state.trainingSettings,
    trainingSettingsStatus: state.trainingSettingsStatus,
    trainingSettingsError: state.trainingSettingsError,
    trainingSettingsSaving: state.trainingSettingsSaving,
  }));

export const useTrainingSettingsActions = (): {
  loadTrainingSettings: () => Promise<TrainingSettings>;
  saveTrainingSettings: (input: TrainingSettingsInput) => Promise<TrainingSettings>;
  patchTrainingSettings: (patch: Partial<TrainingSettings>) => Promise<TrainingSettings>;
  resetTrainingSettings: () => Promise<TrainingSettings>;
  setTrainingSettingsState: (
    next: TrainingSettings | ((prev: TrainingSettings) => TrainingSettings),
  ) => void;
} => {
  const load = useAppStore((state) => state.loadTrainingSettings);
  const save = useAppStore((state) => state.saveTrainingSettings);
  const patch = useAppStore((state) => state.patchTrainingSettings);
  const reset = useAppStore((state) => state.resetTrainingSettings);
  const setState = useAppStore((state) => state.setTrainingSettingsState);

  return {
    loadTrainingSettings: useCallback(() => load(), [load]),
    saveTrainingSettings: useCallback((input: TrainingSettingsInput) => save(input), [save]),
    patchTrainingSettings: useCallback(
      (patchInput: Partial<TrainingSettings>) => patch(patchInput),
      [patch],
    ),
    resetTrainingSettings: useCallback(() => reset(), [reset]),
    setTrainingSettingsState: useCallback(
      (next: TrainingSettings | ((prev: TrainingSettings) => TrainingSettings)) => setState(next),
      [setState],
    ),
  };
};
