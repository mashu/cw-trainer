'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ICRStats } from '@/components/features/stats/ICRStats';
import { useICRMicrophone } from '@/hooks/useICRMicrophone';
import { useIcrSessionsActions } from '@/hooks/useIcrSessions';
import { useTrainingSessionLock } from '@/hooks/useTrainingSessionLock';
import { useVAD, type VADConfig } from '@/hooks/useVAD';
import {
  pickRandomChar,
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

function LastTrialDisplay({
  trial,
  currentInput,
  buckets,
}: {
  trial: ICRTrial | undefined;
  currentInput: string;
  buckets: { greenMax: number; yellowMax: number; orangeMax: number };
}): JSX.Element | null {
  if (!trial) return null;
  const lastReactionMs = trial.reactionMs ?? null;
  const isCorrect = typeof trial.correct === 'boolean' ? trial.correct : null;
  return (
    <div className="mt-3 text-sm">
      {trial.durationMs != null && trial.durationMs > 0 && (
        <div className="text-slate-500 text-xs mb-0.5">
          Character {trial.target} played in ~{trial.durationMs} ms (reaction is from end)
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
        {(currentInput || trial.typed) ? (
          <span className={trial.typed
            ? (isCorrect === true ? 'text-emerald-600 font-medium' : isCorrect === false ? 'text-rose-600 font-medium' : 'text-slate-600')
            : 'text-slate-700 font-medium'
          }>
            {currentInput || trial.typed}
          </span>
        ) : (
          '—'
        )}{' '}
        {trial.typed && isCorrect === true && <span className="text-emerald-600">✓</span>}
        {trial.typed && isCorrect === false && <span className="text-rose-600">✗</span>}
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
  const focusTrapRef = useRef<HTMLDivElement | null>(null);

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
    calibrationLatencyMs: icrSettings.calibrationLatencyMs,
  }), [icrSettings.vadEnabled, icrSettings.vadThreshold, icrSettings.vadHoldMs, icrSettings.calibrationLatencyMs]);

  const vad = useVAD(vadConfig, mic.measureInputLevel, audioEndAtRef, currentTrialHeardAtRef);

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
    setIsRunning(true);
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
      requestAnimationFrame(() => {
        try { inputRef.current?.focus(); } catch { /* no-op */ }
      });

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
          const reactionMs = Math.max(0, Math.round(stopAt - base));
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
        requestAnimationFrame(() => { try { inputRef.current?.focus(); } catch { /* no-op */ } });

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
        requestAnimationFrame(() => { try { inputRef.current?.focus(); } catch { /* no-op */ } });
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

  // Start VAD loop when running
  useEffect(() => {
    if (!isRunning) return;
    vad.start();
    return (): void => { vad.stop(); };
  }, [isRunning, vad]);

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

    const activeTrial = trials.find(t => !t.typed);
    if (!activeTrial) return;

    const correct = letter === activeTrial.target.toUpperCase();
    const typedAt = Date.now();
    const base = currentTrialHeardAtRef.current ?? activeTrial.heardAt ?? 0;
    let reactionMs: number = activeTrial.reactionMs ?? 0;
    if (reactionMs === 0 && base > 0) reactionMs = Math.max(0, Math.round(typedAt - base));
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
    requestAnimationFrame(() => { try { inputRef.current?.focus(); } catch { /* no-op */ } });
  }, [trials, icrSettings.bucketOrangeMaxMs]);

  // ── Focus trap during session ────────────────────────────────────────

  const sessionActive = isRunning || countdown !== null;

  useEffect(() => {
    if (!sessionActive) return;
    const trap = focusTrapRef.current;
    const input = inputRef.current;
    if (!trap || !input) return;

    const handleFocusIn = (e: FocusEvent): void => {
      if (trap.contains(e.target as Node)) return;
      requestAnimationFrame(() => { input.focus(); });
    };
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { e.preventDefault(); stopSession(); return; }
      if (e.key === 'Tab' && trap.contains(document.activeElement)) { e.preventDefault(); input.focus(); }
    };

    document.addEventListener('focusin', handleFocusIn, true);
    document.addEventListener('keydown', handleKeyDown, true);
    return (): void => {
      document.removeEventListener('focusin', handleFocusIn, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [sessionActive, stopSession]);

  // ── Stats toggle ─────────────────────────────────────────────────────

  const [showStats, setShowStats] = useState(false);
  if (showStats) return <ICRStats embedded onBack={() => setShowStats(false)} />;

  // ── Render ───────────────────────────────────────────────────────────

  const lastTrial = trials[currentIndex] ?? trials[trials.length - 1];

  return (
    <div className="max-w-6xl mx-auto p-4" ref={focusTrapRef} tabIndex={-1}>
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Instant Character Recognition (ICR)</h1>
          <div className="flex gap-2">
            <button
              className={`px-3 py-2 rounded ${isRunning ? 'bg-gray-300 text-gray-600' : 'bg-emerald-600 text-white'}`}
              onClick={() => { if (!isRunning) { setCurrentIndex(0); currentIndexRef.current = 0; void runSession(); } }}
              disabled={isRunning}
            >Start</button>
            <button className="px-3 py-2 rounded bg-gray-100" onClick={stopSession}>Stop</button>
            <button className="px-3 py-2 rounded bg-blue-600 text-white" onClick={() => setShowStats(true)}>📊 Stats</button>
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
          <p className="text-sm text-slate-600 mb-2">Say the letter as soon as you recognize it, then type it.</p>
          <div className="text-sm text-slate-600">Trial {Math.min(currentIndex + 1, icrSettings.trialsPerSession)} / {icrSettings.trialsPerSession}</div>
          <div className="mt-2 text-xs text-slate-500">Voice above your threshold stops the timer; typing records your answer.</div>
          <div className="mt-3 flex items-center gap-2">
            <input
              className="border rounded px-3 py-2 w-28 text-center text-xl tracking-widest caret-transparent"
              placeholder="?" value={currentInput} maxLength={1}
              aria-label="Type the letter you heard"
              onChange={handleInput}
              onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
              ref={inputRef} disabled={!isRunning}
            />
          </div>
          {!isRunning && trials.length > 0 && (
            <div className="mt-3 text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded">
              Session complete. Press Start to run another session.
            </div>
          )}
          {trials.length > 0 && <LastTrialDisplay trial={lastTrial} currentInput={currentInput} buckets={buckets} />}
        </div>
      </div>

      <div className="p-4 border rounded">
        <h3 className="font-semibold mb-3">Summary</h3>
        <div className="grid grid-cols-2 gap-4 mb-4 max-w-md">
          <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-center">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-0.5">Average Reaction</div>
            <div className={`text-2xl font-bold tabular-nums ${averageReaction ? getReactionTextClass(averageReaction, buckets) : 'text-slate-400'}`}>
              {averageReaction ? `${averageReaction} ms` : '—'}
            </div>
          </div>
          <div className={`rounded-xl border px-4 py-3 text-center ${accuracyPercent >= 80 ? 'bg-emerald-50 border-emerald-200' : accuracyPercent >= 50 ? 'bg-amber-50 border-amber-200' : 'bg-rose-50 border-rose-200'}`}>
            <div className={`text-xs font-medium uppercase tracking-wide mb-0.5 ${accuracyPercent >= 80 ? 'text-emerald-600' : accuracyPercent >= 50 ? 'text-amber-700' : 'text-rose-600'}`}>Accuracy</div>
            <div className={`text-2xl font-bold tabular-nums ${accuracyPercent >= 80 ? 'text-emerald-700' : accuracyPercent >= 50 ? 'text-amber-700' : 'text-rose-700'}`}>{accuracyPercent}%</div>
          </div>
        </div>
        <IcrBucketLegend buckets={buckets} />
        <IcrSessionChart bars={perLetterCharts.bars} dotsCorrectCat={perLetterCharts.dotsCorrectCat} dotsWrongCat={perLetterCharts.dotsWrongCat} icrSettings={icrSettings} />
      </div>
      <IcrTrialList trials={trials} buckets={buckets} />
    </div>
  );
}
