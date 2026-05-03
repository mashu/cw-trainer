'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { buildSessionResult } from '@/lib/buildSessionResult';
import { AUTO_CONFIRM_DELAY_MS } from '@/lib/constants';
import { ensureAppError } from '@/lib/errors';
import { evaluateAutoLevelAdjust } from '@/lib/kochAutoAdjust';
import type { AutoAdjustMode } from '@/lib/kochAutoAdjust';
import { generateTrainingGroup } from '@/lib/trainingSessionGroups';
import { computeTrainingGroupGapMs } from '@/lib/trainingSessionPlayback';
import type { SessionResultInput } from '@/lib/validators';
import type { SessionResult, TrainingSettings } from '@/types';

import type { Toast } from './useToast';
import { useTrainingAudio } from './useTrainingAudio';
import { useTrainingSessionLock } from './useTrainingSessionLock';

// ── Public types ───────────────────────────────────────────────────────

/** Summarised result shown in the results screen. */
export interface SessionResultSummary {
  readonly accuracy: number;
  readonly groups: ReadonlyArray<{
    sent: string;
    received: string;
    correct: boolean;
  }>;
  readonly avgResponseMs: number;
  readonly score: number;
}

export interface UseTrainingSessionOptions {
  readonly settings: TrainingSettings;
  readonly sessions: readonly SessionResult[];
  readonly saveSession: (input: SessionResultInput) => Promise<SessionResult[]>;
  readonly setTrainingSettingsState: (
    next: TrainingSettings | ((prev: TrainingSettings) => TrainingSettings),
  ) => void;
  readonly showToast: (t: Toast) => void;
}

export interface UseTrainingSessionReturn {
  readonly isTraining: boolean;
  /** True while playback stopped but results UI / persistence are still being prepared — avoids a routing flash to home. */
  readonly isCompletingSession: boolean;
  readonly currentGroup: number;
  readonly sentGroups: string[];
  readonly userInput: string[];
  readonly confirmedGroups: Record<number, boolean>;
  readonly currentFocusedGroup: number;
  readonly showResults: boolean;
  readonly lastSessionResult: SessionResultSummary | null;
  readonly startTraining: () => Promise<void>;
  readonly submitAnswer: () => void;
  readonly stopTraining: () => void;
  readonly confirmGroupAnswer: (index: number, overrideValue?: string) => void;
  readonly handleAnswerChange: (index: number, value: string) => void;
  readonly setCurrentFocusedGroup: React.Dispatch<React.SetStateAction<number>>;
  readonly dismissResults: () => void;
  readonly inputRefs: React.MutableRefObject<Array<HTMLInputElement | null>>;
  readonly inputRefCallback: (idx: number, el: HTMLInputElement | null) => void;
}

// ── Hook ───────────────────────────────────────────────────────────────

