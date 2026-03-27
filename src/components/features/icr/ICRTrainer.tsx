'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ICRStats } from '@/components/features/stats/ICRStats';
import { useIcrSessionsActions } from '@/hooks/useIcrSessions';
import {
  pickRandomChar,
  getReactionTextClass,
  micErrorMessage,
} from '@/lib/icrHelpers';
import {
  ensureContext,
  playMorseCode as externalPlayMorseCode,
  resumeAudioContextFromUserGesture,
} from '@/lib/morseAudio';
import { LCWO_SEQUENCE } from '@/lib/morseConstants';
import type { SharedAudioFromSettings } from '@/lib/settingsToSharedAudioProps';
import { formatSession } from '@/lib/utils/icrSessionFormatter';
import type { IcrSettings } from '@/types';

import { IcrBucketLegend } from './IcrBucketLegend';
import { IcrSessionChart, type LetterBarPoint, type ReactionScatterPoint } from './IcrSessionChart';
import { IcrTrialList } from './IcrTrialList';

type ICRTrial = {
  id: string; // unique ID for event-driven identification
  target: string;
  heardAt: number; // ms since epoch at end of audio playback (reaction baseline)
  /** Duration of the character playback (ms); for display so user sees reaction is from end, not start. */
  durationMs?: number;
  stopAt?: number; // ms since epoch when voice (VAD) stopped timer
  reactionMs?: number; // computed stopAt - heardAt (from end of playback)
  typed?: string; // user typed letter for scoring
  correct?: boolean;
};

/**
 * Minimum reaction time (ms) we accept from VAD. Reactions below this are treated as
 * echo/playback (speaker→mic). Human auditory reaction is rarely < 80ms; 50ms filters
 * echo without skewing real times. See Better-ICR (better-icr.herokuapp.com) which uses
 * calibration + spurious detection instead of a fixed buffer.
 */
const MIN_PLAUSIBLE_REACTION_MS = 50;

// ICR settings come from parent (CWTrainer)

// Helper functions (pickRandomChar, getReactionTextClass, getBarFill, micErrorMessage)
// are imported from @/lib/icrHelpers

interface ICRTrainerProps {
  sharedAudio: SharedAudioFromSettings;
  icrSettings: IcrSettings;
  /** Optional: show toast when mic/audio fails to start (e.g. when blocked by browser). */
  showToast?: (t: { message: string; type: 'success' | 'error' | 'info' }) => void;
}

