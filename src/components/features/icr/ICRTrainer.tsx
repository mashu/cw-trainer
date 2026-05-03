'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ICRStats } from '@/components/features/stats/ICRStats';
import { useICRMicrophone } from '@/hooks/useICRMicrophone';
import { useIcrSessionsActions } from '@/hooks/useIcrSessions';
import { useTrainingSessionLock } from '@/hooks/useTrainingSessionLock';
import { useVAD, type VADConfig } from '@/hooks/useVAD';
import {
  pickRandomChar,
  calibratedReactionMs,
  getReactionTextClass,
  micErrorMessage,
} from '@/lib/icrHelpers';
import {
  playMorseCode as externalPlayMorseCode,
  resumeAudioContextFromUserGesture,
} from '@/lib/morseAudio';
import { LCWO_SEQUENCE } from '@/lib/morseConstants';
import type { SharedAudioFromSettings } from '@/lib/settingsToSharedAudioProps';
import { formatSession } from '@/lib/utils/icrSessionFormatter';
import type { IcrSettings } from '@/types';

import { IcrBucketLegend } from './IcrBucketLegend';
import { IcrSessionChart, type LetterBarPoint, type ReactionScatterPoint } from './IcrSessionChart';
import { IcrCountdownStrip } from './IcrCountdownStrip';
import { IcrTrainingVoiceHud } from './IcrTrainingVoiceHud';
import { IcrTrialList } from './IcrTrialList';

type ICRTrial = {
  id: string;
  target: string;
  heardAt: number;
  durationMs?: number;
  stopAt?: number;
  reactionMs?: number;
  typed?: string;
  correct?: boolean;
};

interface ICRTrainerProps {
  sharedAudio: SharedAudioFromSettings;
  icrSettings: IcrSettings;
  showToast?: (t: { message: string; type: 'success' | 'error' | 'info' }) => void;
}

// ── Sub-component: replaces IIFE at line 913 ──────────────────────────

