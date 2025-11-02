'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Scatter,
  Line,
  ScatterChart,
  Legend,
  Cell,
} from 'recharts';

import { useIcrSessionsActions } from '@/hooks/useIcrSessions';
import { ICR_INPUT_POLLING_INTERVAL_MS, ICR_POLLING_INTERVAL_MS } from '@/lib/constants';
import { ensureContext, playMorseCode as externalPlayMorseCode } from '@/lib/morseAudio';
import { KOCH_SEQUENCE } from '@/lib/morseConstants';
import { computeCharPool } from '@/lib/trainingUtils';
import { formatSession } from '@/lib/utils/icrSessionFormatter';
import type { IcrSettings } from '@/types';

type ICRTrial = {
  target: string;
  heardAt: number; // ms since epoch at end of audio playback (reaction baseline)
  stopAt?: number; // ms since epoch when voice or key stopped timer
  reactionMs?: number; // computed stopAt - heardAt
  typed?: string; // user typed letter for scoring
  correct?: boolean;
};

// ICR settings come from parent (CWTrainer)

const pickRandomChar = (opts: {
  kochLevel: number;
  charSetMode?: 'koch' | 'digits' | 'custom';
  digitsLevel?: number;
  customSet?: string[];
}): string => {
  const pool = computeCharPool({
    kochLevel: opts.kochLevel,
    charSetMode: opts.charSetMode ?? 'koch',
    digitsLevel: opts.digitsLevel,
    customSet: opts.customSet,
  });
  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx];
};

type LetterChartPayload = {
  letter?: string;
  acc?: number;
};

type LetterBarPoint = {
  readonly letter: string;
  readonly index: number;
  readonly adjAvg: number;
  readonly avg: number;
  readonly acc: number;
  readonly total: number;
};

type ReactionScatterPoint = {
  readonly letter: string;
  readonly reaction: number;
};

const isLetterPayloadArray = (value: unknown): value is Array<{ payload?: LetterChartPayload }> =>
  Array.isArray(value);

const formatLetterTooltipLabel = (label: string | number, payload: unknown): string => {
  if (isLetterPayloadArray(payload)) {
    const entry = payload[0]?.payload;
    if (entry?.letter) {
      const accPct = Math.round((entry.acc ?? 0) * 100);
      return `${entry.letter} • acc ${accPct}%`;
    }
  }
  return typeof label === 'string' ? label : String(label);
};

interface ICRTrainerProps {
  sharedAudio: {
    kochLevel: number;
    charSetMode?: 'koch' | 'digits' | 'custom';
    digitsLevel?: number;
    customSet?: string[];
    charWpm: number;
    effectiveWpm?: number;
    sideToneMin: number;
    sideToneMax: number;
    steepness: number;
    envelopeSmoothing?: number;
  };
  icrSettings: IcrSettings;
}