export function ICRTrainer({ sharedAudio, icrSettings, showToast }: ICRTrainerProps): JSX.Element {
  const [isRunning, setIsRunning] = useState(false);
  /** 3, 2, 1 countdown before session starts; null when not counting down. */
  const [countdown, setCountdown] = useState<number | null>(null);
  const { saveIcrSession } = useIcrSessionsActions();
  const [trials, setTrials] = useState<ICRTrial[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentInput, setCurrentInput] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const focusTrapRef = useRef<HTMLDivElement | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioContextBaseTimeRef = useRef<number | null>(null); // Wall-clock time when AudioContext was created/resumed
  const stopRef = useRef<boolean>(false);
  const sessionActiveRef = useRef<boolean>(false);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const vadActiveRef = useRef<boolean>(false);
  const vadArmedRef = useRef<boolean>(false);
  const vadStartTimeRef = useRef<number | null>(null);
  const trialsRef = useRef<ICRTrial[]>([]);
  const currentIndexRef = useRef<number>(0);
  const audioEndAtRef = useRef<number | null>(null);
  const stopSourceRef = useRef<'voice' | 'key' | null>(null);
  const sessionTokenRef = useRef(0);
  const lastPersistedTokenRef = useRef<number | null>(null);
  /** Baseline (end-of-playback time) for the current trial; set synchronously so reaction uses correct value before state flushes. */
  const currentTrialHeardAtRef = useRef<number | null>(null);
  // Event-driven resolvers for trial completion - keyed by trial ID, not index
  const stopEventResolversRef = useRef<Record<string, (stopAt: number) => void>>({});
  const inputEventResolversRef = useRef<Record<string, () => void>>({});

  // Focus input when entering the panel and after mount
  useEffect(() => {
    try {
      inputRef.current?.focus();
    } catch {}
  }, []);

  const buckets = useMemo(() => ({
    greenMax: icrSettings.bucketGreenMaxMs ?? 400,
    yellowMax: icrSettings.bucketYellowMaxMs ?? 600,
    orangeMax: icrSettings.bucketOrangeMaxMs ?? 800,
  }), [icrSettings.bucketGreenMaxMs, icrSettings.bucketYellowMaxMs, icrSettings.bucketOrangeMaxMs]);

  const setupAudioContext = useCallback(async (): Promise<AudioContext> => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
      // Record the wall-clock time when AudioContext is created
      // This allows us to convert AudioContext time to wall-clock time precisely
      audioContextBaseTimeRef.current = Date.now() - (audioContextRef.current.currentTime * 1000);
    }
    await ensureContext(audioContextRef.current);
    // Update base time if context was resumed (currentTime resets on resume)
    if (audioContextRef.current.state === 'running') {
      const ctx = audioContextRef.current;
      audioContextBaseTimeRef.current = Date.now() - (ctx.currentTime * 1000);
    }
    return audioContextRef.current;
  }, []);

  const setupMic = useCallback(
    async (deviceId?: string): Promise<void> => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
      const constraints: MediaStreamConstraints = {
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
        video: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaStreamRef.current = stream;
      const ctx = await setupAudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyserRef.current = analyser;
    },
    [setupAudioContext],
  );

  const stopMic = useCallback((): void => {
    try {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
    } catch {}
    try {
      analyserRef.current?.disconnect();
    } catch {}
    analyserRef.current = null;
  }, []);

  // Device enumeration handled elsewhere (Sidebar)

  useEffect(() => {
    trialsRef.current = trials;
  }, [trials]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  const measureInputLevel = useCallback((): number => {
    const analyser = analyserRef.current;
    if (!analyser) return 0;
    const buffer = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(buffer);
    // Compute normalized peak deviation around midline (128)
    let peak = 0;
    for (let i = 0; i < buffer.length; i++) {
      const sample = buffer[i];
      if (sample === undefined) continue;
      const v = Math.abs(sample - 128) / 128; // 0..1
      if (v > peak) peak = v;
    }
    return peak;
  }, []);

  const startVADLoop = useCallback((): void => {
    if (!icrSettings.vadEnabled) return;
    vadArmedRef.current = false;
    vadActiveRef.current = true;
    vadStartTimeRef.current = null;

    const tick = (): void => {
      if (!vadActiveRef.current) return;
      
      // Don't react to microphone input while audio is still playing
      // This prevents the playback sound from triggering VAD
      const audioEndAt = audioEndAtRef.current;
      if (audioEndAt && Date.now() < audioEndAt) {
        // Audio is still playing - ignore microphone input completely
        // Reset hold timer since we're ignoring input
        vadStartTimeRef.current = null;
        requestAnimationFrame(tick);
        return;
      }
      
      const level = measureInputLevel();
      if (!vadArmedRef.current) {
        // Wait until armed to ignore immediate echo
      } else {
        const above = level >= icrSettings.vadThreshold;
        const now = performance.now();
        if (above) {
          if (vadStartTimeRef.current == null) vadStartTimeRef.current = now;
          const held = now - (vadStartTimeRef.current || now);
          if (held >= icrSettings.vadHoldMs) {
            const stopAt = Date.now();
            const heardAt = currentTrialHeardAtRef.current;
            const minReactionMs = (icrSettings.calibrationLatencyMs != null && icrSettings.calibrationLatencyMs > 0)
              ? icrSettings.calibrationLatencyMs
              : MIN_PLAUSIBLE_REACTION_MS;
            if (heardAt != null && stopAt - heardAt < minReactionMs) {
              vadStartTimeRef.current = null;
              requestAnimationFrame(tick);
              return;
            }
            stopSourceRef.current = 'voice';
            stopRef.current = true;
            const waitingTrialIds = Object.keys(stopEventResolversRef.current);
            if (waitingTrialIds.length > 0) {
              const lastIdx = waitingTrialIds.length - 1;
              const trialId = waitingTrialIds[lastIdx];
              if (trialId === undefined) return;
              const resolver = stopEventResolversRef.current[trialId];
              if (resolver) {
                try {
                  resolver(stopAt);
                } catch {}
              }
            }
            // Keep VAD loop running; disarm until next trial re-arms it
            vadArmedRef.current = false;
            vadStartTimeRef.current = null;
            // Continue the loop even after detection so that arming for next trials works
            requestAnimationFrame(tick);
            return;
          }
        } else {
          vadStartTimeRef.current = null;
        }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [icrSettings.vadEnabled, icrSettings.vadThreshold, icrSettings.vadHoldMs, icrSettings.calibrationLatencyMs, measureInputLevel]);

  const pickToneHz = useCallback((): number => {
    const min = Math.max(100, sharedAudio.sideToneMin);
    const max = Math.max(min, sharedAudio.sideToneMax);
    if (min === max) return min;
    return Math.floor(min + Math.random() * (max - min + 1));
  }, [sharedAudio.sideToneMin, sharedAudio.sideToneMax]);

  const playChar = useCallback(
    async (ch: string): Promise<{ durationSec: number; audioEndTimeAudioContext: number }> => {
      const ctx = await setupAudioContext();
      stopRef.current = false;

      const { durationSec, startTime } = await externalPlayMorseCode(
        ctx,
        ch,
        {
          charWpmMin: Math.max(1, sharedAudio.charWpmMin),
          charWpmMax: Math.max(1, sharedAudio.charWpmMax),
          effectiveWpmMin: Math.max(1, sharedAudio.effectiveWpmMin ?? sharedAudio.charWpmMin),
          effectiveWpmMax: Math.max(1, sharedAudio.effectiveWpmMax ?? sharedAudio.charWpmMax),
          sideTone: pickToneHz(),
          steepness: sharedAudio.steepness,
          envelopeSmoothing: sharedAudio.envelopeSmoothing ?? 0,
          volumeMin: sharedAudio.volumeMin ?? 1,
          volumeMax: sharedAudio.volumeMax ?? 1,
          linkVolume: sharedAudio.linkVolume ?? true,
        },
        () => stopRef.current,
      );

      // Use the start time returned by the player (after ensureContext), not ctx.currentTime
      // from before the await — otherwise short characters get inflated reaction times.
      const sec = durationSec ?? 0;
      const audioEndTimeAudioContext = (startTime ?? ctx.currentTime) + sec;

      return { durationSec: sec, audioEndTimeAudioContext };
    },
    [
      sharedAudio.charWpmMin,
      sharedAudio.charWpmMax,
      sharedAudio.effectiveWpmMin,
      sharedAudio.effectiveWpmMax,
      sharedAudio.envelopeSmoothing,
      sharedAudio.steepness,
      sharedAudio.volumeMin,
      sharedAudio.volumeMax,
      sharedAudio.linkVolume,
      pickToneHz,
      setupAudioContext,
    ],
  );

  const runSession = useCallback(async (): Promise<void> => {
    if (isRunning) return;
    sessionTokenRef.current += 1;
    // Don't clear trials here - clear them when we actually start the first trial
    // This preserves the previous session's stats until the new session begins
    setCurrentIndex(0);
    currentIndexRef.current = 0;
    setIsRunning(true);
    sessionActiveRef.current = true;
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
        audioContextBaseTimeRef.current =
          Date.now() - audioContextRef.current.currentTime * 1000;
      }
      resumeAudioContextFromUserGesture(audioContextRef.current);
      await setupAudioContext();
      if (icrSettings.vadEnabled) {
        await setupMic(icrSettings.micDeviceId);
      }
      // Focus input field when session starts
      requestAnimationFrame(() => {
        try {
          inputRef.current?.focus();
        } catch {}
      });
      // Countdown 3..2..1 so user can get ready (cancel with Stop or Esc)
      for (let c = 3; c >= 1; c--) {
        setCountdown(c);
        await new Promise((r) => setTimeout(r, 1000));
        if (!sessionActiveRef.current) break;
      }
      setCountdown(null);
      if (!sessionActiveRef.current) return;
      for (let i = 0; i < icrSettings.trialsPerSession; i++) {
        if (!sessionActiveRef.current) break;
        const target = pickRandomChar({
          kochLevel: sharedAudio.kochLevel,
          ...(sharedAudio.charSetMode !== undefined ? { charSetMode: sharedAudio.charSetMode } : {}),
          ...(sharedAudio.digitsLevel !== undefined ? { digitsLevel: sharedAudio.digitsLevel } : {}),
          ...(sharedAudio.mixedLettersPercent !== undefined ? { mixedLettersPercent: sharedAudio.mixedLettersPercent } : {}),
          ...(sharedAudio.customSet !== undefined ? { customSet: sharedAudio.customSet } : {}),
          ...(sharedAudio.customSequence !== undefined ? { customSequence: sharedAudio.customSequence } : {}),
          ...(sharedAudio.slidingWindowStart !== undefined ? { slidingWindowStart: sharedAudio.slidingWindowStart } : {}),
          ...(sharedAudio.slidingWindowEnd !== undefined ? { slidingWindowEnd: sharedAudio.slidingWindowEnd } : {}),
        });
        // Reset per-trial gates
        stopRef.current = false;
        stopSourceRef.current = null;
        vadArmedRef.current = false;
        // Set audioEndAt to a future time initially to prevent VAD from triggering during playback
        // We'll update it with the precise time after audio starts
        audioEndAtRef.current = Date.now() + 10000; // Set to far future initially
        
        // Clear previous session's trials only when we're about to add the first trial of the new session
        // This preserves the previous session's data for analysis until the new session actually begins
        // We clear right before adding the first trial, ensuring stats remain visible until then
        if (i === 0) {
          setTrials([]);
        }
        
        // Add trial placeholder with unique ID; will set heardAt to audio end timestamp
        const trialId = `${sessionTokenRef.current}-${i}-${Date.now()}`;
        setTrials((prev) => [...prev, { id: trialId, target, heardAt: 0 }]);
        setCurrentIndex(i);
        currentIndexRef.current = i;
        // Refresh wall-clock ↔ context time so each character uses a fresh reference (avoids drift affecting short chars)
        const ctx = audioContextRef.current;
        if (ctx) {
          audioContextBaseTimeRef.current = Date.now() - (ctx.currentTime * 1000);
        }
        // Schedule audio and get precise completion time
        const { durationSec, audioEndTimeAudioContext } = await playChar(target);
        const durationMs = Math.round((durationSec ?? 0) * 1000);
        // Convert AudioContext time to precise wall-clock time
        // This gives us the exact moment when audio completes
        const baseTime = audioContextBaseTimeRef.current;
        if (!baseTime) {
          // Fallback if base time not set (shouldn't happen): use computed end time as baseline
          const fallbackEndAt = Date.now() + Math.max(0, Math.round(durationSec * 1000));
          audioEndAtRef.current = fallbackEndAt;
          currentTrialHeardAtRef.current = fallbackEndAt;
          setTrials((prev) => {
            const copy = prev.slice();
            const trial = copy[i];
            if (trial && trial.id === trialId) {
              copy[i] = { ...trial, heardAt: fallbackEndAt, durationMs };
            }
            return copy;
          });
          const waitMs = Math.max(0, fallbackEndAt - Date.now());
          if (waitMs > 0) {
            await new Promise((r) => setTimeout(r, waitMs));
          }
          audioEndAtRef.current = null;
          if (icrSettings.vadEnabled) {
            vadArmedRef.current = true;
          }
        } else {
          // Calculate precise wall-clock time when audio completes
          const audioEndAt = baseTime + (audioEndTimeAudioContext * 1000);
          // Set this immediately so VAD loop knows audio is playing
          audioEndAtRef.current = audioEndAt;
          
          // Wait until the exact moment audio completes
          const waitMs = audioEndAt - Date.now();
          if (waitMs > 0) {
            await new Promise((r) => setTimeout(r, waitMs));
          }
          
          // Use the computed end time as baseline (not Date.now()) so reaction times
          // are not biased by setTimeout/event-loop jitter — short characters would
          // otherwise show artificially low times. Store in ref so we read correct value
          // before React state flushes (fast responses would otherwise see heardAt: 0).
          currentTrialHeardAtRef.current = audioEndAt;
          setTrials((prev) => {
            const copy = prev.slice();
            const trial = copy[i];
            if (trial && trial.id === trialId) {
              copy[i] = { ...trial, heardAt: audioEndAt, durationMs };
            }
            return copy;
          });
          audioEndAtRef.current = null;
          if (icrSettings.vadEnabled) {
            vadArmedRef.current = true;
          }
        }
        
        // Event-driven wait for stop event (VAD or key) or user typing
        const waitForStopOrInput = (): Promise<{ stopAt?: number; typed: boolean }> => {
          return new Promise((resolve) => {
            // Check if already stopped or typed
            if (stopRef.current) {
              const stopAt = Date.now();
              resolve({ stopAt, typed: false });
              return;
            }
            // Find trial by ID (event-driven - no index dependency)
            const currentTrial = trialsRef.current.find(t => t.id === trialId);
            if (currentTrial?.typed) {
              resolve({ typed: true });
              return;
            }
            
            // Set up resolver for stop event - keyed by trial ID
            stopEventResolversRef.current[trialId] = (stopAt: number): void => {
              delete stopEventResolversRef.current[trialId];
              resolve({ stopAt, typed: false });
            };
            
            // Set up resolver for input event - keyed by trial ID
            inputEventResolversRef.current[trialId] = (): void => {
              delete inputEventResolversRef.current[trialId];
              resolve({ typed: true });
            };
          });
        };
        
        const stopResult = await waitForStopOrInput();
        
        if (stopResult.stopAt !== undefined) {
          // Stop event occurred (VAD or key)
          const stopAt = stopResult.stopAt;
          // Use ref first so we have correct baseline before React state has flushed
          const base = currentTrialHeardAtRef.current ?? trialsRef.current.find(t => t.id === trialId)?.heardAt ?? stopAt;
          const reactionMs = Math.max(0, Math.round(stopAt - base));
          setTrials((prev) => {
            const copy = prev.slice();
            const idx = copy.findIndex(t => t.id === trialId);
            if (idx >= 0) {
              const existing = copy[idx];
              if (existing) {
                copy[idx] = { ...existing, stopAt, reactionMs };
              }
            }
            return copy;
          });
          stopRef.current = false;
          // Focus input for answer entry
          requestAnimationFrame(() => {
            try {
              inputRef.current?.focus();
            } catch {}
          });
        } else if (stopResult.typed) {
          // User already typed - reaction time should be recorded in onChange handler
          requestAnimationFrame(() => {
            try {
              inputRef.current?.focus();
            } catch {}
          });
        }
        
        // Event-driven wait for user input if not already provided
        const waitForInput = (): Promise<void> => {
          return new Promise((resolve) => {
            // Check if already typed - find by ID
            const currentTrial = trialsRef.current.find(t => t.id === trialId);
            if (currentTrial?.typed) {
              resolve();
              return;
            }
            
            // Set up resolver for input event - keyed by trial ID
            inputEventResolversRef.current[trialId] = (): void => {
              delete inputEventResolversRef.current[trialId];
              resolve();
            };
          });
        };
        
        await waitForInput();
        if (!sessionActiveRef.current) break;
        // Delay before next trial
        await new Promise((resolve) => setTimeout(resolve, Math.max(0, icrSettings.trialDelayMs)));
        // Only update currentIndex if there are more trials coming
        if (i + 1 < icrSettings.trialsPerSession) {
          setCurrentIndex(i + 1);
          currentIndexRef.current = i + 1;
        } else {
          // Session complete - point to the last trial for display
          setCurrentIndex(i);
          currentIndexRef.current = i;
        }
        // Focus input field for next trial
        requestAnimationFrame(() => {
          try {
            inputRef.current?.focus();
          } catch {}
        });
      }
    } catch (err) {
      showToast?.({ message: micErrorMessage(err), type: 'error' });
      return;
    } finally {
      setCountdown(null);
      setIsRunning(false);
      currentTrialHeardAtRef.current = null;
      // Ensure currentIndex points to the last trial when session ends
      // Use trialsRef to get the latest value (trials state might be stale in finally block)
      if (trialsRef.current.length > 0) {
        const lastIndex = trialsRef.current.length - 1;
        setCurrentIndex(lastIndex);
        currentIndexRef.current = lastIndex;
      }
      vadActiveRef.current = false;
      vadArmedRef.current = false;
      sessionActiveRef.current = false;
      stopMic();
      // Clean up any pending resolvers
      stopEventResolversRef.current = {};
      inputEventResolversRef.current = {};
    }
  }, [isRunning, icrSettings, sharedAudio, setupAudioContext, setupMic, playChar, stopMic, showToast]);

  useEffect(() => {
    if (!isRunning) return;
    startVADLoop();
    return (): void => {
      vadActiveRef.current = false;
    };
  }, [isRunning, startVADLoop]);

  // Calibration UI removed from ICR (moved to Sidebar)

  // Cleanup on unmount: stop mic tracks
  useEffect(() => {
    return (): void => {
      try {
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((t) => t.stop());
          mediaStreamRef.current = null;
        }
      } catch {}
      vadActiveRef.current = false;
      vadArmedRef.current = false;
      sessionActiveRef.current = false;
      stopRef.current = true;
    };
  }, []);

  // Timer stops only on voice (VAD), not on key press — so reaction time is from sound end to speech.
  // User can still type the letter for scoring after saying it (or type without saying for accessibility).

  // Calibration controls removed from this component

  const averageReaction = useMemo<number>(() => {
    // Only include completed trials (typed) to avoid shifting average before user confirms
    const vals = trials
      .filter((t) => !!t.typed && (t.reactionMs || 0) > 0)
      .map((t) => t.reactionMs || 0);
    if (!vals.length) return 0;
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  }, [trials]);

  const accuracyPercent = useMemo<number>(() => {
    const valid = trials.filter((t) => t.typed);
    if (!valid.length) return 0;
    const ok = valid.filter((t) => t.correct).length;
    return Math.round((ok / valid.length) * 100);
  }, [trials]);

  const perLetterCharts = useMemo<{
    readonly bars: LetterBarPoint[];
    readonly dotsCorrectCat: ReactionScatterPoint[];
    readonly dotsWrongCat: ReactionScatterPoint[];
  }>(() => {
    const penaltyFactor = 1.0; // increases bar with lower accuracy (0..1)
    // aggregate per letter
    const agg: Record<
      string,
      {
        samples: Array<{ reaction: number; correct: boolean }>;
        total: number;
        correct: number;
        avg: number;
        adjAvg: number;
        acc: number;
      }
    > = {};
    trials.forEach((t) => {
      // Only count after the user has typed their answer
      if (!t.typed) return;
      const l = t.target?.toUpperCase();
      if (!l) return;
      if (!agg[l]) agg[l] = { samples: [], total: 0, correct: 0, avg: 0, adjAvg: 0, acc: 0 };
      if (t.reactionMs && t.reactionMs > 0)
        agg[l].samples.push({ reaction: t.reactionMs, correct: !!t.correct });
      agg[l].total += 1;
      if (t.correct) agg[l].correct += 1;
    });
    const letters = Object.keys(agg).sort(
      (a, b) => LCWO_SEQUENCE.indexOf(a) - LCWO_SEQUENCE.indexOf(b),
    );
    // compute averages
    letters.forEach((l) => {
      const stat = agg[l];
      if (!stat) return;
      const s = stat.samples.map((s) => s.reaction);
      const base = s.length ? s.reduce((a, b) => a + b, 0) / s.length : 0;
      const acc = stat.total > 0 ? stat.correct / stat.total : 0;
      const adjusted = base * (1 + penaltyFactor * (1 - acc));
      stat.avg = base;
      stat.acc = acc;
      stat.adjAvg = adjusted;
    });
    // bars data
    const bars: LetterBarPoint[] = letters.map((l, i) => {
      const stat = agg[l];
      if (!stat) return { letter: l, index: i, adjAvg: 0, avg: 0, acc: 0, total: 0 };
      return {
        letter: l,
        index: i,
        adjAvg: Math.round(stat.adjAvg),
        avg: Math.round(stat.avg),
        acc: stat.acc,
        total: stat.total,
      };
    });
    // category-aligned dots for simplicity/robustness
    const dotsCorrectCat: ReactionScatterPoint[] = [];
    const dotsWrongCat: ReactionScatterPoint[] = [];
    letters.forEach((l) => {
      const stat = agg[l];
      if (!stat) return;
      const samples = stat.samples;
      for (let j = 0; j < samples.length; j++) {
        const sample = samples[j];
        if (!sample) continue;
        const targetArr = sample.correct ? dotsCorrectCat : dotsWrongCat;
        targetArr.push({ letter: l, reaction: sample.reaction });
      }
    });
    return { bars, dotsCorrectCat, dotsWrongCat };
  }, [trials]);

  // Persist session locally after completion
  useEffect(() => {
    if (isRunning) return;
    if (!trials.length) return;
    if (lastPersistedTokenRef.current === sessionTokenRef.current) {
      return;
    }

    const summary = formatSession({
      trials,
      sharedAudio,
      icrSettings,
    });

    lastPersistedTokenRef.current = sessionTokenRef.current;

    if (!summary) {
      return;
    }

    void saveIcrSession(summary).catch((error) => {
      console.warn('[ICR] Failed to persist session summary', error);
    });
  }, [icrSettings, isRunning, saveIcrSession, sharedAudio, trials]);

  const [showStats, setShowStats] = useState(false);
  const sessionActive = isRunning || countdown !== null;

  // Keep focus inside ICR panel during session (until Stop or Esc)
  useEffect(() => {
    if (!sessionActive) return;
    const trap = focusTrapRef.current;
    const input = inputRef.current;
    if (!trap || !input) return;

    const handleFocusIn = (e: FocusEvent): void => {
      const target = e.target as Node;
      if (trap.contains(target)) return;
      // Restore focus into trap so keyboard doesn't leave the session
      requestAnimationFrame(() => {
        input.focus();
      });
    };

    const handleKeyDown: (e: KeyboardEvent) => void = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setCountdown(null);
        setIsRunning(false);
        vadActiveRef.current = false;
        vadArmedRef.current = false;
        stopRef.current = true;
        sessionActiveRef.current = false;
        stopMic();
        return;
      }
      if (e.key === 'Tab' && trap.contains(document.activeElement)) {
        e.preventDefault();
        input.focus();
      }
    };

    document.addEventListener('focusin', handleFocusIn, true);
    document.addEventListener('keydown', handleKeyDown, true);
    return (): void => {
      document.removeEventListener('focusin', handleFocusIn, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [sessionActive, stopMic]);

  if (showStats) {
    return (
      <ICRStats
        embedded
        onBack={() => setShowStats(false)}
      />
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4" ref={focusTrapRef} tabIndex={-1}>
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Instant Character Recognition (ICR)</h1>
          <div className="flex gap-2">
          <button
            className={`px-3 py-2 rounded ${isRunning ? 'bg-gray-300 text-gray-600' : 'bg-emerald-600 text-white'}`}
            onClick={() => {
              if (!isRunning) {
                // Don't clear trials here - let runSession clear them when it actually starts
                // This preserves the previous session's stats until the new session begins
                setCurrentIndex(0);
                currentIndexRef.current = 0;
                void runSession();
              }
            }}
            disabled={isRunning}
          >
            Start
          </button>
          <button
            className="px-3 py-2 rounded bg-gray-100"
            onClick={() => {
              setCountdown(null);
              setIsRunning(false);
              vadActiveRef.current = false;
              vadArmedRef.current = false;
              stopRef.current = true;
              sessionActiveRef.current = false;
              stopMic();
            }}
          >
            Stop
          </button>
          <button
            className="px-3 py-2 rounded bg-blue-600 text-white"
            onClick={() => setShowStats(true)}
          >
            📊 Stats
          </button>
          </div>
        </div>
        {icrSettings.calibrationLatencyMs != null && icrSettings.calibrationLatencyMs > 0 && (
          <p className="mt-1.5 text-xs text-emerald-600 font-medium" aria-label="Mic calibrated">
            Mic calibrated ({icrSettings.calibrationLatencyMs} ms)
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 mb-4">
        <div className="p-6 border rounded flex flex-col items-center justify-center min-h-[220px] relative">
          {countdown !== null && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-100/90 rounded z-10" aria-live="polite" aria-atomic="true">
              <span className="text-8xl font-bold text-slate-700 tabular-nums">{countdown}</span>
            </div>
          )}
          <p className="text-sm text-slate-600 mb-2">
            Say the letter as soon as you recognize it, then type it.
          </p>
          <div className="text-sm text-slate-600">
            Trial {Math.min(currentIndex + 1, icrSettings.trialsPerSession)} /{' '}
            {icrSettings.trialsPerSession}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Voice above your threshold stops the timer; typing records your answer.
          </div>
          <div className="mt-3 flex items-center gap-2">
            <input
              className="border rounded px-3 py-2 w-28 text-center text-xl tracking-widest caret-transparent"
              placeholder="?"
              value={currentInput}
              maxLength={1}
              aria-label="Type the letter you heard"
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                const v = (event.target.value || '').toUpperCase();
                const letter = v.slice(-1);
                setCurrentInput(letter);
                if (letter) {
                  // Event-driven: find the active trial (the one without typed value yet)
                  // This is truly event-driven - no index tracking needed!
                  const activeTrial = trials.find(t => !t.typed);
                  if (activeTrial) {
                    const correct = letter === activeTrial.target.toUpperCase();
                    const typedAt = Date.now();
                    // Use ref so baseline is correct before state flushes (same fix as stop path)
                    const base = currentTrialHeardAtRef.current ?? activeTrial.heardAt ?? 0;
                    
                    // Calculate reaction time if not already set
                    let reactionMs: number = activeTrial.reactionMs ?? 0;
                    if (reactionMs === 0 && base > 0) {
                      reactionMs = Math.max(0, Math.round(typedAt - base));
                    }
                    
                    // Apply penalty for incorrect letters
                    // Use bucketYellowMaxMs as a penalty timeout, or multiply by penalty factor
                    const penaltyFactor = 2.0; // Double the time for incorrect answers
                    if (!correct && reactionMs > 0) {
                      // For incorrect letters, use max of actual time or penalty timeout
                      const penaltyTimeout = icrSettings.bucketOrangeMaxMs || 800;
                      reactionMs = Math.max(reactionMs * penaltyFactor, penaltyTimeout);
                    }
                    
                    setTrials((prev) => {
                      const copy = prev.slice();
                      const idx = copy.findIndex(t => t.id === activeTrial.id);
                      if (idx >= 0) {
                        const existing = copy[idx];
                        if (existing) {
                          copy[idx] = { 
                            ...existing, 
                            typed: letter, 
                            correct,
                            stopAt: typedAt,
                            ...(reactionMs > 0 ? { reactionMs } : {}),
                          };
                        }
                      }
                      return copy;
                    });
                    
                    // Resolve input event promise if waiting - use trial ID
                    const inputResolver = inputEventResolversRef.current[activeTrial.id];
                    if (inputResolver) {
                      try {
                        inputResolver();
                      } catch {}
                    }
                    
                    // clear field and keep focus for next trial
                    setCurrentInput('');
                    requestAnimationFrame(() => {
                      try {
                        inputRef.current?.focus();
                      } catch {}
                    });
                  }
                }
              }}
              onKeyDown={(e) => {
                if (e.key.length === 1) return; // handled by onChange
                if (e.key === 'Enter') {
                  e.preventDefault();
                }
              }}
              ref={inputRef}
              disabled={!isRunning}
            />
          </div>
          {!isRunning && trials.length > 0 && (
            <div className="mt-3 text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded">
              Session complete. Press Start to run another session.
            </div>
          )}
          {trials.length > 0 && ((): JSX.Element => {
            const lastTrial = trials[currentIndex] ?? trials[trials.length - 1];
            const lastReactionMs = lastTrial?.reactionMs ?? null;
            const isCorrect = typeof lastTrial?.correct === 'boolean' ? lastTrial.correct : null;
            return (
              <div className="mt-3 text-sm">
                {lastTrial?.durationMs != null && lastTrial.durationMs > 0 && (
                  <div className="text-slate-500 text-xs mb-0.5">
                    Character {lastTrial.target} played in ~{lastTrial.durationMs} ms (reaction is from end)
                  </div>
                )}
                <div>
                  Last Reaction:{' '}
                  <span className={getReactionTextClass(lastReactionMs, buckets)}>
                    {lastReactionMs != null ? `${lastReactionMs} ms` : '—'}
                  </span>
                </div>
                <div>
                  Answer:{' '}
                  {(currentInput || lastTrial?.typed) ? (
                    <span className={lastTrial?.typed
                      ? (isCorrect === true ? 'text-emerald-600 font-medium' : isCorrect === false ? 'text-rose-600 font-medium' : 'text-slate-600')
                      : 'text-slate-700 font-medium'
                    }>
                      {currentInput || lastTrial?.typed}
                    </span>
                  ) : (
                    '—'
                  )}{' '}
                  {lastTrial?.typed && isCorrect === true && <span className="text-emerald-600">✓</span>}
                  {lastTrial?.typed && isCorrect === false && <span className="text-rose-600">✗</span>}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Mic & VAD controls moved to Sidebar */}
      </div>
      {/* Session audio settings removed; using global sidebar settings */}

      <div className="p-4 border rounded">
        <h3 className="font-semibold mb-3">Summary</h3>
        <div className="grid grid-cols-2 gap-4 mb-4 max-w-md">
          <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-center">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-0.5">Average Reaction</div>
            <div className={`text-2xl font-bold tabular-nums ${averageReaction ? getReactionTextClass(averageReaction, buckets) : 'text-slate-400'}`}>
              {averageReaction ? `${averageReaction} ms` : '—'}
            </div>
          </div>
          <div className={`rounded-xl border px-4 py-3 text-center ${
            accuracyPercent >= 80 ? 'bg-emerald-50 border-emerald-200' :
            accuracyPercent >= 50 ? 'bg-amber-50 border-amber-200' :
            'bg-rose-50 border-rose-200'
          }`}>
            <div className={`text-xs font-medium uppercase tracking-wide mb-0.5 ${
              accuracyPercent >= 80 ? 'text-emerald-600' : accuracyPercent >= 50 ? 'text-amber-700' : 'text-rose-600'
            }`}>Accuracy</div>
            <div className={`text-2xl font-bold tabular-nums ${
              accuracyPercent >= 80 ? 'text-emerald-700' : accuracyPercent >= 50 ? 'text-amber-700' : 'text-rose-700'
            }`}>{accuracyPercent}%</div>
          </div>
        </div>
        <IcrBucketLegend buckets={buckets} />
        <IcrSessionChart
          bars={perLetterCharts.bars}
          dotsCorrectCat={perLetterCharts.dotsCorrectCat}
          dotsWrongCat={perLetterCharts.dotsWrongCat}
          icrSettings={icrSettings}
        />
      </div>
      <IcrTrialList trials={trials} buckets={buckets} />
      </div>
  );
}