/** Compact current-trial line under the answer field */
function TrialStatusStrip({
  trial,
  currentInput,
  buckets,
}: {
  trial: ICRTrial | undefined;
  currentInput: string;
  buckets: { greenMax: number; yellowMax: number; orangeMax: number };
}): JSX.Element | null {
  if (!trial) return null;
  const rx = trial.reactionMs;
  const isCorrect = typeof trial.correct === 'boolean' ? trial.correct : null;
  const letter = currentInput || trial.typed;
  return (
    <div className="mt-3 flex items-center justify-center gap-6 border-t border-slate-100/90 pt-3 text-xs sm:text-sm">
      <div className="flex items-baseline gap-1.5">
        <span className="text-slate-400">Rx</span>
        <span className={`font-semibold tabular-nums ${getReactionTextClass(rx ?? null, buckets)}`}>
          {rx != null && rx >= 0 ? `${rx} ms` : '—'}
        </span>
      </div>
      <div className="h-3 w-px bg-slate-200" aria-hidden />
      <div className="flex items-baseline gap-1.5">
        <span className="text-slate-400">Key</span>
        {letter ? (
          <span
            className={
              trial.typed
                ? isCorrect === true
                  ? 'font-bold text-emerald-600'
                  : isCorrect === false
                    ? 'font-bold text-rose-600'
                    : 'font-semibold text-slate-700'
                : 'text-lg font-bold text-slate-800'
            }
          >
            {letter}
            {trial.typed && isCorrect === true && <span className="text-emerald-500"> ✓</span>}
            {trial.typed && isCorrect === false && <span className="text-rose-500"> ✗</span>}
          </span>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────

export function ICRTrainer({ sharedAudio, icrSettings, showToast }: ICRTrainerProps): JSX.Element {
  const { takeLock: takeIcrSessionLock, releaseLock: releaseIcrSessionLock } =
    useTrainingSessionLock();

  const [isRunning, setIsRunning] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const { saveIcrSession } = useIcrSessionsActions();
  const [trials, setTrials] = useState<ICRTrial[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentInput, setCurrentInput] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Ref-based double-start guard (state alone races on rapid clicks)
  const isRunningRef = useRef(false);
  const stopRef = useRef<boolean>(false);
  const sessionActiveRef = useRef<boolean>(false);
  const trialsRef = useRef<ICRTrial[]>([]);
  const currentIndexRef = useRef<number>(0);
  const audioEndAtRef = useRef<number | null>(null);
  const currentTrialHeardAtRef = useRef<number | null>(null);
  const sessionTokenRef = useRef(0);
  const lastPersistedTokenRef = useRef<number | null>(null);
  const inputEventResolversRef = useRef<Record<string, () => void>>({});

  // ── Extracted hooks ──────────────────────────────────────────────────

  const mic = useICRMicrophone();

  const vadConfig: VADConfig = useMemo(() => ({
    vadEnabled: icrSettings.vadEnabled,
    vadThreshold: icrSettings.vadThreshold,
    vadHoldMs: icrSettings.vadHoldMs,
  }), [icrSettings.vadEnabled, icrSettings.vadThreshold, icrSettings.vadHoldMs]);

  const vad = useVAD(vadConfig, mic.measureInputLevel, audioEndAtRef, currentTrialHeardAtRef);
  const vadApiRef = useRef(vad);
  vadApiRef.current = vad;

  // ── Focus on mount ───────────────────────────────────────────────────

  useEffect(() => {
    try { inputRef.current?.focus(); } catch { /* no-op */ }
  }, []);

  const buckets = useMemo(() => ({
    greenMax: icrSettings.bucketGreenMaxMs ?? 400,
    yellowMax: icrSettings.bucketYellowMaxMs ?? 600,
    orangeMax: icrSettings.bucketOrangeMaxMs ?? 800,
  }), [icrSettings.bucketGreenMaxMs, icrSettings.bucketYellowMaxMs, icrSettings.bucketOrangeMaxMs]);

  // ── Sync refs with state ─────────────────────────────────────────────

  useEffect(() => { trialsRef.current = trials; }, [trials]);
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);

  // ── Audio playback ───────────────────────────────────────────────────

  const pickToneHz = useCallback((): number => {
    const min = Math.max(100, sharedAudio.sideToneMin);
    const max = Math.max(min, sharedAudio.sideToneMax);
    if (min === max) return min;
    return Math.floor(min + Math.random() * (max - min + 1));
  }, [sharedAudio.sideToneMin, sharedAudio.sideToneMax]);

  const playChar = useCallback(
    async (ch: string): Promise<{ durationSec: number; audioEndTimeAudioContext: number }> => {
      const ctx = await mic.setupAudioContext();
      stopRef.current = false;

      const { durationSec, startTime } = await externalPlayMorseCode(
        ctx, ch,
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

      const sec = durationSec ?? 0;
      const audioEndTimeAudioContext = (startTime ?? ctx.currentTime) + sec;
      return { durationSec: sec, audioEndTimeAudioContext };
    },
    [sharedAudio, pickToneHz, mic],
  );

  // ── Session control ──────────────────────────────────────────────────

  const stopSession = useCallback((): void => {
    setCountdown(null);
    setIsRunning(false);
    isRunningRef.current = false;
    stopRef.current = true;
    sessionActiveRef.current = false;
    vad.stop();
    mic.stopMic();
    vad.clearAllResolvers();
    inputEventResolversRef.current = {};
  }, [vad, mic]);

  const runSession = useCallback(async (): Promise<void> => {
    // Ref-based guard prevents double-start from rapid clicks
    if (isRunningRef.current) return;
    isRunningRef.current = true;
    sessionTokenRef.current += 1;
    setCurrentIndex(0);
    currentIndexRef.current = 0;
    sessionActiveRef.current = true;
    takeIcrSessionLock();

    try {
      if (!mic.audioContextRef.current) {
        mic.audioContextRef.current = new AudioContext();
        mic.audioContextBaseTimeRef.current =
          Date.now() - mic.audioContextRef.current.currentTime * 1000;
      }
      resumeAudioContextFromUserGesture(mic.audioContextRef.current);
      await mic.setupAudioContext();
      if (icrSettings.vadEnabled) {
        await mic.setupMic(icrSettings.micDeviceId);
      }
      // Start session (and VAD rAF) only after mic → analyser exists, or measureInputLevel stays 0.
      setIsRunning(true);

      // Countdown 3..2..1
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

        stopRef.current = false;
        vad.disarm();
        audioEndAtRef.current = Date.now() + 10000;

        // Clear previous session on first trial of new session
        if (i === 0) setTrials([]);

        const trialId = `${sessionTokenRef.current}-${i}-${Date.now()}`;
        setTrials((prev) => [...prev, { id: trialId, target, heardAt: 0 }]);
        setCurrentIndex(i);
        currentIndexRef.current = i;

        // Refresh wall-clock / context time
        const ctx = mic.audioContextRef.current;
        if (ctx) {
          mic.audioContextBaseTimeRef.current = Date.now() - ctx.currentTime * 1000;
        }

        const { durationSec, audioEndTimeAudioContext } = await playChar(target);
        const durationMs = Math.round((durationSec ?? 0) * 1000);
        const baseTime = mic.audioContextBaseTimeRef.current;

        const audioEndAt = baseTime
          ? baseTime + audioEndTimeAudioContext * 1000
          : Date.now() + Math.max(0, Math.round(durationSec * 1000));

        audioEndAtRef.current = audioEndAt;
        const waitMs = audioEndAt - Date.now();
        if (waitMs > 0) await new Promise((r) => setTimeout(r, waitMs));

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
        if (icrSettings.vadEnabled) vad.arm();

        // Wait for stop event (VAD) or user typing
        const stopResult = await new Promise<{ stopAt?: number; typed: boolean }>((resolve) => {
          if (stopRef.current) { resolve({ stopAt: Date.now(), typed: false }); return; }
          const currentTrial = trialsRef.current.find(t => t.id === trialId);
          if (currentTrial?.typed) { resolve({ typed: true }); return; }

          vad.setStopResolver(trialId, (stopAt: number): void => {
            vad.clearStopResolver(trialId);
            resolve({ stopAt, typed: false });
          });
          inputEventResolversRef.current[trialId] = (): void => {
            delete inputEventResolversRef.current[trialId];
            resolve({ typed: true });
          };
        });

        if (stopResult.stopAt !== undefined) {
          const stopAt = stopResult.stopAt;
          const base = currentTrialHeardAtRef.current ?? trialsRef.current.find(t => t.id === trialId)?.heardAt ?? stopAt;
          const rawMs = Math.max(0, Math.round(stopAt - base));
          const reactionMs = calibratedReactionMs(rawMs, icrSettings.calibrationLatencyMs);
          setTrials((prev) => {
            const copy = prev.slice();
            const idx = copy.findIndex(t => t.id === trialId);
            if (idx >= 0) {
              const existing = copy[idx];
              if (existing) copy[idx] = { ...existing, stopAt, reactionMs };
            }
            return copy;
          });
          stopRef.current = false;
        }

        // Wait for typed answer
        await new Promise<void>((resolve) => {
          const currentTrial = trialsRef.current.find(t => t.id === trialId);
          if (currentTrial?.typed) { resolve(); return; }
          inputEventResolversRef.current[trialId] = (): void => {
            delete inputEventResolversRef.current[trialId];
            resolve();
          };
        });
        if (!sessionActiveRef.current) break;
        await new Promise((resolve) => setTimeout(resolve, Math.max(0, icrSettings.trialDelayMs)));

        if (i + 1 < icrSettings.trialsPerSession) {
          setCurrentIndex(i + 1);
          currentIndexRef.current = i + 1;
        }
      }
    } catch (err) {
      showToast?.({ message: micErrorMessage(err), type: 'error' });
      return;
    } finally {
      releaseIcrSessionLock();
      setCountdown(null);
      setIsRunning(false);
      isRunningRef.current = false;
      currentTrialHeardAtRef.current = null;
      if (trialsRef.current.length > 0) {
        const lastIndex = trialsRef.current.length - 1;
        setCurrentIndex(lastIndex);
        currentIndexRef.current = lastIndex;
      }
      sessionActiveRef.current = false;
      vad.stop();
      mic.stopMic();
      vad.clearAllResolvers();
      inputEventResolversRef.current = {};
    }
  }, [icrSettings, sharedAudio, mic, playChar, vad, showToast, takeIcrSessionLock, releaseIcrSessionLock]);

  // Start VAD loop once when session runs — do NOT depend on `vad` object identity (new each render).
  // Otherwise every trials/currentIndex update stops/restarts the loop and start() clears armedRef,
  // so vad.arm() never sticks and voice never stops the timer.
  useEffect(() => {
    if (!isRunning) return;
    vadApiRef.current.start();
    return (): void => {
      vadApiRef.current.stop();
    };
  }, [isRunning]);

  // Cleanup on unmount
  useEffect(() => {
    return (): void => {
      try {
        if (mic.mediaStreamRef.current) {
          mic.mediaStreamRef.current.getTracks().forEach((t) => t.stop());
          mic.mediaStreamRef.current = null;
        }
      } catch { /* no-op */ }
      vad.stop();
      sessionActiveRef.current = false;
      stopRef.current = true;
      releaseIcrSessionLock();
    };
  // Unmount-only: use latest store setter; do not re-bind mic/vad
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Stats computation ────────────────────────────────────────────────

  const averageReaction = useMemo<number>(() => {
    const vals = trials.filter((t) => !!t.typed && (t.reactionMs || 0) > 0).map((t) => t.reactionMs || 0);
    if (!vals.length) return 0;
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  }, [trials]);

  const accuracyPercent = useMemo<number>(() => {
    const valid = trials.filter((t) => t.typed);
    if (!valid.length) return 0;
    return Math.round((valid.filter((t) => t.correct).length / valid.length) * 100);
  }, [trials]);

  const perLetterCharts = useMemo<{
    readonly bars: LetterBarPoint[];
    readonly dotsCorrectCat: ReactionScatterPoint[];
    readonly dotsWrongCat: ReactionScatterPoint[];
  }>(() => {
    const penaltyFactor = 1.0;
    const agg: Record<string, {
      samples: Array<{ reaction: number; correct: boolean }>;
      total: number; correct: number; avg: number; adjAvg: number; acc: number;
    }> = {};
    trials.forEach((t) => {
      if (!t.typed) return;
      const l = t.target?.toUpperCase();
      if (!l) return;
      if (!agg[l]) agg[l] = { samples: [], total: 0, correct: 0, avg: 0, adjAvg: 0, acc: 0 };
      if (t.reactionMs && t.reactionMs > 0) agg[l].samples.push({ reaction: t.reactionMs, correct: !!t.correct });
      agg[l].total += 1;
      if (t.correct) agg[l].correct += 1;
    });
    const letters = Object.keys(agg).sort((a, b) => LCWO_SEQUENCE.indexOf(a) - LCWO_SEQUENCE.indexOf(b));
    letters.forEach((l) => {
      const stat = agg[l];
      if (!stat) return;
      const s = stat.samples.map((s) => s.reaction);
      const base = s.length ? s.reduce((a, b) => a + b, 0) / s.length : 0;
      const acc = stat.total > 0 ? stat.correct / stat.total : 0;
      stat.avg = base; stat.acc = acc; stat.adjAvg = base * (1 + penaltyFactor * (1 - acc));
    });
    const bars: LetterBarPoint[] = letters.map((l, i) => {
      const stat = agg[l];
      if (!stat) return { letter: l, index: i, adjAvg: 0, avg: 0, acc: 0, total: 0 };
      return { letter: l, index: i, adjAvg: Math.round(stat.adjAvg), avg: Math.round(stat.avg), acc: stat.acc, total: stat.total };
    });
    const dotsCorrectCat: ReactionScatterPoint[] = [];
    const dotsWrongCat: ReactionScatterPoint[] = [];
    letters.forEach((l) => {
      const stat = agg[l];
      if (!stat) return;
      for (let j = 0; j < stat.samples.length; j++) {
        const sample = stat.samples[j];
        if (!sample) continue;
        (sample.correct ? dotsCorrectCat : dotsWrongCat).push({ letter: l, reaction: sample.reaction });
      }
    });
    return { bars, dotsCorrectCat, dotsWrongCat };
  }, [trials]);

  // ── Persist session after completion (with toast on failure) ─────────

  useEffect(() => {
    if (isRunning || !trials.length) return;
    if (lastPersistedTokenRef.current === sessionTokenRef.current) return;
    const summary = formatSession({ trials, sharedAudio, icrSettings });
    lastPersistedTokenRef.current = sessionTokenRef.current;
    if (!summary) return;
    void saveIcrSession(summary).catch((error) => {
      console.warn('[ICR] Failed to persist session summary', error);
      showToast?.({ message: 'Failed to save ICR session. Results may be lost.', type: 'error' });
    });
  }, [icrSettings, isRunning, saveIcrSession, sharedAudio, trials, showToast]);

  // ── Input handler ────────────────────────────────────────────────────

  const handleInput = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const v = (event.target.value || '').toUpperCase();
    const letter = v.slice(-1);
    setCurrentInput(letter);
    if (!letter) return;

    const activeTrial = trialsRef.current.find(t => !t.typed);
    if (!activeTrial) return;

    const correct = letter === activeTrial.target.toUpperCase();
    const typedAt = Date.now();
    const base = currentTrialHeardAtRef.current ?? activeTrial.heardAt ?? 0;
    let reactionMs: number = activeTrial.reactionMs ?? 0;
    if (reactionMs === 0 && base > 0) {
      reactionMs = calibratedReactionMs(typedAt - base, icrSettings.calibrationLatencyMs);
    }
    if (!correct && reactionMs > 0) {
      reactionMs = Math.max(reactionMs * 2.0, icrSettings.bucketOrangeMaxMs || 800);
    }

    setTrials((prev) => {
      const copy = prev.slice();
      const idx = copy.findIndex(t => t.id === activeTrial.id);
      if (idx >= 0) {
        const existing = copy[idx];
        if (existing) {
          copy[idx] = { ...existing, typed: letter, correct, stopAt: typedAt, ...(reactionMs > 0 ? { reactionMs } : {}) };
        }
      }
      return copy;
    });

    const inputResolver = inputEventResolversRef.current[activeTrial.id];
    if (inputResolver) { try { inputResolver(); } catch { /* no-op */ } }
    setCurrentInput('');
  }, [icrSettings.bucketOrangeMaxMs, icrSettings.calibrationLatencyMs]);

  // ── Focus answer field once when session starts (no rAF refocus during trials — steals keys)

  const sessionActive = isRunning || countdown !== null;
  const wasRunningRef = useRef(false);

  useEffect(() => {
    if (isRunning && !wasRunningRef.current) {
      wasRunningRef.current = true;
      const id = window.setTimeout(() => {
        try { inputRef.current?.focus(); } catch { /* no-op */ }
      }, 0);
      return (): void => clearTimeout(id);
    }
    if (!isRunning) wasRunningRef.current = false;
  }, [isRunning]);

  useEffect(() => {
    if (!sessionActive) return;
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { e.preventDefault(); stopSession(); }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return (): void => document.removeEventListener('keydown', onKeyDown, true);
  }, [sessionActive, stopSession]);

  // ── Stats toggle ─────────────────────────────────────────────────────

  const [showStats, setShowStats] = useState(false);

  const activeUntypedTrial = useMemo(
    () => trials.find((t) => !t.typed),
    [trials],
  );
  const voiceReactionLocked =
    activeUntypedTrial != null && activeUntypedTrial.stopAt != null;
  const lockedReactionMs =
    activeUntypedTrial != null && activeUntypedTrial.stopAt != null
      ? activeUntypedTrial.reactionMs ?? null
      : null;

  if (showStats) return <ICRStats embedded onBack={() => setShowStats(false)} />;

  // ── Render ───────────────────────────────────────────────────────────

  const lastTrial = trials[currentIndex] ?? trials[trials.length - 1];

  const trialProgressPct =
    icrSettings.trialsPerSession > 0
      ? (Math.min(currentIndex + 1, icrSettings.trialsPerSession) / icrSettings.trialsPerSession) * 100
      : 0;

  const panelClass =
    'rounded-2xl border border-slate-200/90 bg-white shadow-sm shadow-slate-900/5';

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <header className="mb-8 flex flex-col gap-4 border-b border-slate-100 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Instant Character Recognition
          </h1>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-500">
            Copy the character you hear. With voice enabled, speaking locks your reaction time; then type the letter.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {icrSettings.calibrationLatencyMs != null && icrSettings.calibrationLatencyMs > 0 && (
            <span
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800"
              aria-label={`Mic calibrated ${icrSettings.calibrationLatencyMs} ms`}
            >
              Calibrated {icrSettings.calibrationLatencyMs} ms
            </span>
          )}
          <button
            type="button"
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${
              isRunning ? 'cursor-not-allowed bg-slate-200 text-slate-500' : 'bg-emerald-600 text-white hover:bg-emerald-700'
            }`}
            onClick={() => {
              if (!isRunning) {
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
            type="button"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            onClick={stopSession}
          >
            Stop
          </button>
          <button
            type="button"
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            onClick={() => setShowStats(true)}
          >
            Stats
          </button>
        </div>
      </header>

      <div className="flex flex-col gap-6">
        {/* 1. Training run */}
        <div className={`${panelClass} flex flex-col p-5 sm:p-6`}>
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Session</h2>
              <p className="mt-0.5 text-base font-semibold text-slate-900">Training run</p>
            </div>
            <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold tabular-nums text-slate-700">
              {Math.min(currentIndex + 1, icrSettings.trialsPerSession)} / {icrSettings.trialsPerSession}
            </span>
          </div>

          <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-[width] duration-500 ease-out"
              style={{ width: `${trialProgressPct}%` }}
            />
          </div>

          {countdown !== null && <IcrCountdownStrip value={countdown} />}

          {icrSettings.vadEnabled && isRunning && (
            <IcrTrainingVoiceHud
              active={isRunning && icrSettings.vadEnabled}
              measureInputLevel={mic.measureInputLevel}
              armedRef={vad.armedRef}
              vadThreshold={icrSettings.vadThreshold}
              vadHoldMs={icrSettings.vadHoldMs}
              listeningPaused={countdown !== null}
              reactionLocked={voiceReactionLocked}
              lockedReactionMs={lockedReactionMs}
            />
          )}

          <div className={icrSettings.vadEnabled && isRunning ? 'mt-4' : 'mt-1'}>
            <label
              htmlFor="icr-letter-input"
              className="mb-1.5 block text-center text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400"
            >
              Your answer
            </label>
            <div className="flex justify-center">
              <input
                id="icr-letter-input"
                className="w-[5.5rem] rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 px-3 py-3 text-center text-3xl font-bold tracking-[0.2em] text-slate-900 shadow-inner shadow-slate-900/5 ring-1 ring-slate-900/5 placeholder:text-slate-300 focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 disabled:opacity-50"
                placeholder="·"
                value={currentInput}
                maxLength={1}
                aria-label="Type the letter you heard"
                onChange={handleInput}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.preventDefault();
                }}
                ref={inputRef}
                disabled={!isRunning}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>
          </div>

          {!isRunning && trials.length > 0 && (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/90 px-3 py-2.5 text-center text-xs font-medium text-emerald-900">
              Session finished — press Start for another run.
            </div>
          )}

          {trials.length > 0 && (
            <TrialStatusStrip trial={lastTrial} currentInput={currentInput} buckets={buckets} />
          )}
        </div>

        {/* 2. Session summary (under training) */}
        <div className={`${panelClass} min-w-0 p-5 sm:p-6`}>
          <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Summary</h2>
          <p className="mt-0.5 text-base font-semibold text-slate-900">This session</p>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4">
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3 text-center sm:px-4 sm:py-4">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Avg reaction</div>
              <div
                className={`mt-1 text-xl font-bold tabular-nums sm:text-2xl ${
                  averageReaction ? getReactionTextClass(averageReaction, buckets) : 'text-slate-400'
                }`}
              >
                {averageReaction ? `${averageReaction} ms` : '—'}
              </div>
            </div>
            <div
              className={`rounded-xl border px-3 py-3 text-center sm:px-4 sm:py-4 ${
                accuracyPercent >= 80
                  ? 'border-emerald-200 bg-emerald-50/80'
                  : accuracyPercent >= 50
                    ? 'border-amber-200 bg-amber-50/80'
                    : 'border-rose-200 bg-rose-50/80'
              }`}
            >
              <div
                className={`text-[10px] font-semibold uppercase tracking-wide ${
                  accuracyPercent >= 80
                    ? 'text-emerald-600'
                    : accuracyPercent >= 50
                      ? 'text-amber-700'
                      : 'text-rose-600'
                }`}
              >
                Accuracy
              </div>
              <div
                className={`mt-1 text-xl font-bold tabular-nums sm:text-2xl ${
                  accuracyPercent >= 80
                    ? 'text-emerald-800'
                    : accuracyPercent >= 50
                      ? 'text-amber-800'
                      : 'text-rose-800'
                }`}
              >
                {accuracyPercent}%
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <IcrBucketLegend buckets={buckets} />
            <IcrSessionChart
              bars={perLetterCharts.bars}
              dotsCorrectCat={perLetterCharts.dotsCorrectCat}
              dotsWrongCat={perLetterCharts.dotsWrongCat}
              icrSettings={icrSettings}
            />
          </div>
        </div>

        {/* 3. Trial history (last) */}
        <div className={`${panelClass} p-5 sm:p-6`}>
          <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Trials</h2>
          <p className="mt-0.5 text-base font-semibold text-slate-900">History</p>
          <div className="mt-4">
            <IcrTrialList trials={trials} buckets={buckets} />
          </div>
        </div>
      </div>
    </div>
  );
}
