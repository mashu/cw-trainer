import { useCallback, useRef } from 'react';

import { SLEEP_CANCELABLE_STEP_MS } from '@/lib/constants';
import {
  playMorseCodeControlled,
  resumeAudioContextFromUserGesture,
} from '@/lib/morseAudio';
import { pickTrainingToneHz } from '@/lib/trainingSessionPlayback';
import type { TrainingSettings } from '@/types';

export interface TrainingAudioEngine {
  /** Play morse code for the given text. Returns duration in seconds. */
  readonly playMorse: (text: string, sessionId: number) => Promise<number>;
  /** Stop any playing audio and tear down the AudioContext. */
  readonly stopAudio: () => void;
  /** Cancelable sleep that checks abort flag every SLEEP_CANCELABLE_STEP_MS. */
  readonly sleepCancelable: (ms: number, sessionId: number) => Promise<void>;
  /** Ensure AudioContext is created and resumed (call from user gesture). */
  readonly ensureAudioReady: () => void;
  /** Reference to the abort flag — set to true to cancel in-flight operations. */
  readonly trainingAbortRef: React.MutableRefObject<boolean>;
  /** Reference to the current session id — used to detect stale callbacks. */
  readonly sessionIdRef: React.MutableRefObject<number>;
  /** Reference to the AudioContext — needed by echo mode for feedback playback. */
  readonly audioContextRef: React.MutableRefObject<AudioContext | null>;
}

export function useTrainingAudio(
  settings: TrainingSettings,
): TrainingAudioEngine {
  const audioContextRef = useRef<AudioContext | null>(null);
  const trainingAbortRef = useRef(false);
  const sessionIdRef = useRef(0);
  const currentStopRef = useRef<(() => void) | null>(null);

  const stopAudio = useCallback((): void => {
    try {
      currentStopRef.current?.();
    } catch {
      /* no-op */
    }
    currentStopRef.current = null;
    try {
      audioContextRef.current?.close().catch(() => {});
    } catch {
      /* no-op */
    }
    audioContextRef.current = null;
  }, []);

  const ensureAudioReady = useCallback((): void => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    resumeAudioContextFromUserGesture(audioContextRef.current);
  }, []);

  const sleepCancelable = useCallback(
    async (ms: number, sessionId: number): Promise<void> => {
      const end = Date.now() + ms;
      while (Date.now() < end) {
        if (trainingAbortRef.current || sessionIdRef.current !== sessionId) {
          return;
        }
        const remaining = end - Date.now();
        await new Promise((r) =>
          setTimeout(
            r,
            Math.min(SLEEP_CANCELABLE_STEP_MS, Math.max(0, remaining)),
          ),
        );
      }
    },
    [],
  );

  const playMorse = useCallback(
    async (text: string, sessionId: number): Promise<number> => {
      if (trainingAbortRef.current || sessionIdRef.current !== sessionId) {
        return 0;
      }
      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContext();
        }
        const ctx = audioContextRef.current;
        const { durationSec, stop } = await playMorseCodeControlled(
          ctx,
          text,
          {
            charWpmMin: Math.max(1, settings.charWpmMin),
            charWpmMax: Math.max(1, settings.charWpmMax),
            effectiveWpmMin: Math.max(1, settings.effectiveWpmMin),
            effectiveWpmMax: Math.max(1, settings.effectiveWpmMax),
            extraWordSpaceMultiplier: Math.max(
              0.1,
              settings.extraWordSpaceMultiplier ?? 1,
            ),
            sideTone: pickTrainingToneHz(settings),
            steepness: settings.steepness,
            envelopeSmoothing: settings.envelopeSmoothing ?? 0,
            volumeMin: settings.volumeMin,
            volumeMax: settings.volumeMax,
            linkVolume: settings.linkVolume,
          },
          () =>
            trainingAbortRef.current || sessionIdRef.current !== sessionId,
        );
        currentStopRef.current = stop;
        return durationSec;
      } catch (error) {
        console.error('[TrainingAudio] Playback error:', error);
        return 0;
      }
    },
    [settings],
  );

  return {
    playMorse,
    stopAudio,
    sleepCancelable,
    ensureAudioReady,
    trainingAbortRef,
    sessionIdRef,
    audioContextRef,
  };
}
