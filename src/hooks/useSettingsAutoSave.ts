'use client';

import { useCallback, useEffect, useRef } from 'react';

import { DEFAULT_TRAINING_SETTINGS } from '@/config/training.config';
import { AUTO_SAVE_DELAY_MS } from '@/lib/constants';
import { ensureAppError } from '@/lib/errors';
import {
  normalizeTrainingSettings,
  serializeTrainingSettings,
} from '@/lib/utils/training-settings';
import { trainingSettingsSchema, type TrainingSettingsInput } from '@/lib/validators';
import { useAppStore } from '@/store';
import type { TrainingSettings } from '@/types';

import type { Toast } from './useToast';

type TimeoutId = number;

export interface UseSettingsAutoSaveOptions {
  readonly settings: TrainingSettings;
  readonly trainingSettingsStatus: string;
  readonly saveTrainingSettings: (input: TrainingSettingsInput) => Promise<TrainingSettings>;
  readonly firebaseServices: unknown;
  readonly firebaseUserUid: string | undefined;
  readonly showToast: (t: Toast) => void;
}

export interface UseSettingsAutoSaveReturn {
  /** Trigger a manual or auto save. */
  readonly saveSettings: (opts?: { source?: 'auto' | 'manual' }) => Promise<void>;
  /** Ref holding the latest settings value (always up-to-date, useful in async paths). */
  readonly latestSettingsRef: React.MutableRefObject<TrainingSettings>;
}

/**
 * Encapsulates debounced settings auto-save and initialization tracking.
 */
export function useSettingsAutoSave({
  settings,
  trainingSettingsStatus,
  saveTrainingSettings,
  firebaseServices,
  firebaseUserUid,
  showToast,
}: UseSettingsAutoSaveOptions): UseSettingsAutoSaveReturn {
  const trainingSessionActive = useAppStore((s) => s.trainingSessionActive);
  const latestSettingsRef = useRef<TrainingSettings>(settings);
  const lastSavedRef = useRef<string | null>(null);
  const initializedRef = useRef(false);
  const debounceRef = useRef<TimeoutId | undefined>(undefined);

  // Keep ref current
  useEffect(() => {
    latestSettingsRef.current = settings;
  }, [settings]);

  // Capture baseline serialisation once settings are loaded
  useEffect(() => {
    if (!initializedRef.current && trainingSettingsStatus === 'ready') {
      lastSavedRef.current = serializeForComparison(settings);
      initializedRef.current = true;
    }
  }, [settings, trainingSettingsStatus]);

  const saveSettings = useCallback(
    async (opts?: { source?: 'auto' | 'manual' }): Promise<void> => {
      try {
        if (debounceRef.current) {
          window.clearTimeout(debounceRef.current);
          debounceRef.current = undefined;
        }
      } catch {
        /* no-op */
      }

      try {
        const toSave = prepareForSave(latestSettingsRef.current);
        const saved = await saveTrainingSettings(toSave);
        lastSavedRef.current = serializeForComparison(saved);

        // Don't show save toast during an active session: we already told the user
        // "Changes will apply after the session ends" to avoid confusion with deferred sync.
        if (!trainingSessionActive) {
          const hasCloud = Boolean(firebaseServices && firebaseUserUid);
          const source = opts?.source ?? 'manual';
          const message = hasCloud
            ? source === 'auto'
              ? 'Settings synced'
              : 'Settings saved'
            : source === 'auto'
              ? 'Settings synced locally'
              : 'Settings saved locally';
          showToast({ message, type: hasCloud ? 'success' : 'info' });
        }
      } catch (error) {
        showToast({ message: ensureAppError(error).message, type: 'error' });
      }
    },
    [firebaseServices, firebaseUserUid, saveTrainingSettings, showToast, trainingSessionActive],
  );

  // Debounced auto-save when settings change
  useEffect(() => {
    const serialized = serializeForComparison(settings);
    if (serialized === lastSavedRef.current) return;
    try {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    } catch {
      /* no-op */
    }
    debounceRef.current = window.setTimeout(() => {
      void saveSettings({ source: 'auto' });
    }, AUTO_SAVE_DELAY_MS) as TimeoutId;
    return (): void => {
      try {
        if (debounceRef.current) window.clearTimeout(debounceRef.current);
      } catch {
        /* no-op */
      }
    };
  }, [saveSettings, settings]);

  return { saveSettings, latestSettingsRef };
}

// ── helpers ────────────────────────────────────────────────────────────
function serializeForComparison(s: TrainingSettings): string {
  const normalized = normalizeTrainingSettings(s, DEFAULT_TRAINING_SETTINGS);
  return serializeTrainingSettings(normalized);
}

function prepareForSave(s: TrainingSettings): TrainingSettingsInput {
  const { customSet, customSequence, ...rest } = s;
  return trainingSettingsSchema.parse({
    ...rest,
    customSet: customSet.length > 0 ? [...customSet] : [],
    ...(customSequence !== undefined && customSequence.length > 0
      ? { customSequence: [...customSequence] }
      : {}),
  });
}
