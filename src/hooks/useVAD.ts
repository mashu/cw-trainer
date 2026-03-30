'use client';

import { useCallback, useRef } from 'react';

/**
 * Minimum reaction time (ms) we accept from VAD. Reactions below this are treated as
 * echo/playback (speaker→mic). Human auditory reaction is rarely < 80ms; 50ms filters
 * echo without skewing real times.
 */
const MIN_PLAUSIBLE_REACTION_MS = 50;

export interface VADConfig {
  readonly vadEnabled: boolean;
  readonly vadThreshold: number;
  readonly vadHoldMs: number;
  readonly calibrationLatencyMs?: number | null | undefined;
}

export interface VADStopEvent {
  readonly trialId: string;
  readonly stopAt: number;
}

export interface VADEngine {
  /** Start the VAD polling loop. No-op if VAD is disabled. */
  readonly start: () => void;
  /** Stop the VAD polling loop and cancel the rAF. */
  readonly stop: () => void;
  /** Arm the VAD to start listening for the current trial. */
  readonly arm: () => void;
  /** Disarm without stopping the loop. */
  readonly disarm: () => void;
  /** Whether the loop is currently active. */
  readonly activeRef: React.MutableRefObject<boolean>;
  /** Whether the VAD is armed (ready to trigger). */
  readonly armedRef: React.MutableRefObject<boolean>;
  /** Register a resolver for a specific trial ID. Called when VAD triggers. */
  readonly setStopResolver: (trialId: string, resolver: (stopAt: number) => void) => void;
  /** Remove a resolver for a specific trial ID. */
  readonly clearStopResolver: (trialId: string) => void;
  /** Clear all pending resolvers. */
  readonly clearAllResolvers: () => void;
}

/**
 * Manages a requestAnimationFrame-based Voice Activity Detection loop.
 *
 * Key improvements over the inline implementation:
 * - Stores and cancels the rAF frame ID on stop/unmount (prevents detached-component callbacks)
 * - Exposes a clean start/stop/arm/disarm API
 * - Resolver management is encapsulated
 */
export function useVAD(
  config: VADConfig,
  measureInputLevel: () => number,
  audioEndAtRef: React.MutableRefObject<number | null>,
  currentTrialHeardAtRef: React.MutableRefObject<number | null>,
): VADEngine {
  const activeRef = useRef(false);
  const armedRef = useRef(false);
  const vadStartTimeRef = useRef<number | null>(null);
  const frameIdRef = useRef<number>(0);
  const stopResolversRef = useRef<Record<string, (stopAt: number) => void>>({});

  const setStopResolver = useCallback((trialId: string, resolver: (stopAt: number) => void) => {
    stopResolversRef.current[trialId] = resolver;
  }, []);

  const clearStopResolver = useCallback((trialId: string) => {
    delete stopResolversRef.current[trialId];
  }, []);

  const clearAllResolvers = useCallback(() => {
    stopResolversRef.current = {};
  }, []);

  const arm = useCallback(() => {
    armedRef.current = true;
  }, []);

  const disarm = useCallback(() => {
    armedRef.current = false;
    vadStartTimeRef.current = null;
  }, []);

  const stop = useCallback(() => {
    activeRef.current = false;
    armedRef.current = false;
    vadStartTimeRef.current = null;
    if (frameIdRef.current) {
      cancelAnimationFrame(frameIdRef.current);
      frameIdRef.current = 0;
    }
  }, []);

  const start = useCallback(() => {
    if (!config.vadEnabled) return;
    // Cancel any existing loop
    if (frameIdRef.current) {
      cancelAnimationFrame(frameIdRef.current);
      frameIdRef.current = 0;
    }
    armedRef.current = false;
    activeRef.current = true;
    vadStartTimeRef.current = null;

    const tick = (): void => {
      if (!activeRef.current) return;

      // Don't react to microphone input while audio is still playing
      const audioEndAt = audioEndAtRef.current;
      if (audioEndAt && Date.now() < audioEndAt) {
        vadStartTimeRef.current = null;
        frameIdRef.current = requestAnimationFrame(tick);
        return;
      }

      const level = measureInputLevel();
      if (!armedRef.current) {
        // Wait until armed to ignore immediate echo
      } else {
        const above = level >= config.vadThreshold;
        const now = performance.now();
        if (above) {
          if (vadStartTimeRef.current == null) vadStartTimeRef.current = now;
          const held = now - (vadStartTimeRef.current || now);
          if (held >= config.vadHoldMs) {
            const stopAt = Date.now();
            const heardAt = currentTrialHeardAtRef.current;
            const minReactionMs =
              config.calibrationLatencyMs != null && config.calibrationLatencyMs > 0
                ? config.calibrationLatencyMs
                : MIN_PLAUSIBLE_REACTION_MS;
            if (heardAt != null && stopAt - heardAt < minReactionMs) {
              vadStartTimeRef.current = null;
              frameIdRef.current = requestAnimationFrame(tick);
              return;
            }
            // Fire the resolver for the most recent trial
            const waitingTrialIds = Object.keys(stopResolversRef.current);
            if (waitingTrialIds.length > 0) {
              const lastIdx = waitingTrialIds.length - 1;
              const trialId = waitingTrialIds[lastIdx];
              if (trialId !== undefined) {
                const resolver = stopResolversRef.current[trialId];
                if (resolver) {
                  try {
                    resolver(stopAt);
                  } catch { /* no-op */ }
                }
              }
            }
            // Disarm until next trial
            armedRef.current = false;
            vadStartTimeRef.current = null;
            frameIdRef.current = requestAnimationFrame(tick);
            return;
          }
        } else {
          vadStartTimeRef.current = null;
        }
      }
      frameIdRef.current = requestAnimationFrame(tick);
    };
    frameIdRef.current = requestAnimationFrame(tick);
  }, [
    config.vadEnabled,
    config.vadThreshold,
    config.vadHoldMs,
    config.calibrationLatencyMs,
    measureInputLevel,
    audioEndAtRef,
    currentTrialHeardAtRef,
  ]);

  return {
    start,
    stop,
    arm,
    disarm,
    activeRef,
    armedRef,
    setStopResolver,
    clearStopResolver,
    clearAllResolvers,
  };
}
