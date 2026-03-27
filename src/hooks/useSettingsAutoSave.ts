'use client';

import { useCallback, useEffect, useRef } from 'react';

import { AUTO_SAVE_DELAY_MS } from '@/lib/constants';
import { ensureAppError } from '@/lib/errors';
import { serializeSettings as tsSerialize } from '@/lib/trainingSettings';
import { useAppStore } from '@/store';
import type { TrainingSettings } from '@/types';

import type { Toast } from './useToast';

type TimeoutId = number;

export interface UseSettingsAutoSaveOptions {
  readonly settings: TrainingSettings;
  readonly trainingSettingsStatus: string;
  readonly saveTrainingSettings: (
    input: Record<string, unknown>,
  ) => Promise<TrainingSettings>;
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
        const saved = await saveTrainingSettings(toSave as Record<string, unknown>);
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
  const { customSet, customSequence, ...rest } = s;
  const obj: Parameters<typeof tsSerialize>[0] = {
    ...rest,
    ...(customSet && customSet.length > 0 ? { customSet: [...customSet] } : {}),
    ...(customSequence && customSequence.length > 0
      ? { customSequence: [...customSequence] }
      : {}),
  };
  return tsSerialize(obj);
}

function prepareForSave(
  s: TrainingSettings,
): Record<string, unknown> {
  const { customSet, customSequence, ...rest } = s;
  return {
    ...rest,
    customSet: customSet && customSet.length > 0 ? [...customSet] : [],
    ...(customSequence && customSequence.length > 0
      ? { customSequence: [...customSequence] }
      : {}),
  };
}
