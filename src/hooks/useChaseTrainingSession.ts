'use client';

import { useCallback, useEffect, useRef } from 'react';

import { buildSessionResult } from '@/lib/buildSessionResult';
import {
  advanceKaraokePace,
  applyKaraokeOutcomeToPace,
  computeChaseLevelProgress,
  computeChaseLevelSettings,
  createKaraokePace,
  karaokeCharAudioMs,
  karaokeGapMs,
  karaokeLeadMs,
  karaokeScoreDelta,
  karaokeWindowMs,
  laneToneHz,
  pickNextLane,
  resolveKaraokeKeystroke,
  type KaraokeOutcome,
  type KaraokePace,
} from '@/lib/chase';
import { ensureAppError } from '@/lib/errors';
import { sessionLevelSnapshotFromSettings } from '@/lib/sessionLevelSnapshot';
import {
  type ChaseNoteSnapshot,
  type ChaseRecentLetterSnapshot,
  type ChaseSessionResultSummary,
} from '@/lib/training/chaseSessionMachine';
import { generateTrainingGroup, updateSamplingStateFromAnswer } from '@/lib/trainingSessionGroups';
import type { CharSamplingState } from '@/lib/trainingSessionGroups';
import type { SessionResultInput } from '@/lib/validators';
import { useAppStore } from '@/store';
import type { SessionResult, TrainingSettings } from '@/types';

import type { Toast } from './useToast';
import { useTrainingAudio } from './useTrainingAudio';

export type ChaseNote = ChaseNoteSnapshot;
export type ChaseRecentLetter = ChaseRecentLetterSnapshot;
export type { ChaseSessionResultSummary };

const TICK_MS = 60;
const NOTE_FADE_MS = 1400;
const RECENT_LETTER_CAP = 24;
const MAX_SESSION_LETTERS = 400;
const AUDIO_GAP_PADDING_MS = 160;
const ALLOWED_CHASE_CHAR = /^[A-Z0-9/=?.,+]$/;

export interface UseChaseTrainingSessionOptions {
  readonly settings: TrainingSettings;
  readonly sessions: readonly SessionResult[];
  readonly saveSession: (input: SessionResultInput) => Promise<SessionResult[]>;
  readonly showToast: (t: Toast) => void;
}

export type ChaseHookStatus = 'idle' | 'running' | 'completing' | 'results' | 'failed' | 'paused';

export interface UseChaseTrainingSessionReturn {
  readonly status: ChaseHookStatus;
  readonly isTraining: boolean;
  readonly notes: readonly ChaseNote[];
  readonly recentLetters: readonly ChaseRecentLetter[];
  readonly wpm: number;
  readonly calm: boolean;
  readonly level: number;
  readonly score: number;
  readonly combo: number;
  readonly bestCombo: number;
  readonly correctInLevel: number;
  readonly levelProgress: number;
  readonly lettersHeard: number;
  readonly correctCount: number;
  readonly wrongCount: number;
  readonly missedCount: number;
  readonly sessionIssueMessage?: string;
  readonly lastSessionResult: ChaseSessionResultSummary | null;
  readonly startTraining: () => Promise<void>;
  readonly stopTraining: () => void;
  readonly dismissResults: () => void;
  readonly handleKeystroke: (char: string) => void;
}

interface MutableNote {
  id: number;
  char: string;
  laneIndex: number;
  toneHz: number;
  spawnedAt: number;
  hitAt: number;
  windowEndAt: number;
  status: ChaseNoteSnapshot['status'];
  typedChar?: string;
  resolvedAt?: number;
}

interface ResolvedLetterRecord {
  readonly id: number;
  readonly char: string;
  readonly typed: string;
  readonly outcome: KaraokeOutcome;
  readonly responseMs: number;
}

interface RunStats {
  score: number;
  combo: number;
  bestCombo: number;
  level: number;
  correctInLevel: number;
  lettersHeard: number;
  correctCount: number;
  wrongCount: number;
  missedCount: number;
  peakWpm: number;
}

