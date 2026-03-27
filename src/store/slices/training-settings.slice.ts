import { DEFAULT_TRAINING_SETTINGS } from '@/config/training.config';
import { FirebaseNotReadyError } from '@/lib/db/repositories/training-settings.repository';
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
  get: () => { trainingSettings: TrainingSettings; trainingSettingsStatus: AsyncStatus };
  service: TrainingSettingsService;
}

const mapErrorMessage = (error: unknown): string => {
  const appError = ensureAppError(error);
  return appError.expose ? appError.message : 'Unable to process training settings request.';
};

export const createTrainingSettingsSlice = ({
  set,
  getContext,
  get,
  service,
}: CreateTrainingSettingsSliceParams): TrainingSettingsSlice => ({
  trainingSettings: DEFAULT_TRAINING_SETTINGS,
  trainingSettingsStatus: 'idle',
  trainingSettingsSaving: false,

  loadTrainingSettings: async (): Promise<TrainingSettings> => {
    const { trainingSettingsStatus } = get();
    // When already ready, treat as background load (no loading state, keep current on failure)
    const isBackground = trainingSettingsStatus === 'ready';
    // Optional: a shared runAsyncWithStatus helper could centralize this pattern for slices

    if (!isBackground) {
      set({ trainingSettingsStatus: 'loading' });
    }

    try {
      const context = getContext();
      if (!isBackground) {
        console.debug('[settings-slice] loadTrainingSettings called');
        console.debug('[settings-slice] Context at load time:', {
          user: context.user ? { id: context.user.id, email: context.user.email } : null,
          firebase: context.firebase ? { hasDb: !!context.firebase.db, hasAuth: !!context.firebase.auth } : null,
        });
      }
      const contextWithGetter = {
        ...context,
        getContext: (): StoreContextValue => getContext(),
      };
      const settings = await service.getSettings(contextWithGetter);
      if (!isBackground) {
        console.debug('[settings-slice] Settings loaded:', { kochLevel: settings.kochLevel });
      }
      set({
        trainingSettings: settings,
        trainingSettingsStatus: 'ready',
      });
      return settings;
    } catch (error) {
      if (error instanceof FirebaseNotReadyError) {
        if (!isBackground) {
          console.debug('[settings-slice] Firebase not ready yet, keeping loading state');
        }
        return get().trainingSettings;
      }

      if (isBackground) {
        // Don't disrupt UI: keep current settings, use local data; sync when Firebase is back
        console.debug('[settings-slice] Background load failed, keeping current settings', error);
        return get().trainingSettings;
      }

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
