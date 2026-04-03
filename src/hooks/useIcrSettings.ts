'use client';

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';

import { DEFAULT_ICR_SETTINGS } from '@/config/training.config';
import type { IcrSettings } from '@/types';

const STORAGE_KEY = 'morse_icr_settings';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const clampNumber = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const toNumber = (candidate: unknown, fallback: number, options?: { min?: number; max?: number; integer?: boolean }): number => {
  const raw = typeof candidate === 'string' && candidate.trim() !== '' ? Number(candidate) : candidate;
  const numeric = typeof raw === 'number' && Number.isFinite(raw) ? raw : fallback;
  const bounded = clampNumber(
    options?.integer ? Math.round(numeric) : numeric,
    options?.min ?? Number.MIN_SAFE_INTEGER,
    options?.max ?? Number.MAX_SAFE_INTEGER,
  );
  return bounded;
};

const toBoolean = (candidate: unknown, fallback: boolean): boolean => {
  if (typeof candidate === 'boolean') {
    return candidate;
  }
  if (typeof candidate === 'string') {
    const normalized = candidate.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') {
      return true;
    }
    if (normalized === 'false' || normalized === '0') {
      return false;
    }
  }
  return fallback;
};

const toStringOrUndefined = (candidate: unknown): string | undefined => {
  if (typeof candidate === 'string' && candidate.trim().length > 0) {
    return candidate.trim();
  }
  return undefined;
};

const normalizeIcrSettings = (raw: unknown, fallback: IcrSettings): IcrSettings => {
  if (!isRecord(raw)) {
    return fallback;
  }

  const next: IcrSettings = {
    trialsPerSession: toNumber(raw['trialsPerSession'], fallback.trialsPerSession, {
      min: 1,
      max: 500,
      integer: true,
    }),
    trialDelayMs: toNumber(raw['trialDelayMs'], fallback.trialDelayMs, {
      min: 0,
      max: 10_000,
      integer: true,
    }),
    vadEnabled: toBoolean(raw['vadEnabled'], fallback.vadEnabled),
    vadThreshold: toNumber(raw['vadThreshold'], fallback.vadThreshold, {
      min: 0,
      max: 1,
    }),
    vadHoldMs: toNumber(raw['vadHoldMs'], fallback.vadHoldMs, {
      min: 0,
      max: 2_000,
      integer: true,
    }),
    bucketGreenMaxMs: toNumber(raw['bucketGreenMaxMs'], fallback.bucketGreenMaxMs, {
      min: 1,
      max: 10_000,
      integer: true,
    }),
    bucketYellowMaxMs: toNumber(raw['bucketYellowMaxMs'], fallback.bucketYellowMaxMs, {
      min: 1,
      max: 20_000,
      integer: true,
    }),
    bucketOrangeMaxMs: toNumber(raw['bucketOrangeMaxMs'], fallback.bucketOrangeMaxMs, {
      min: 1,
      max: 30_000,
      integer: true,
    }),
  };

  let calibrationLatencyMs: number | null | undefined = fallback.calibrationLatencyMs;
  if (Object.prototype.hasOwnProperty.call(raw, 'calibrationLatencyMs')) {
    if (raw['calibrationLatencyMs'] === null) {
      calibrationLatencyMs = null;
    } else {
      const n = toNumber(raw['calibrationLatencyMs'], 0, { min: 0, max: 2_000, integer: true });
      calibrationLatencyMs = n > 0 ? n : null;
    }
  }

  const micDeviceIdValue = toStringOrUndefined(raw['micDeviceId']);
  let bucketYellowMaxMs = next.bucketYellowMaxMs;
  let bucketOrangeMaxMs = next.bucketOrangeMaxMs;
  let vadHoldMs = next.vadHoldMs;

  if (bucketYellowMaxMs < next.bucketGreenMaxMs) {
    bucketYellowMaxMs = next.bucketGreenMaxMs;
  }
  if (bucketOrangeMaxMs < bucketYellowMaxMs) {
    bucketOrangeMaxMs = bucketYellowMaxMs;
  }

  if (vadHoldMs < 20) {
    vadHoldMs = 20;
  }

  const result: IcrSettings = {
    ...next,
    bucketYellowMaxMs,
    bucketOrangeMaxMs,
    vadHoldMs,
    ...(micDeviceIdValue !== undefined ? { micDeviceId: micDeviceIdValue } : {}),
    ...(calibrationLatencyMs !== undefined ? { calibrationLatencyMs } : {}),
  };

  return result;
};

export interface UseIcrSettingsResult {
  readonly icrSettings: IcrSettings;
  readonly setIcrSettings: Dispatch<SetStateAction<IcrSettings>>;
  readonly updateIcrSettings: (patch: Partial<IcrSettings>) => void;
  readonly resetIcrSettings: () => void;
}

export function useIcrSettings(storageKey: string = STORAGE_KEY): UseIcrSettingsResult {
  const [icrSettings, setIcrSettingsState] = useState<IcrSettings>(DEFAULT_ICR_SETTINGS);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw);
      const normalized = normalizeIcrSettings(parsed, DEFAULT_ICR_SETTINGS);
      setIcrSettingsState(normalized);
    } catch (error) {
      console.warn('[ICR] Failed to load settings from storage', error);
    }
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(icrSettings));
    } catch (error) {
      console.warn('[ICR] Failed to persist settings to storage', error);
    }
  }, [icrSettings, storageKey]);

  const setIcrSettings = useCallback<Dispatch<SetStateAction<IcrSettings>>>((next) => {
    setIcrSettingsState((prev) => {
      const candidate = typeof next === 'function' ? (next as (current: IcrSettings) => IcrSettings)(prev) : next;
      return normalizeIcrSettings(candidate, prev);
    });
  }, []);

  const updateIcrSettings = useCallback((patch: Partial<IcrSettings>) => {
    setIcrSettings((prev) => ({ ...prev, ...patch }));
  }, [setIcrSettings]);

  const resetIcrSettings = useCallback(() => {
    setIcrSettings(DEFAULT_ICR_SETTINGS);
  }, [setIcrSettings]);

  return {
    icrSettings,
    setIcrSettings,
    updateIcrSettings,
    resetIcrSettings,
  };
}