const toNoteSnapshot = (note: MutableNote): ChaseNoteSnapshot => ({
  id: note.id,
  char: note.char,
  laneIndex: note.laneIndex,
  toneHz: note.toneHz,
  spawnedAt: note.spawnedAt,
  hitAt: note.hitAt,
  windowEndAt: note.windowEndAt,
  status: note.status,
  ...(note.typedChar !== undefined ? { typedChar: note.typedChar } : {}),
  ...(note.resolvedAt !== undefined ? { resolvedAt: note.resolvedAt } : {}),
});

export function useChaseTrainingSession({
  settings,
  sessions,
  saveSession,
  showToast,
}: UseChaseTrainingSessionOptions): UseChaseTrainingSessionReturn {
  const audio = useTrainingAudio(settings);

  const runtime = useAppStore((state) => state.chaseTrainingRuntime);
  const beginRuntimeSession = useAppStore((state) => state.beginChaseTrainingSession);
  const setRuntimeStatus = useAppStore((state) => state.setChaseTrainingStatus);
  const patchRuntime = useAppStore((state) => state.patchChaseTrainingRuntime);
  const completeRuntimeSession = useAppStore((state) => state.completeChaseTrainingSession);
  const cancelRuntimeSession = useAppStore((state) => state.cancelChaseTrainingSession);
  const dismissRuntimeResults = useAppStore((state) => state.dismissChaseTrainingResults);

  const activeRuntime =
    runtime.status !== 'idle' && runtime.status !== 'results' ? runtime : null;
  const status: ChaseHookStatus =
    runtime.status === 'idle'
      ? 'idle'
      : runtime.status === 'results'
        ? 'results'
        : runtime.status === 'starting'
          ? 'running'
          : runtime.status;
  const isTraining = status === 'running' || status === 'completing';
  const sessionIssueMessage =
    runtime.status === 'failed'
      ? runtime.errorMessage
      : runtime.status === 'paused'
        ? runtime.pauseReason
        : undefined;
  const lastSessionResult = runtime.status === 'results' ? runtime.result : null;

  const settingsRef = useRef(settings);
  const sessionsRef = useRef(sessions);
  const saveSessionRef = useRef(saveSession);
  const showToastRef = useRef(showToast);
  const isTrainingRef = useRef(false);
  const stopRequestedRef = useRef(false);
  const startedAtRef = useRef<number | null>(null);
  const notesRef = useRef<MutableNote[]>([]);
  const paceRef = useRef<KaraokePace | null>(null);
  const statsRef = useRef<RunStats | null>(null);
  const recentRef = useRef<ChaseRecentLetterSnapshot[]>([]);
  const resolvedRef = useRef<ResolvedLetterRecord[]>([]);
  const samplingStateRef = useRef<CharSamplingState | null>(null);
  const dirtyRef = useRef(false);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);
  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);
  useEffect(() => {
    saveSessionRef.current = saveSession;
  }, [saveSession]);
  useEffect(() => {
    showToastRef.current = showToast;
  }, [showToast]);

  const pushSnapshot = useCallback((): void => {
    const stats = statsRef.current;
    const pace = paceRef.current;
    if (!stats || !pace) return;
    patchRuntime({
      notes: notesRef.current.map(toNoteSnapshot),
      recentLetters: [...recentRef.current],
      wpm: Math.round(pace.wpm * 10) / 10,
      calm: pace.calmRemaining > 0,
      level: stats.level,
      score: stats.score,
      combo: stats.combo,
      bestCombo: stats.bestCombo,
      correctInLevel: stats.correctInLevel,
      lettersHeard: stats.lettersHeard,
      correctCount: stats.correctCount,
      wrongCount: stats.wrongCount,
      missedCount: stats.missedCount,
    });
    dirtyRef.current = false;
  }, [patchRuntime]);

  const applyNoteOutcome = useCallback(
    (note: MutableNote, outcome: KaraokeOutcome, typedChar: string | undefined, at: number): void => {
      const stats = statsRef.current;
      const pace = paceRef.current;
      if (!stats || !pace || note.status === 'correct' || note.status === 'wrong' || note.status === 'missed') {
        return;
      }
      note.status = outcome;
      note.resolvedAt = at;
      if (typedChar !== undefined) note.typedChar = typedChar;

      if (outcome === 'correct') {
        stats.combo += 1;
        stats.bestCombo = Math.max(stats.bestCombo, stats.combo);
        stats.correctCount += 1;
        stats.score += karaokeScoreDelta(stats.combo, pace.wpm, stats.level);
        stats.correctInLevel += 1;
        const lettersPerLevel = Math.max(1, settingsRef.current.chaseGroupsPerLevel);
        if (stats.correctInLevel >= lettersPerLevel) {
          stats.level += 1;
          stats.correctInLevel = 0;
          if (settingsRef.current.chaseAutoLevelEnabled) {
            showToastRef.current({
              message: `Level ${stats.level} — a new character joins the stream`,
              type: 'success',
            });
          }
        }
      } else {
        stats.combo = 0;
        if (outcome === 'wrong') stats.wrongCount += 1;
        else stats.missedCount += 1;
      }

      paceRef.current = applyKaraokeOutcomeToPace(pace, outcome);

      recentRef.current = [
        ...recentRef.current.slice(-(RECENT_LETTER_CAP - 1)),
        { id: note.id, char: note.char, outcome },
      ];

      if (samplingStateRef.current) {
        samplingStateRef.current = updateSamplingStateFromAnswer(
          samplingStateRef.current,
          note.char,
          typedChar ?? '',
        );
      }

      resolvedRef.current.push({
        id: note.id,
        char: note.char,
        typed: outcome === 'correct' ? note.char : (typedChar ?? ''),
        outcome,
        responseMs: Math.max(0, at - note.hitAt),
      });
      dirtyRef.current = true;
    },
    [],
  );

  const sweepExpiredNotes = useCallback(
    (now: number): void => {
      for (const note of notesRef.current) {
        if (note.status === 'heard' && note.windowEndAt <= now) {
          applyNoteOutcome(note, 'missed', undefined, note.windowEndAt);
        }
      }
    },
    [applyNoteOutcome],
  );

  const pruneNotes = useCallback((now: number): void => {
    const before = notesRef.current.length;
    notesRef.current = notesRef.current.filter((note) => {
      if (note.status === 'incoming' || note.status === 'heard') return true;
      const resolvedAt = note.resolvedAt ?? note.windowEndAt;
      return now - resolvedAt < NOTE_FADE_MS;
    });
    if (notesRef.current.length !== before) dirtyRef.current = true;
  }, []);

  const processResults = useCallback(async (): Promise<void> => {
    const stats = statsRef.current;
    const resolved = [...resolvedRef.current].sort((a, b) => a.id - b.id);
    if (!stats || resolved.length === 0) return;
    const result = buildSessionResult({
      sentGroups: resolved.map((r) => r.char),
      answers: resolved.map((r) => r.typed),
      startedAt: startedAtRef.current ?? Date.now(),
      groupTimings: resolved.map((r) => ({
        timeToCompleteMs: r.responseMs,
        perCharMs: r.responseMs,
      })),
      mode: 'chase',
      levelSnapshot: sessionLevelSnapshotFromSettings(settingsRef.current),
    });
    completeRuntimeSession({
      accuracy: result.accuracy,
      score: stats.score,
      maxLevel: stats.level,
      durationMs: Math.max(0, result.finishedAt - result.startedAt),
      bestCombo: stats.bestCombo,
      lettersTotal: resolved.length,
      correctCount: stats.correctCount,
      wrongCount: stats.wrongCount,
      missedCount: stats.missedCount,
      peakWpm: Math.round(stats.peakWpm * 10) / 10,
      avgResponseMs: result.avgResponseMs,
      letters: resolved.map((r) => ({ char: r.char, typed: r.typed, outcome: r.outcome })),
    });
    await saveSessionRef.current(result as SessionResultInput);
  }, [completeRuntimeSession]);

  const stopTraining = useCallback((): void => {
    stopRequestedRef.current = true;
    audio.trainingAbortRef.current = true;
  }, [audio]);

  useEffect(() => {
    return (): void => {
      audio.trainingAbortRef.current = true;
      isTrainingRef.current = false;
      audio.stopAudio();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startTraining = useCallback(async (): Promise<void> => {
    if (isTrainingRef.current) return;

    audio.stopAudio();
    audio.trainingAbortRef.current = false;
    audio.ensureAudioReady();

    const mySession = audio.sessionIdRef.current + 1;
    audio.sessionIdRef.current = mySession;
    isTrainingRef.current = true;
    stopRequestedRef.current = false;
    startedAtRef.current = Date.now();

    const initialSettings = settingsRef.current;
    const pace = createKaraokePace(
      initialSettings.effectiveWpmMin,
      initialSettings.effectiveWpmMax,
    );
    paceRef.current = pace;
    statsRef.current = {
      score: 0,
      combo: 0,
      bestCombo: 0,
      level: 1,
      correctInLevel: 0,
      lettersHeard: 0,
      correctCount: 0,
      wrongCount: 0,
      missedCount: 0,
      peakWpm: pace.wpm,
    };
    notesRef.current = [];
    recentRef.current = [];
    resolvedRef.current = [];
    samplingStateRef.current = null;
    dirtyRef.current = false;

    cancelRuntimeSession();
    beginRuntimeSession({
      sessionId: mySession,
      startedAt: startedAtRef.current,
      startWpm: Math.round(pace.wpm * 10) / 10,
    });
    setRuntimeStatus('running');

    let nextNoteId = 0;
    let previousLane: number | null = null;
    // Seed so the first note takes a full travel across the timeline.
    let lastPlannedHitAt = Date.now() + karaokeLeadMs(pace.wpm) - karaokeGapMs(pace);
    let lastPlannedChar = '';
    let audioCursor = 0;
    let sessionEndedDueToIssue = false;

    const planAhead = (now: number): void => {
      const currentPace = paceRef.current;
      if (!currentPace) return;
      while (lastPlannedHitAt < now + karaokeLeadMs((paceRef.current ?? currentPace).wpm)) {
        const advanced = advanceKaraokePace(paceRef.current ?? currentPace);
        paceRef.current = advanced;
        const stats = statsRef.current;
        if (stats) stats.peakWpm = Math.max(stats.peakWpm, advanced.wpm);

        const levelSettings = computeChaseLevelSettings(
          settingsRef.current,
          stats?.level ?? 1,
        );
        const generated = generateTrainingGroup(
          { ...levelSettings, minGroupSize: 1, maxGroupSize: 1 },
          sessionsRef.current,
          samplingStateRef.current ?? undefined,
        );
        samplingStateRef.current = generated.state;
        const char = generated.group.slice(0, 1) || 'E';

        // The next letter never starts before the previous one's audio can end.
        const audioFloorMs =
          lastPlannedChar.length > 0
            ? karaokeCharAudioMs(lastPlannedChar, Math.max(1, settingsRef.current.charWpmMin)) +
              AUDIO_GAP_PADDING_MS
            : 0;
        const gapMs = Math.max(karaokeGapMs(advanced), audioFloorMs);
        const hitAt = Math.max(lastPlannedHitAt + gapMs, now + 300);
        const lane = pickNextLane(previousLane);
        previousLane = lane;
        const windowMs = karaokeWindowMs(advanced.wpm);

        notesRef.current.push({
          id: nextNoteId,
          char,
          laneIndex: lane,
          toneHz: laneToneHz(lane),
          spawnedAt: now,
          hitAt,
          windowEndAt: hitAt + windowMs,
          status: 'incoming',
        });
        nextNoteId += 1;
        lastPlannedHitAt = hitAt;
        lastPlannedChar = char;
        dirtyRef.current = true;
      }
    };

    try {
      while (
        isTrainingRef.current &&
        !audio.trainingAbortRef.current &&
        audio.sessionIdRef.current === mySession
      ) {
        const now = Date.now();
        sweepExpiredNotes(now);
        pruneNotes(now);
        planAhead(now);

        const dueNote = notesRef.current.find(
          (note) => note.id >= audioCursor && note.status === 'incoming',
        );
        if (dueNote && dueNote.hitAt <= now + TICK_MS / 2) {
          audioCursor = dueNote.id + 1;
          dueNote.status = 'heard';
          const stats = statsRef.current;
          if (stats) stats.lettersHeard += 1;
          dirtyRef.current = true;
          const playback = await audio.playMorse(dueNote.char, mySession, {
            toneHz: dueNote.toneHz,
          });
          if (playback.status === 'failed' || playback.status === 'suspended') {
            const message =
              playback.status === 'failed'
                ? playback.message
                : 'Audio was suspended by the browser. Start a new run when ready.';
            setRuntimeStatus('failed', { errorMessage: message });
            showToastRef.current({ message, type: 'error' });
            audio.trainingAbortRef.current = true;
            sessionEndedDueToIssue = true;
            break;
          }
        }

        if (dirtyRef.current) pushSnapshot();

        if (resolvedRef.current.length >= MAX_SESSION_LETTERS) {
          stopRequestedRef.current = true;
          break;
        }

        await audio.sleepCancelable(TICK_MS, mySession);
      }

      isTrainingRef.current = false;
      audio.stopAudio();

      if (sessionEndedDueToIssue) {
        return;
      }
      if (stopRequestedRef.current && resolvedRef.current.length > 0) {
        setRuntimeStatus('completing');
        await processResults();
      } else {
        cancelRuntimeSession();
      }
    } catch (error) {
      const appError = ensureAppError(error);
      setRuntimeStatus('failed', { errorMessage: appError.message });
      showToastRef.current({ message: `Chase error: ${appError.message}`, type: 'error' });
    } finally {
      isTrainingRef.current = false;
      audio.stopAudio();
    }
  }, [
    audio,
    beginRuntimeSession,
    cancelRuntimeSession,
    processResults,
    pruneNotes,
    pushSnapshot,
    setRuntimeStatus,
    sweepExpiredNotes,
  ]);

  const handleKeystroke = useCallback(
    (char: string): void => {
      if (!isTrainingRef.current) return;
      const typed = char.toUpperCase();
      if (!ALLOWED_CHASE_CHAR.test(typed)) return;
      const now = Date.now();
      sweepExpiredNotes(now);
      const pending = notesRef.current.filter(
        (note) => note.status === 'heard' && note.windowEndAt > now,
      );
      const resolutions = resolveKaraokeKeystroke(
        pending.map((note) => ({ id: note.id, char: note.char })),
        typed,
      );
      for (const resolution of resolutions) {
        const note = notesRef.current.find((n) => n.id === resolution.id);
        if (!note) continue;
        const typedForNote =
          resolution.outcome === 'correct' || resolution.outcome === 'wrong' ? typed : undefined;
        applyNoteOutcome(note, resolution.outcome, typedForNote, now);
      }
      if (dirtyRef.current) pushSnapshot();
    },
    [applyNoteOutcome, pushSnapshot, sweepExpiredNotes],
  );

  const dismissResults = useCallback((): void => {
    dismissRuntimeResults();
  }, [dismissRuntimeResults]);

  const notes = activeRuntime ? activeRuntime.notes : [];
  const recentLetters = activeRuntime ? activeRuntime.recentLetters : [];
  const wpm = activeRuntime ? activeRuntime.wpm : settings.effectiveWpmMin;
  const calm = activeRuntime ? activeRuntime.calm : false;
  const level = activeRuntime ? activeRuntime.level : 1;
  const score = activeRuntime ? activeRuntime.score : 0;
  const combo = activeRuntime ? activeRuntime.combo : 0;
  const bestCombo = activeRuntime ? activeRuntime.bestCombo : 0;
  const correctInLevel = activeRuntime ? activeRuntime.correctInLevel : 0;
  const lettersHeard = activeRuntime ? activeRuntime.lettersHeard : 0;
  const correctCount = activeRuntime ? activeRuntime.correctCount : 0;
  const wrongCount = activeRuntime ? activeRuntime.wrongCount : 0;
  const missedCount = activeRuntime ? activeRuntime.missedCount : 0;

  return {
    status,
    isTraining,
    notes,
    recentLetters,
    wpm,
    calm,
    level,
    score,
    combo,
    bestCombo,
    correctInLevel,
    levelProgress: computeChaseLevelProgress(
      correctInLevel,
      Math.max(1, settings.chaseGroupsPerLevel),
    ),
    lettersHeard,
    correctCount,
    wrongCount,
    missedCount,
    ...(sessionIssueMessage !== undefined ? { sessionIssueMessage } : {}),
    lastSessionResult,
    startTraining,
    stopTraining,
    dismissResults,
    handleKeystroke,
  };
}