export function useTrainingSession({
  settings,
  sessions: historicalSessions,
  saveSession,
  setTrainingSettingsState,
  showToast,
}: UseTrainingSessionOptions): UseTrainingSessionReturn {
  type TimeoutId = number;

  const { takeLock: takeSessionLock, releaseLock: dropSessionLock } = useTrainingSessionLock();

  // ── Shared audio engine ──────────────────────────────────────────────
  const audio = useTrainingAudio(settings);

  // ── React state ──────────────────────────────────────────────────────
  const [isTraining, setIsTraining] = useState(false);
  const [currentGroup, setCurrentGroup] = useState(0);
  const [sentGroups, setSentGroups] = useState<string[]>([]);
  const [userInput, setUserInput] = useState<string[]>([]);
  const [confirmedGroups, setConfirmedGroups] = useState<Record<number, boolean>>({});
  const [currentFocusedGroup, setCurrentFocusedGroup] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [lastSessionResult, setLastSessionResult] = useState<SessionResultSummary | null>(null);
  const [isCompletingSession, setIsCompletingSession] = useState(false);

  // ── Refs ─────────────────────────────────────────────────────────────
  const isTrainingRef = useRef(false);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const startedAtRef = useRef<number | null>(null);
  const userInputRef = useRef<string[]>([]);
  const confirmedGroupsRef = useRef<Record<number, boolean>>({});
  const resultsProcessedRef = useRef(false);
  const activeSentGroupsRef = useRef<string[]>([]);

  // Refs for values read by processResults to prevent stale closures
  // (processResults runs after long async session; these may change mid-session)
  const settingsRef = useRef(settings);
  const saveSessionRef = useRef(saveSession);
  const showToastRef = useRef(showToast);
  const setTrainingSettingsStateRef = useRef(setTrainingSettingsState);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);
  useEffect(() => {
    saveSessionRef.current = saveSession;
  }, [saveSession]);
  useEffect(() => {
    showToastRef.current = showToast;
  }, [showToast]);
  useEffect(() => {
    setTrainingSettingsStateRef.current = setTrainingSettingsState;
  }, [setTrainingSettingsState]);
  const groupStartAtRef = useRef<number[]>([]);
  const groupEndAtRef = useRef<number[]>([]);
  const groupAnswerAtRef = useRef<number[]>([]);
  const groupCompletionResolversRef = useRef<
    Record<number, ((result: { timedOut: boolean }) => void) | null>
  >({});
  const confirmTimeoutRef = useRef<Record<number, TimeoutId | undefined>>({});

  // ── Unmount cleanup ──────────────────────────────────────────────────
  useEffect(() => {
    return (): void => {
      if (isTrainingRef.current) {
        audio.trainingAbortRef.current = true;
        isTrainingRef.current = false;
      }
      Object.values(confirmTimeoutRef.current).forEach((id) => {
        if (id !== undefined) {
          try {
            window.clearTimeout(id);
          } catch {
            /* no-op */
          }
        }
      });
      confirmTimeoutRef.current = {};
      groupCompletionResolversRef.current = {};
      audio.stopAudio();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the focused group centered
  useEffect(() => {
    const target = inputRefs.current[currentFocusedGroup];
    if (target) {
      try {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch {
        /* no-op */
      }
    }
  }, [currentFocusedGroup]);

  // Enter key to restart training from the results screen
  useEffect(() => {
    if (!showResults || isTraining || !lastSessionResult) return;
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          setShowResults(false);
          setLastSessionResult(null);
          void startTraining();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return (): void => {
      window.removeEventListener('keydown', handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showResults, isTraining, lastSessionResult]);

  // ── Results processing ───────────────────────────────────────────────

  const processResults = async (answers: string[], sentOverride?: string[]): Promise<void> => {
    if (resultsProcessedRef.current) return;
    resultsProcessedRef.current = true;

    // Read from refs to avoid stale closures (session runs across many awaits)
    const currentSettings = settingsRef.current;
    const currentSaveSession = saveSessionRef.current;
    const currentShowToast = showToastRef.current;
    const currentSetTrainingSettingsState = setTrainingSettingsStateRef.current;

    const sentSource =
      Array.isArray(sentOverride) && sentOverride.length
        ? sentOverride
        : activeSentGroupsRef.current?.length
          ? activeSentGroupsRef.current
          : sentGroups;
    if (!Array.isArray(sentSource) || sentSource.length === 0) {
      resultsProcessedRef.current = false;
      return;
    }

    const groupTimings = sentSource.map((_sent, idx) => {
      const endAt = groupEndAtRef.current[idx] || 0;
      const rawAnsAt = groupAnswerAtRef.current[idx] || 0;
      const timeoutMs = Math.max(0, currentSettings.groupTimeout || 0) * 1000;
      const fallbackAnsAt = endAt > 0 && timeoutMs > 0 ? endAt + timeoutMs : 0;
      const ansAt = rawAnsAt > 0 ? rawAnsAt : fallbackAnsAt;
      const delta = Math.max(0, ansAt - endAt);
      const sent = sentSource[idx] ?? '';
      const perChar = sent.length > 0 ? Math.round(delta / sent.length) : 0;
      return { timeToCompleteMs: Number.isFinite(delta) ? delta : 0, perCharMs: perChar };
    });

    const result = buildSessionResult({
      sentGroups: sentSource,
      answers,
      startedAt: startedAtRef.current || Date.now(),
      groupTimings,
    });

    setLastSessionResult({
      accuracy: result.accuracy,
      groups: result.groups.map((g, i) => ({
        sent: g.sent,
        received: answers[i] || '',
        correct: g.sent === answers[i],
      })),
      avgResponseMs: result.avgResponseMs,
      score: result.score,
    });
    setShowResults(true);

    try {
      await currentSaveSession(result as SessionResultInput);
    } catch (error) {
      currentShowToast({ message: ensureAppError(error).message, type: 'error' });
    }

    // Auto-adjust level
    try {
      const charSetMode = currentSettings.charSetMode ?? 'koch';
      const mode: AutoAdjustMode =
        charSetMode === 'digits' ? 'digits' : charSetMode === 'mixed' ? 'mixed' : 'koch';
      const currentLevel =
        mode === 'digits' ? (currentSettings.digitsLevel ?? 10) : currentSettings.kochLevel;
      const maxLevel = mode === 'digits' ? 10 : 40;
      const adjustment = evaluateAutoLevelAdjust(result.accuracy, {
        enabled: currentSettings.autoAdjustKoch,
        mode,
        threshold: currentSettings.autoAdjustThreshold ?? 90,
        aboveThresholdCount: Math.max(0, currentSettings.autoAdjustAboveThresholdCount ?? 0),
        belowThresholdCount: Math.max(0, currentSettings.autoAdjustBelowThresholdCount ?? 0),
        currentLevel,
        maxLevel,
      });
      if (adjustment) {
        const field = mode === 'digits' ? 'digitsLevel' : 'kochLevel';
        currentSetTrainingSettingsState((prev) => ({ ...prev, [field]: adjustment.nextLevel }));
        currentShowToast({ message: adjustment.message, type: adjustment.messageType });
      }
    } catch (autoAdjustError) {
      console.warn('[Training] Auto-adjust error:', autoAdjustError);
    }
  };

  // ── Public actions ───────────────────────────────────────────────────

  const startTraining = async (): Promise<void> => {
    if (isTrainingRef.current) return;

    try {
      audio.stopAudio();
      audio.trainingAbortRef.current = false;
      resultsProcessedRef.current = false;
      activeSentGroupsRef.current = [];
      setIsCompletingSession(false);

      Object.values(confirmTimeoutRef.current).forEach((id) => {
        if (id !== undefined) {
          try {
            window.clearTimeout(id);
          } catch {
            /* no-op */
          }
        }
      });
      confirmTimeoutRef.current = {};
      groupCompletionResolversRef.current = {};

      audio.ensureAudioReady();

      const mySession = audio.sessionIdRef.current + 1;
      audio.sessionIdRef.current = mySession;
      setIsTraining(true);
      isTrainingRef.current = true;
      takeSessionLock();
      setShowResults(false);
      setLastSessionResult(null);
      setCurrentGroup(0);
      setSentGroups([]);
      setUserInput([]);
      setConfirmedGroups({});
      setCurrentFocusedGroup(0);
      startedAtRef.current = Date.now();
      userInputRef.current = [];
      confirmedGroupsRef.current = {};
      groupStartAtRef.current = [];
      groupEndAtRef.current = [];
      groupAnswerAtRef.current = [];

      const groups: string[] = [];
      for (let i = 0; i < settings.numGroups; i++) {
        groups.push(generateTrainingGroup(settings, historicalSessions));
      }
      setSentGroups(groups);
      activeSentGroupsRef.current = groups;

      for (let i = 0; i < groups.length; i++) {
        if (audio.trainingAbortRef.current || audio.sessionIdRef.current !== mySession) break;
        setCurrentGroup(i);
        setCurrentFocusedGroup(i);
        requestAnimationFrame(() => {
          const el = inputRefs.current[i];
          if (el) {
            try {
              el.focus();
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } catch {
              /* no-op */
            }
          }
        });
        const delayMs = Math.max(0, computeTrainingGroupGapMs(settings));
        if (delayMs > 0) await audio.sleepCancelable(delayMs, mySession);
        const startTs = Date.now();
        groupStartAtRef.current[i] = startTs;
        const group = groups[i];
        if (!group) continue;
        const duration = await audio.playMorse(group, mySession);
        groupEndAtRef.current[i] = startTs + Math.max(0, Math.round((duration || 0) * 1000));
        if (audio.trainingAbortRef.current || audio.sessionIdRef.current !== mySession) break;

        const { timedOut } = await waitForGroupCompletion(i);
        if (timedOut && !confirmedGroupsRef.current[i]) {
          autoConfirmOnTimeout(i, groups);
        }
        try {
          audio.stopAudio();
        } catch {
          /* no-op */
        }
      }
      const shouldProcessResults =
        !(audio.trainingAbortRef.current || audio.sessionIdRef.current !== mySession) &&
        !resultsProcessedRef.current;
      if (shouldProcessResults) {
        setIsCompletingSession(true);
      }
      setIsTraining(false);
      isTrainingRef.current = false;
      audio.stopAudio();
      if (shouldProcessResults) {
        const answers = (userInputRef.current.length > 0 ? userInputRef.current : userInput).map(
          (a) => (a || '').trim().toUpperCase(),
        );
        try {
          await processResults(answers, groups);
        } catch (error) {
          console.error('[Training] Error processing results:', error);
          showToast({
            message: `Failed to process results: ${ensureAppError(error).message}`,
            type: 'error',
          });
        } finally {
          dropSessionLock();
          setIsCompletingSession(false);
        }
      } else {
        dropSessionLock();
      }
    } catch (error) {
      console.error('[Training] Unexpected training error:', error);
      showToast({ message: `Training error: ${ensureAppError(error).message}`, type: 'error' });
      setIsTraining(false);
      isTrainingRef.current = false;
      dropSessionLock();
      audio.trainingAbortRef.current = true;
      audio.stopAudio();
    }
  };

  const submitAnswer = (): void => {
    audio.trainingAbortRef.current = true;
    setIsCompletingSession(true);
    setIsTraining(false);
    isTrainingRef.current = false;
    audio.stopAudio();
    const answers = (userInputRef.current.length > 0 ? userInputRef.current : userInput).map((a) =>
      (a || '').trim().toUpperCase(),
    );
    void processResults(answers, activeSentGroupsRef.current)
      .catch((error) => {
        console.error('[Training] Error processing results:', error);
        showToast({
          message: `Failed to process results: ${ensureAppError(error).message}`,
          type: 'error',
        });
      })
      .finally(() => {
        dropSessionLock();
        setIsCompletingSession(false);
      });
  };

  const stopTraining = (): void => {
    audio.trainingAbortRef.current = true;
    setIsTraining(false);
    isTrainingRef.current = false;
    dropSessionLock();
    audio.stopAudio();
  };

  const confirmGroupAnswer = (index: number, overrideValue?: string): void => {
    if (!sentGroups.length) return;
    const normalized = (overrideValue ?? userInput[index] ?? '').trim().toUpperCase();
    const nextAnswers = [...userInput];
    nextAnswers[index] = normalized;
    setUserInput(nextAnswers);
    userInputRef.current = nextAnswers;
    const nextConfirmed = { ...confirmedGroupsRef.current, [index]: true };
    setConfirmedGroups(nextConfirmed);
    confirmedGroupsRef.current = nextConfirmed;
    if (!groupAnswerAtRef.current[index]) groupAnswerAtRef.current[index] = Date.now();

    const resolver = groupCompletionResolversRef.current[index];
    if (resolver) {
      resolver({ timedOut: false });
      delete groupCompletionResolversRef.current[index];
    }

    const nextIndex = index + 1;
    if (nextIndex < sentGroups.length) {
      setCurrentGroup(nextIndex);
      setCurrentFocusedGroup(nextIndex);
      focusInput(nextIndex);
    }

    const allAnswered =
      nextAnswers.length === sentGroups.length &&
      nextAnswers.every((a, i) => {
        const sg = sentGroups[i];
        return a && sg && a.length === sg.length;
      });
    if (allAnswered) submitAnswer();
  };

  const handleAnswerChange = (index: number, value: string): void => {
    const nextAnswers = [...userInput];
    nextAnswers[index] = value;
    setUserInput(nextAnswers);
    userInputRef.current = nextAnswers;

    if (
      value.length === sentGroups[index]?.length &&
      value.length > 0 &&
      !groupAnswerAtRef.current[index]
    ) {
      groupAnswerAtRef.current[index] = Date.now();
    }

    if (confirmTimeoutRef.current[index] !== undefined) {
      try {
        window.clearTimeout(confirmTimeoutRef.current[index]!);
      } catch {
        /* no-op */
      }
      delete confirmTimeoutRef.current[index];
    }

    if (value.length === sentGroups[index]?.length && value.length > 0 && index <= currentGroup) {
      confirmTimeoutRef.current[index] = window.setTimeout(() => {
        confirmGroupAnswer(index, value);
        delete confirmTimeoutRef.current[index];
      }, AUTO_CONFIRM_DELAY_MS) as TimeoutId;
    }
  };

  const dismissResults = (): void => {
    setShowResults(false);
    setLastSessionResult(null);
  };

  const inputRefCallback = useCallback((idx: number, el: HTMLInputElement | null) => {
    inputRefs.current[idx] = el;
  }, []);

  // ── Internal helpers ─────────────────────────────────────────────────

  function waitForGroupCompletion(i: number): Promise<{ timedOut: boolean }> {
    return new Promise((resolve) => {
      if (confirmedGroupsRef.current[i]) {
        resolve({ timedOut: false });
        return;
      }
      let resolver: ((r: { timedOut: boolean }) => void) | null = null;
      let timeoutId: TimeoutId | undefined;
      if (settings.groupTimeout && settings.groupTimeout > 0) {
        timeoutId = window.setTimeout(() => {
          if (!groupAnswerAtRef.current[i]) groupAnswerAtRef.current[i] = Date.now();
          if (resolver) resolver({ timedOut: true });
          delete groupCompletionResolversRef.current[i];
        }, settings.groupTimeout * 1000) as TimeoutId;
      }
      resolver = (result): void => {
        if (timeoutId !== undefined) {
          try {
            window.clearTimeout(timeoutId);
          } catch {
            /* no-op */
          }
        }
        resolve(result);
        delete groupCompletionResolversRef.current[i];
      };
      groupCompletionResolversRef.current[i] = resolver;
    });
  }

  function autoConfirmOnTimeout(i: number, groups: string[]): void {
    if (confirmTimeoutRef.current[i] !== undefined) {
      try {
        window.clearTimeout(confirmTimeoutRef.current[i]!);
      } catch {
        /* no-op */
      }
      delete confirmTimeoutRef.current[i];
    }
    const currentValue = (userInputRef.current[i] || '').trim().toUpperCase();
    const nextAnswers = [...userInputRef.current];
    nextAnswers[i] = currentValue;
    setUserInput(nextAnswers);
    userInputRef.current = nextAnswers;
    const nextConfirmed = { ...confirmedGroupsRef.current, [i]: true };
    setConfirmedGroups(nextConfirmed);
    confirmedGroupsRef.current = nextConfirmed;
    const nextIndex = i + 1;
    if (nextIndex < groups.length) {
      setCurrentFocusedGroup(nextIndex);
      focusInput(nextIndex);
    }
  }

  function focusInput(index: number): void {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = inputRefs.current[index];
        if (!el) return;
        try {
          const wasDisabled = el.disabled;
          if (wasDisabled) el.disabled = false;
          el.focus();
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          if (wasDisabled) el.disabled = wasDisabled;
        } catch {
          /* no-op */
        }
      });
    });
  }

  return {
    isTraining,
    isCompletingSession,
    currentGroup,
    sentGroups,
    userInput,
    confirmedGroups,
    currentFocusedGroup,
    showResults,
    lastSessionResult,
    startTraining,
    submitAnswer,
    stopTraining,
    confirmGroupAnswer,
    handleAnswerChange,
    setCurrentFocusedGroup,
    dismissResults,
    inputRefs,
    inputRefCallback,
  };
}
