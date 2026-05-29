import { useCallback, useRef } from 'react';

import {
  createBandConditionsAudio,
  type BandConditionsAudio,
} from '@/lib/audio/bandConditions';
import { SLEEP_CANCELABLE_STEP_MS } from '@/lib/constants';
import { clampExtraSpacingMultiplier } from '@/lib/extraSpacing';
import {
  playMorseCodeControlled,
  resumeAudioContextFromUserGesture,
} from '@/lib/morseAudio';
import { pickTrainingToneHz } from '@/lib/trainingSessionPlayback';
import type { TrainingSettings } from '@/types';

export type TrainingAudioPlaybackResult =
  | { readonly status: 'played'; readonly durationSec: number }
  | { readonly status: 'skippedBecauseAborted' }
  | { readonly status: 'suspended' }
  | { readonly status: 'failed'; readonly message: string };

export interface TrainingAudioEngine {
  /** Play morse code for the given text. */
  readonly playMorse: (text: string, sessionId: number) => Promise<TrainingAudioPlaybackResult>;
  /** Stop any playing audio and tear down the AudioContext. */
  readonly stopAudio: () => void;
  /** Stop current Morse playback without tearing down session ambience. */
  readonly stopCurrentPlayback: () => void;
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
  const bandConditionsRef = useRef<BandConditionsAudio | null>(null);

  const ensureBandConditions = useCallback(
    (ctx: AudioContext): BandConditionsAudio => {
      if (!bandConditionsRef.current) {
        bandConditionsRef.current = createBandConditionsAudio(ctx, settings);
      } else {
        bandConditionsRef.current.update(settings);
      }
      return bandConditionsRef.current;
    },
    [settings],
  );

  const stopCurrentPlayback = useCallback((): void => {
    try {
      currentStopRef.current?.();
    } catch {
      /* no-op */
    }
    currentStopRef.current = null;
  }, []);

  const stopAudio = useCallback((): void => {
    stopCurrentPlayback();
    try {
      bandConditionsRef.current?.stop();
    } catch {
      /* no-op */
    }
    bandConditionsRef.current = null;
    try {
      audioContextRef.current?.close().catch(() => {});
    } catch {
      /* no-op */
    }
    audioContextRef.current = null;
  }, [stopCurrentPlayback]);

  const ensureAudioReady = useCallback((): void => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    resumeAudioContextFromUserGesture(audioContextRef.current);
    ensureBandConditions(audioContextRef.current);
  }, [ensureBandConditions]);

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
    async (text: string, sessionId: number): Promise<TrainingAudioPlaybackResult> => {
      if (trainingAbortRef.current || sessionIdRef.current !== sessionId) {
        return { status: 'skippedBecauseAborted' };
      }
      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContext();
        }
        const ctx = audioContextRef.current;
        if (ctx.state === 'suspended') {
          resumeAudioContextFromUserGesture(ctx);
        }
        const bandConditions = ensureBandConditions(ctx);
        const { durationSec, stop } = await playMorseCodeControlled(
          ctx,
          text,
          {
            charWpmMin: Math.max(1, settings.charWpmMin),
            charWpmMax: Math.max(1, settings.charWpmMax),
            effectiveWpmMin: Math.max(1, settings.effectiveWpmMin),
            effectiveWpmMax: Math.max(1, settings.effectiveWpmMax),
            extraWordSpaceMultiplier: clampExtraSpacingMultiplier(
              settings.extraWordSpaceMultiplier,
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
          bandConditions.morseOutput,
        );
        currentStopRef.current = stop;
        return { status: 'played', durationSec };
      } catch (error) {
        console.error('[TrainingAudio] Playback error:', error);
        return {
          status: 'failed',
          message: error instanceof Error ? error.message : 'Unable to play Morse audio.',
        };
      }
    },
    [ensureBandConditions, settings],
  );

  return {
    playMorse,
    stopAudio,
    stopCurrentPlayback,
    sleepCancelable,
    ensureAudioReady,
    trainingAbortRef,
    sessionIdRef,
    audioContextRef,
  };
}
