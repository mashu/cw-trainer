import { DEFAULT_TRAINING_SETTINGS } from '@/config/training.config';
import { ensureAppError } from '@/lib/errors';
import type { TrainingSettingsService } from '@/lib/services/training-settings.service';
import type { TrainingSettingsInput } from '@/lib/validators';
import type { TrainingSettings } from '@/types';

import type { AsyncStatus, StoreContextValue, StoreSetter } from '../types';

export interface TrainingSettingsSlice {
  trainingSettings: TrainingSettings;
  trainingSettingsStatus: AsyncStatus;
  trainingSettingsError?: string;
  trainingSettingsSaving: boolean;
  loadTrainingSettings: () => Promise<TrainingSettings>;
  saveTrainingSettings: (input: TrainingSettingsInput) => Promise<TrainingSettings>;
  patchTrainingSettings: (patch: Partial<TrainingSettings>) => Promise<TrainingSettings>;
  resetTrainingSettings: () => Promise<TrainingSettings>;
  setTrainingSettingsState: (
    next: TrainingSettings | ((prev: TrainingSettings) => TrainingSettings),
  ) => void;
}

interface CreateTrainingSettingsSliceParams {
  set: StoreSetter<TrainingSettingsSlice>;
  getContext: () => StoreContextValue;
  service: TrainingSettingsService;
}

const mapErrorMessage = (error: unknown): string => {
  const appError = ensureAppError(error);
  return appError.expose ? appError.message : 'Unable to process training settings request.';
};

export const createTrainingSettingsSlice = ({
  set,
  getContext,
  service,
}: CreateTrainingSettingsSliceParams): TrainingSettingsSlice => ({
  trainingSettings: DEFAULT_TRAINING_SETTINGS,
  trainingSettingsStatus: 'idle',
  trainingSettingsSaving: false,

  loadTrainingSettings: async (): Promise<TrainingSettings> => {
    set({ trainingSettingsStatus: 'loading' });

    try {
      const context = getContext();
      const settings = await service.getSettings(context);
      set({
        trainingSettings: settings,
        trainingSettingsStatus: 'ready',
      });
      return settings;
    } catch (error) {
      const appError = ensureAppError(error);
      set({
        trainingSettingsStatus: 'error',
        trainingSettingsError: mapErrorMessage(appError),
      });
      throw appError;
    }
  },

  saveTrainingSettings: async (input: TrainingSettingsInput): Promise<TrainingSettings> => {
    set({ trainingSettingsSaving: true });

    try {
      const context = getContext();
      const settings = await service.saveSettings(context, input);
      set({
        trainingSettings: settings,
        trainingSettingsSaving: false,
        trainingSettingsStatus: 'ready',
      });
      return settings;
    } catch (error) {
      const appError = ensureAppError(error);
      set({
        trainingSettingsSaving: false,
        trainingSettingsError: mapErrorMessage(appError),
      });
      throw appError;
    }
  },

  patchTrainingSettings: async (patch: Partial<TrainingSettings>): Promise<TrainingSettings> => {
    set({ trainingSettingsSaving: true });

    try {
      const context = getContext();
      const settings = await service.patchSettings(context, patch);
      set({
        trainingSettings: settings,
        trainingSettingsSaving: false,
        trainingSettingsStatus: 'ready',
      });
      return settings;
    } catch (error) {
      const appError = ensureAppError(error);
      set({
        trainingSettingsSaving: false,
        trainingSettingsError: mapErrorMessage(appError),
      });
      throw appError;
    }
  },

  resetTrainingSettings: async (): Promise<TrainingSettings> => {
    set({ trainingSettingsSaving: true });

    try {
      const context = getContext();
      const settings = await service.resetSettings(context);
      set({
        trainingSettings: settings,
        trainingSettingsSaving: false,
        trainingSettingsStatus: 'ready',
      });
      return settings;
    } catch (error) {
      const appError = ensureAppError(error);
      set({
        trainingSettingsSaving: false,
        trainingSettingsError: mapErrorMessage(appError),
      });
      throw appError;
    }
  },

  setTrainingSettingsState: (next): void => {
    set((state) => {
      const resolved =
        typeof next === 'function'
          ? (next as (prev: TrainingSettings) => TrainingSettings)(state.trainingSettings)
          : next;
      return {
        trainingSettings: resolved,
        trainingSettingsStatus:
          state.trainingSettingsStatus === 'idle' ? 'ready' : state.trainingSettingsStatus,
      };
    });
  },
});