export function ICRTrainer({ sharedAudio, icrSettings }: ICRTrainerProps): JSX.Element {
  const [isRunning, setIsRunning] = useState(false);
  const { saveIcrSession } = useIcrSessionsActions();
  const [trials, setTrials] = useState<ICRTrial[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentInput, setCurrentInput] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const stopRef = useRef<boolean>(false);
  const sessionActiveRef = useRef<boolean>(false);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const vadActiveRef = useRef<boolean>(false);
  const vadArmedRef = useRef<boolean>(false);
  const vadStartTimeRef = useRef<number | null>(null);
  const trialsRef = useRef<ICRTrial[]>([]);
  const audioEndAtRef = useRef<number | null>(null);
  const stopSourceRef = useRef<'voice' | 'key' | null>(null);
  const sessionTokenRef = useRef(0);
  const lastPersistedTokenRef = useRef<number | null>(null);

  // Focus input when entering the panel and after mount
  useEffect(() => {
    try {
      inputRef.current?.focus();
    } catch {}
  }, []);

  const getBarFill = (ms: number): string => {
    if (ms === undefined || ms === null) return '#60a5fa';
    const greenMax = icrSettings.bucketGreenMaxMs ?? 300;
    const yellowMax = icrSettings.bucketYellowMaxMs ?? 800;
    if (ms <= greenMax) return '#10b981';
    if (ms <= yellowMax) return '#f59e0b';
    return '#ef4444';
  };

  const setupAudioContext = useCallback(async (): Promise<AudioContext> => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    await ensureContext(audioContextRef.current);
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

  const measureInputLevel = useCallback((): number => {
    const analyser = analyserRef.current;
    if (!analyser) return 0;
    const buffer = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(buffer);
    // Compute normalized peak deviation around midline (128)
    let peak = 0;
    for (let i = 0; i < buffer.length; i++) {
      const v = Math.abs(buffer[i] - 128) / 128; // 0..1
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
            // Trigger stop
            stopSourceRef.current = 'voice';
            stopRef.current = true;
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
  }, [icrSettings.vadEnabled, icrSettings.vadThreshold, icrSettings.vadHoldMs, measureInputLevel]);

  const pickToneHz = useCallback((): number => {
    const min = Math.max(100, sharedAudio.sideToneMin);
    const max = Math.max(min, sharedAudio.sideToneMax);
    if (min === max) return min;
    return Math.floor(min + Math.random() * (max - min + 1));
  }, [sharedAudio.sideToneMin, sharedAudio.sideToneMax]);

  const playChar = useCallback(
    async (ch: string): Promise<number | undefined> => {
      const ctx = await setupAudioContext();
      stopRef.current = false;
      const durationSec = await externalPlayMorseCode(
        ctx,
        ch,
        {
          charWpm: Math.max(1, sharedAudio.charWpm),
          effectiveWpm: Math.max(1, sharedAudio.effectiveWpm ?? sharedAudio.charWpm),
          sideTone: pickToneHz(),
          steepness: sharedAudio.steepness,
          envelopeSmoothing: sharedAudio.envelopeSmoothing ?? 0,
        },
        () => stopRef.current,
      );
      return durationSec;
    },
    [
      sharedAudio.charWpm,
      sharedAudio.effectiveWpm,
      sharedAudio.envelopeSmoothing,
      sharedAudio.steepness,
      pickToneHz,
      setupAudioContext,
    ],
  );

  const runSession = useCallback(async (): Promise<void> => {
    if (isRunning) return;
    sessionTokenRef.current += 1;
    setTrials([]);
    setCurrentIndex(0);
    setIsRunning(true);
    sessionActiveRef.current = true;
    try {
      await setupAudioContext();
      if (icrSettings.vadEnabled) {
        await setupMic(icrSettings.micDeviceId);
      }
      for (let i = 0; i < icrSettings.trialsPerSession; i++) {
        if (!sessionActiveRef.current) break;
        const target = pickRandomChar({
          kochLevel: sharedAudio.kochLevel,
          charSetMode: sharedAudio.charSetMode,
          digitsLevel: sharedAudio.digitsLevel,
          customSet: sharedAudio.customSet,
        });
        // Reset per-trial gates
        stopRef.current = false;
        stopSourceRef.current = null;
        vadArmedRef.current = false;
        audioEndAtRef.current = null;
        // Add trial placeholder; will set heardAt to audio end timestamp
        setTrials((prev) => [...prev, { target, heardAt: 0 }]);
        setCurrentIndex(i);
        // Schedule audio and compute when it will end
        const playStartAt = Date.now();
        const durationSec = await playChar(target);
        const audioEndAt = playStartAt + Math.max(0, Math.round((durationSec ?? 0) * 1000));
        audioEndAtRef.current = audioEndAt;
        // Record heardAt as end-of-playback time for reaction baseline
        setTrials((prev) => {
          const copy = prev.slice();
          copy[i] = { ...copy[i], heardAt: audioEndAt };
          return copy;
        });
        // Wait until audio has actually finished (approximate via wall clock)
        const waitMs = Math.max(0, audioEndAt - Date.now());
        if (waitMs > 0) {
          await new Promise((r) => setTimeout(r, waitMs));
        }
        // Arm VAD immediately after playback
        if (icrSettings.vadEnabled) {
          vadArmedRef.current = true;
        }
        const trialIndex = i;
        // Wait for stop event (VAD or key) or until user has typed
        while (sessionActiveRef.current) {
          if (stopRef.current) {
            const stopAt = Date.now();
            const base = trialsRef.current[trialIndex]?.heardAt || audioEndAt;
            const reactionMs = Math.max(0, Math.round(stopAt - base));
            setTrials((prev) => {
              const copy = prev.slice();
              copy[trialIndex] = { ...copy[trialIndex], stopAt, reactionMs };
              return copy;
            });
            stopRef.current = false;
            // Focus input for answer entry
            try {
              inputRef.current?.focus();
            } catch {}
            break;
          }
          // If user already typed, move on without a reaction time
          if (trialsRef.current[trialIndex]?.typed) {
            try {
              inputRef.current?.focus();
            } catch {}
            break;
          }
          await new Promise((r) => setTimeout(r, ICR_POLLING_INTERVAL_MS));
        }
        // Wait until user types and confirms input for this trial
        while (sessionActiveRef.current && !trialsRef.current[trialIndex]?.typed) {
          await new Promise((r) => setTimeout(r, ICR_INPUT_POLLING_INTERVAL_MS));
        }
        if (!sessionActiveRef.current) break;
        // Delay before next trial
        await new Promise((resolve) => setTimeout(resolve, Math.max(0, icrSettings.trialDelayMs)));
        setCurrentIndex(i + 1);
      }
    } finally {
      setIsRunning(false);
      vadActiveRef.current = false;
      vadArmedRef.current = false;
      sessionActiveRef.current = false;
      stopMic();
    }
  }, [isRunning, icrSettings, sharedAudio, setupAudioContext, setupMic, playChar, stopMic]);

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

  useEffect(() => {
    const onKeyDown = (_event: KeyboardEvent): void => {
      if (!isRunning) return;
      // Key stops only after audio end
      const audioEndAt = audioEndAtRef.current || 0;
      if (Date.now() < audioEndAt) return;
      if (!stopRef.current) {
        stopSourceRef.current = 'key';
        stopRef.current = true;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return (): void => window.removeEventListener('keydown', onKeyDown);
  }, [isRunning]);

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
      (a, b) => KOCH_SEQUENCE.indexOf(a) - KOCH_SEQUENCE.indexOf(b),
    );
    // compute averages
    letters.forEach((l) => {
      const s = agg[l].samples.map((s) => s.reaction);
      const base = s.length ? s.reduce((a, b) => a + b, 0) / s.length : 0;
      const acc = agg[l].total > 0 ? agg[l].correct / agg[l].total : 0;
      const adjusted = base * (1 + penaltyFactor * (1 - acc));
      agg[l].avg = base;
      agg[l].acc = acc;
      agg[l].adjAvg = adjusted;
    });
    // bars data
    const bars: LetterBarPoint[] = letters.map((l, i) => ({
      letter: l,
      index: i,
      adjAvg: Math.round(agg[l].adjAvg),
      avg: Math.round(agg[l].avg),
      acc: agg[l].acc,
      total: agg[l].total,
    }));
    // category-aligned dots for simplicity/robustness
    const dotsCorrectCat: ReactionScatterPoint[] = [];
    const dotsWrongCat: ReactionScatterPoint[] = [];
    letters.forEach((l) => {
      const samples = agg[l].samples;
      for (let j = 0; j < samples.length; j++) {
        const targetArr = samples[j].correct ? dotsCorrectCat : dotsWrongCat;
        targetArr.push({ letter: l, reaction: samples[j].reaction });
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

  return (
    <div className="max-w-3xl mx-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Instant Character Recognition (ICR)</h1>
        <div className="flex gap-2">
          <button
            className={`px-3 py-2 rounded ${isRunning ? 'bg-gray-300 text-gray-600' : 'bg-emerald-600 text-white'}`}
            onClick={() => {
              if (!isRunning) {
                setTrials([]);
                setCurrentIndex(0);
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
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 mb-4">
        <div className="p-6 border rounded flex flex-col items-center justify-center min-h-[220px]">
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
              className="border rounded px-3 py-2 w-28 text-center text-xl tracking-widest"
              placeholder="_"
              value={currentInput}
              maxLength={1}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                const v = (event.target.value || '').toUpperCase();
                const letter = v.slice(-1);
                setCurrentInput(letter);
                if (letter) {
                  // auto-confirm
                  const idx = trials.length - 1;
                  if (idx >= 0 && trials[idx]) {
                    const correct = letter === trials[idx].target.toUpperCase();
                    setTrials((prev) => {
                      const copy = prev.slice();
                      copy[idx] = { ...copy[idx], typed: letter, correct };
                      return copy;
                    });
                    // clear field and keep focus for next trial
                    setCurrentInput('');
                    try {
                      inputRef.current?.focus();
                    } catch {}
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
          {trials.length > 0 && (
            <div className="mt-3 text-sm">
              <div>
                Last Reaction:{' '}
                {trials[currentIndex]?.reactionMs ?? trials[trials.length - 1]?.reactionMs ?? '—'}{' '}
                ms
              </div>
              <div>
                Answer: {trials[currentIndex]?.typed ?? '—'}{' '}
                {typeof trials[currentIndex]?.correct === 'boolean'
                  ? trials[currentIndex]?.correct
                    ? '✓'
                    : '✗'
                  : ''}
              </div>
            </div>
          )}
        </div>

        {/* Mic & VAD controls moved to Sidebar */}
      </div>
      {/* Session audio settings removed; using global sidebar settings */}

      <div className="p-4 border rounded">
        <h3 className="font-semibold mb-2">Summary</h3>
        <div className="text-sm">Average Reaction: {averageReaction || '—'} ms</div>
        <div className="text-sm">Accuracy: {accuracyPercent}%</div>
        <div className="mt-3">
          <div className="h-96 w-full">
            <ResponsiveContainer>
              <ComposedChart
                data={perLetterCharts.bars}
                margin={{ top: 10, right: 20, bottom: 10, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="letter"
                  xAxisId={0}
                  type="category"
                  allowDuplicatedCategory={false}
                />
                <YAxis yAxisId={0} label={{ value: 'ms', angle: -90, position: 'insideLeft' }} />
                <Tooltip labelFormatter={formatLetterTooltipLabel} />
                <Legend />
                <Bar yAxisId={0} xAxisId={0} dataKey="adjAvg" name="Weighted Avg (ms)">
                  {perLetterCharts.bars.map((entry, idx) => (
                    <Cell key={`cell-${idx}`} fill={getBarFill(entry.adjAvg)} />
                  ))}
                </Bar>
                <Line
                  yAxisId={0}
                  xAxisId={0}
                  dataKey="avg"
                  name="Unweighted Avg (ms)"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 2, fill: '#3b82f6' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="h-72 w-full mt-4">
            <ResponsiveContainer>
              <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="letter" type="category" allowDuplicatedCategory={false} />
                <YAxis
                  dataKey="reaction"
                  type="number"
                  name="Reaction (ms)"
                  label={{ value: 'ms', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip />
                <Legend />
                <Scatter name="Correct" data={perLetterCharts.dotsCorrectCat} fill="#3b82f6" />
                <Scatter name="Wrong" data={perLetterCharts.dotsWrongCat} fill="#ef4444" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="mt-3 max-h-60 overflow-y-auto text-sm">
          {trials.map((t, i) => (
            <div key={i} className="flex gap-3 py-1 border-b">
              <div className="w-10">{t.target}</div>
              <div className="w-24">{t.reactionMs ? `${t.reactionMs} ms` : '—'}</div>
              <div className="w-24">{t.typed ?? '—'}</div>
              <div className="w-10">
                {typeof t.correct === 'boolean' ? (t.correct ? '✓' : '✗') : ''}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
