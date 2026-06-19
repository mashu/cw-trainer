'use client';

import { useCallback, useEffect, useRef } from 'react';

import { buildSessionResult } from '@/lib/buildSessionResult';
import {
  AUTO_CONFIRM_DELAY_MS,
  MAX_DIGITS_LEVEL,
  MAX_KOCH_LEVEL_GUESS,
} from '@/lib/constants';
import { ensureAppError } from '@/lib/errors';
import { evaluateAutoLevelAdjust } from '@/lib/kochAutoAdjust';
import type { AutoAdjustMode } from '@/lib/kochAutoAdjust';
import { sessionLevelSnapshotFromSettings } from '@/lib/sessionLevelSnapshot';
import { decideGroupLoopTeardown } from '@/lib/training/groupLoopTeardown';
import { isGroupTrainingPlaybackFrozen, isGroupTrainingRuntimeActive } from '@/lib/training/groupSessionMachine';
import type {
  GroupSessionResultSummary,
  GroupTrainingRuntimeState,
} from '@/lib/training/groupSessionMachine';
import { logTraining } from '@/lib/training/trainingLog';
import { generateTrainingGroup, updateSamplingStateFromAnswer } from '@/lib/trainingSessionGroups';
import type { CharSamplingState } from '@/lib/trainingSessionGroups';
import { computeTrainingGroupGapMs } from '@/lib/trainingSessionPlayback';
import type { SessionResultInput } from '@/lib/validators';
import { useAppStore } from '@/store';
import type { SessionResult, TrainingSettings } from '@/types';

import type { Toast } from './useToast';
import { useTrainingAudio } from './useTrainingAudio';

// ── Public types ───────────────────────────────────────────────────────

/** Summarised result shown in the results screen. */
export type SessionResultSummary = GroupSessionResultSummary;

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
  readonly hasActiveSession: boolean;
  /**
   * True when the session was paused without a live playback loop (reload restore).
   * Inputs and Submit are disabled; only Stop is available.
   */
  readonly isPlaybackFrozen: boolean;
  readonly runtimeStatus: GroupTrainingRuntimeState['status'];
  readonly sessionIssueMessage?: string;
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
  readonly setCurrentFocusedGroup: (index: number) => void;
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

  // ── Shared audio engine ──────────────────────────────────────────────
  const audio = useTrainingAudio(settings);

  // ── Runtime store state ──────────────────────────────────────────────
  const runtime = useAppStore((state) => state.groupTrainingRuntime);
  const beginRuntimeSession = useAppStore((state) => state.beginGroupTrainingSession);
  const setRuntimeGroups = useAppStore((state) => state.setGroupTrainingGroups);
  const setRuntimeStatus = useAppStore((state) => state.setGroupTrainingStatus);
  const setRuntimeAudioStatus = useAppStore((state) => state.setGroupTrainingAudioStatus);
  const setRuntimeCurrentGroup = useAppStore((state) => state.setGroupTrainingCurrentGroup);
  const setRuntimeFocusedGroup = useAppStore((state) => state.setGroupTrainingFocusedGroup);
  const updateRuntimeInput = useAppStore((state) => state.updateGroupTrainingInput);
  const confirmRuntimeAnswer = useAppStore((state) => state.confirmGroupTrainingAnswer);
  const recordRuntimeGroupStart = useAppStore((state) => state.recordGroupTrainingStart);
  const recordRuntimeGroupEnd = useAppStore((state) => state.recordGroupTrainingEnd);
  const recordRuntimeAnswerTime = useAppStore((state) => state.recordGroupTrainingAnswerTime);
  const completeRuntimeSession = useAppStore((state) => state.completeGroupTrainingSession);
  const cancelRuntimeSession = useAppStore((state) => state.cancelGroupTrainingSession);
  const dismissRuntimeResults = useAppStore((state) => state.dismissGroupTrainingResults);
  const evaluateAchievementsForSessions = useAppStore(
    (state) => state.evaluateAchievementsForSessions,
  );

  const hasActiveSession = isGroupTrainingRuntimeActive(runtime);
  const activeRuntime =
    runtime.status !== 'idle' && runtime.status !== 'results' ? runtime : null;
  const isCompletingSession = runtime.status === 'completing';
  const showResults = runtime.status === 'results';
  const isPlaybackFrozen = isGroupTrainingPlaybackFrozen(runtime);
  const isTraining = hasActiveSession && !isCompletingSession && !isPlaybackFrozen;
  const currentGroup = activeRuntime ? activeRuntime.currentGroup : 0;
  const sentGroups = activeRuntime ? [...activeRuntime.groups] : [];
  const userInput = activeRuntime ? [...activeRuntime.userInput] : [];
  const confirmedGroups = activeRuntime ? { ...activeRuntime.confirmedGroups } : {};
  const currentFocusedGroup = activeRuntime ? activeRuntime.currentFocusedGroup : 0;
  const lastSessionResult = runtime.status === 'results' ? runtime.result : null;
  const sessionIssueMessage =
    runtime.status === 'failed'
      ? runtime.errorMessage
      : runtime.status === 'paused'
        ? runtime.pauseReason
        : undefined;
  const hasActiveSessionRef = useRef(hasActiveSession);
  useEffect(() => {
    hasActiveSessionRef.current = hasActiveSession;
  }, [hasActiveSession]);

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
  const historicalSessionsRef = useRef(historicalSessions);
  const saveSessionRef = useRef(saveSession);
  const showToastRef = useRef(showToast);
  const setTrainingSettingsStateRef = useRef(setTrainingSettingsState);
  const evaluateAchievementsForSessionsRef = useRef(evaluateAchievementsForSessions);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);
  useEffect(() => {
    historicalSessionsRef.current = historicalSessions;
  }, [historicalSessions]);
  useEffect(() => {
    saveSessionRef.current = saveSession;
  }, [saveSession]);
  useEffect(() => {
    showToastRef.current = showToast;
  }, [showToast]);
  useEffect(() => {
    setTrainingSettingsStateRef.current = setTrainingSettingsState;
  }, [setTrainingSettingsState]);
  useEffect(() => {
    evaluateAchievementsForSessionsRef.current = evaluateAchievementsForSessions;
  }, [evaluateAchievementsForSessions]);
  const groupStartAtRef = useRef<number[]>([]);
  const groupEndAtRef = useRef<number[]>([]);
  const groupAnswerAtRef = useRef<number[]>([]);
  const groupCompletionResolversRef = useRef<
    Record<number, ((result: { timedOut: boolean }) => void) | null>
  >({});
  const confirmTimeoutRef = useRef<Record<number, TimeoutId | undefined>>({});
  const charSamplingStateRef = useRef<CharSamplingState | null>(null);

  // Authoritative invariant: training audio may only exist while the store runtime is in
  // an active session. The store is the single source of truth — if it leaves the session
  // for ANY reason (cancel, dismiss, reload restore, a stale loop's teardown, or any future
  // external reset), abort the loop and tear down audio immediately. This is what guarantees
  // the "returned to the home screen but Morse keeps playing" regression cannot happen,
  // regardless of which code path reset the store.
  useEffect(() => {
    const inSession = runtime.status !== 'idle' && runtime.status !== 'results';
    if (inSession) {
      return;
    }
    if (audio.audioContextRef.current !== null || isTrainingRef.current) {
      logTraining('audio-guard:store-left-session', {
        status: runtime.status,
        hadAudioContext: audio.audioContextRef.current !== null,
      });
      audio.trainingAbortRef.current = true;
      isTrainingRef.current = false;
      audio.stopAudio();
    }
  }, [runtime.status, audio]);

  // ── Unmount cleanup ──────────────────────────────────────────────────
  useEffect(() => {
    return (): void => {
      if (isTrainingRef.current) {
        logTraining('unmount:pause-active-session');
        audio.trainingAbortRef.current = true;
        isTrainingRef.current = false;
        setRuntimeStatus('paused', { pauseReason: 'Training view was remounted.' });
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
      setRuntimeAudioStatus('closed');
      audio.stopAudio();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleHidden = (): void => {
      if (!hasActiveSessionRef.current) return;
      logTraining('visibility:hidden-pause');
      setRuntimeStatus('paused', { pauseReason: 'Training paused while the page was hidden.' });
      if (audio.audioContextRef.current?.state === 'suspended') {
        setRuntimeAudioStatus('suspended');
      }
    };

    const handleVisible = (): void => {
      if (!hasActiveSessionRef.current) return;
      const ctx = audio.audioContextRef.current;
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        void ctx.resume().then(
          () => setRuntimeAudioStatus(ctx.state === 'running' ? 'running' : 'suspended'),
          () => setRuntimeAudioStatus('suspended'),
        );
      } else {
        setRuntimeAudioStatus(ctx.state === 'closed' ? 'closed' : 'running');
      }
    };

    const handleVisibilityChange = (): void => {
      if (typeof document === 'undefined') return;
      if (document.visibilityState === 'visible') {
        handleVisible();
      } else {
        handleHidden();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handleHidden);
    window.addEventListener('pageshow', handleVisible);
    return (): void => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handleHidden);
      window.removeEventListener('pageshow', handleVisible);
    };
  }, [audio.audioContextRef, setRuntimeAudioStatus, setRuntimeStatus]);

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
          dismissRuntimeResults();
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
    const currentEvaluateAchievementsForSessions = evaluateAchievementsForSessionsRef.current;

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

    const completed = sentSource
      .map((sent, idx) => ({
        sent,
        answer: (answers[idx] || '').trim().toUpperCase(),
        idx,
      }))
      .filter((entry) => entry.sent.length > 0);
    if (completed.length === 0) {
      resultsProcessedRef.current = false;
      return;
    }

    const filteredSent = completed.map((entry) => entry.sent);
    const filteredAnswers = completed.map((entry) => entry.answer);

    const groupTimings = completed.map((entry) => {
      const idx = entry.idx;
      const endAt = groupEndAtRef.current[idx] || 0;
      const rawAnsAt = groupAnswerAtRef.current[idx] || 0;
      const timeoutMs = Math.max(0, currentSettings.groupTimeout || 0) * 1000;
      const fallbackAnsAt = endAt > 0 && timeoutMs > 0 ? endAt + timeoutMs : 0;
      const ansAt = rawAnsAt > 0 ? rawAnsAt : fallbackAnsAt;
      const delta = Math.max(0, ansAt - endAt);
      const sent = entry.sent;
      const perChar = sent.length > 0 ? Math.round(delta / sent.length) : 0;
      return { timeToCompleteMs: Number.isFinite(delta) ? delta : 0, perCharMs: perChar };
    });

    const result = buildSessionResult({
      sentGroups: filteredSent,
      answers: filteredAnswers,
      startedAt: startedAtRef.current || Date.now(),
      groupTimings,
      levelSnapshot: sessionLevelSnapshotFromSettings(currentSettings),
    });

    const summary: SessionResultSummary = {
      accuracy: result.accuracy,
      groups: result.groups.map((g, i) => ({
        sent: g.sent,
        received: filteredAnswers[i] || '',
        correct: g.sent === filteredAnswers[i],
      })),
      avgResponseMs: result.avgResponseMs,
      score: result.score,
    };
    completeRuntimeSession(summary);

    try {
      const savedSessions = await currentSaveSession(result as SessionResultInput);
      const sessionsForAchievements =
        savedSessions.some((session) => session.timestamp === result.timestamp)
          ? savedSessions
          : [...historicalSessionsRef.current, result];
      window.setTimeout(() => {
        void currentEvaluateAchievementsForSessions(sessionsForAchievements).then(
          (achievementResult) => {
            if (achievementResult.newlyUnlocked.length > 0) {
              currentShowToast({
                message:
                  achievementResult.newlyUnlocked.length === 1
                    ? 'New trophy unlocked.'
                    : `${achievementResult.newlyUnlocked.length} new trophies unlocked.`,
                type: 'success',
              });
            }
          },
          (achievementError: unknown) => {
            console.warn('[Training] Achievement evaluation failed:', achievementError);
          },
        );
      }, 0);
    } catch (error) {
      currentShowToast({ message: ensureAppError(error).message, type: 'error' });
    }

    // Auto-adjust level
    try {
      const charSetMode = currentSettings.charSetMode ?? 'koch';
      const mode: AutoAdjustMode =
        charSetMode === 'digits' ? 'digits' : charSetMode === 'mixed' ? 'mixed' : 'koch';
      const isMixed = charSetMode === 'mixed';
      const isDigits = charSetMode === 'digits';
      const adjustment = evaluateAutoLevelAdjust(result.accuracy, {
        enabled: currentSettings.autoAdjustKoch,
        mode,
        threshold: currentSettings.autoAdjustThreshold ?? 90,
        aboveThresholdCount: Math.max(0, currentSettings.autoAdjustAboveThresholdCount ?? 0),
        belowThresholdCount: Math.max(0, currentSettings.autoAdjustBelowThresholdCount ?? 0),
        currentLevel: isDigits
          ? (currentSettings.digitsLevel ?? 10)
          : currentSettings.kochLevel,
        maxLevel: isDigits ? MAX_DIGITS_LEVEL : MAX_KOCH_LEVEL_GUESS,
        ...(isMixed
          ? {
              pairedDigitsLevel: currentSettings.digitsLevel ?? 10,
              maxDigitsLevel: MAX_DIGITS_LEVEL,
              mixedAutoLevelNextAxis: currentSettings.mixedAutoLevelNextAxis ?? 'letters',
            }
          : {}),
      });
      if (adjustment) {
        if (isDigits) {
          currentSetTrainingSettingsState((prev) => ({
            ...prev,
            digitsLevel: adjustment.nextLevel,
          }));
        } else if (isMixed) {
          currentSetTrainingSettingsState((prev) => ({
            ...prev,
            kochLevel: adjustment.nextLevel,
            digitsLevel: adjustment.nextDigitsLevel ?? prev.digitsLevel,
            ...(adjustment.nextMixedAutoLevelAxis !== undefined
              ? { mixedAutoLevelNextAxis: adjustment.nextMixedAutoLevelAxis }
              : {}),
          }));
        } else {
          currentSetTrainingSettingsState((prev) => ({
            ...prev,
            kochLevel: adjustment.nextLevel,
          }));
        }
        currentShowToast({ message: adjustment.message, type: adjustment.messageType });
      }
    } catch (autoAdjustError) {
      console.warn('[Training] Auto-adjust error:', autoAdjustError);
    }
  };

  // ── Public actions ───────────────────────────────────────────────────

  const syncRuntimeGroups = (groups: string[]): void => {
    activeSentGroupsRef.current = groups;
    setRuntimeGroups(groups);
  };

  const generateGroupAtIndex = (index: number, groups: string[]): string => {
    const existing = groups[index];
    if (existing) {
      return existing;
    }
    const state = charSamplingStateRef.current;
    if (!state) {
      return '';
    }
    const generated = generateTrainingGroup(settingsRef.current, historicalSessionsRef.current, state);
    charSamplingStateRef.current = generated.state;
    const nextGroups = [...groups];
    while (nextGroups.length <= index) {
      nextGroups.push('');
    }
    nextGroups[index] = generated.group;
    syncRuntimeGroups(nextGroups);
    return generated.group;
  };

  const registerGroupAnswerForSampling = (index: number, received: string): void => {
    const state = charSamplingStateRef.current;
    const sent = activeSentGroupsRef.current[index];
    if (!state || !sent) {
      return;
    }
    charSamplingStateRef.current = updateSamplingStateFromAnswer(state, sent, received);
    const nextIndex = index + 1;
    if (nextIndex < settingsRef.current.numGroups) {
      generateGroupAtIndex(nextIndex, activeSentGroupsRef.current);
    }
  };

  const startTraining = async (): Promise<void> => {
    if (isTrainingRef.current) {
      logTraining('start:ignored-already-running');
      return;
    }

    try {
      audio.stopAudio();
      audio.trainingAbortRef.current = false;
      resultsProcessedRef.current = false;
      activeSentGroupsRef.current = [];
      cancelRuntimeSession();

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
      isTrainingRef.current = true;
      const startedAt = Date.now();
      startedAtRef.current = startedAt;
      logTraining('start', { session: mySession, numGroups: settings.numGroups });
      beginRuntimeSession({ sessionId: mySession, startedAt });
      userInputRef.current = [];
      confirmedGroupsRef.current = {};
      groupStartAtRef.current = [];
      groupEndAtRef.current = [];
      groupAnswerAtRef.current = [];

      charSamplingStateRef.current = null;
      const initialSampling = generateTrainingGroup(settings, historicalSessions);
      charSamplingStateRef.current = initialSampling.state;
      const groups = Array.from({ length: settings.numGroups }, (_, index) =>
        index === 0 ? initialSampling.group : '',
      );
      syncRuntimeGroups(groups);

      let sessionEndedDueToPlaybackIssue = false;

      for (let i = 0; i < groups.length; i++) {
        if (audio.trainingAbortRef.current || audio.sessionIdRef.current !== mySession) break;
        logTraining('group:play', { session: mySession, index: i });
        setRuntimeCurrentGroup(i);
        setRuntimeStatus('playingGroup');
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
        // Re-check ownership after every await: a newer session may have taken over while
        // we slept. A stale loop must never write to the live session's runtime.
        if (audio.trainingAbortRef.current || audio.sessionIdRef.current !== mySession) break;
        const startTs = Date.now();
        groupStartAtRef.current[i] = startTs;
        recordRuntimeGroupStart(i, startTs);
        const group = generateGroupAtIndex(i, activeSentGroupsRef.current);
        if (!group) continue;
        setRuntimeAudioStatus('running');
        const playback = await audio.playMorse(group, mySession);
        if (playback.status === 'failed' || playback.status === 'suspended') {
          const message =
            playback.status === 'failed'
              ? playback.message
              : 'Audio was suspended by the browser. Tap Submit or Stop, or start a new run.';
          sessionEndedDueToPlaybackIssue = true;
          logTraining('group:playback-issue', {
            session: mySession,
            index: i,
            status: playback.status,
          });
          setRuntimeStatus('failed', { errorMessage: message });
          audio.trainingAbortRef.current = true;
          showToast({ message, type: 'error' });
          break;
        }
        const durationSec = playback.status === 'played' ? playback.durationSec : 0;
        if (playback.status === 'played' && durationSec > 0) {
          await audio.sleepCancelable(
            Math.max(0, Math.ceil(durationSec * 1000) + 60),
            mySession,
          );
        }
        // Ownership check BEFORE writing group-end to the runtime — otherwise a stale loop
        // could clobber the live session's timings after a takeover.
        if (audio.trainingAbortRef.current || audio.sessionIdRef.current !== mySession) break;
        const groupEndedAt = startTs + Math.max(0, Math.round(durationSec * 1000));
        groupEndAtRef.current[i] = groupEndedAt;
        recordRuntimeGroupEnd(i, groupEndedAt);

        setRuntimeStatus('waitingForAnswer');
        focusInput(i);
        const { timedOut } = await waitForGroupCompletion(i);
        // The answer wait can resolve long after a newer session took over (Submit then
        // Train Again). Bail before auto-confirming or stopping playback so we never write
        // into — or cut the audio of — the live session.
        if (audio.trainingAbortRef.current || audio.sessionIdRef.current !== mySession) break;
        if (timedOut && !confirmedGroupsRef.current[i]) {
          autoConfirmOnTimeout(i);
        }
        try {
          audio.stopCurrentPlayback();
        } catch {
          /* no-op */
        }
      }
      const decision = decideGroupLoopTeardown({
        superseded: audio.sessionIdRef.current !== mySession,
        aborted: audio.trainingAbortRef.current,
        resultsProcessed: resultsProcessedRef.current,
        endedDueToPlaybackIssue: sessionEndedDueToPlaybackIssue,
      });
      logTraining('loop-end', {
        session: mySession,
        ownerSession: audio.sessionIdRef.current,
        decision,
      });

      // A newer session owns the shared audio + store. This stale loop must be completely
      // inert: touching isTrainingRef, the audio engine, or the runtime here is exactly what
      // used to bounce the live session back to the home screen while audio kept playing.
      if (decision === 'inert') {
        return;
      }

      if (decision === 'completing') {
        setRuntimeStatus('completing');
      }
      isTrainingRef.current = false;
      setRuntimeAudioStatus('closed');
      audio.stopAudio();

      if (decision === 'completing') {
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
        }
      } else if (decision === 'cancel') {
        cancelRuntimeSession();
      }
      // 'preserve' -> leave the results/failed runtime visible until the user acts.
    } catch (error) {
      logTraining('start:unexpected-error', { message: ensureAppError(error).message });
      console.error('[Training] Unexpected training error:', error);
      showToast({ message: `Training error: ${ensureAppError(error).message}`, type: 'error' });
      isTrainingRef.current = false;
      audio.trainingAbortRef.current = true;
      setRuntimeStatus('failed', { errorMessage: ensureAppError(error).message });
      setRuntimeAudioStatus('failed');
      audio.stopAudio();
    }
  };

  const submitAnswer = (): void => {
    if (isPlaybackFrozen) return;
    logTraining('submit', { ownerSession: audio.sessionIdRef.current });
    audio.trainingAbortRef.current = true;
    setRuntimeStatus('completing');
    isTrainingRef.current = false;
    setRuntimeAudioStatus('closed');
    audio.stopAudio();
    const answers = (userInputRef.current.length > 0 ? userInputRef.current : userInput).map((a) =>
      (a || '').trim().toUpperCase(),
    );
    void processResults(answers, activeSentGroupsRef.current).catch((error) => {
      console.error('[Training] Error processing results:', error);
      showToast({
        message: `Failed to process results: ${ensureAppError(error).message}`,
        type: 'error',
      });
    });
  };

  const stopTraining = (): void => {
    logTraining('stop', { ownerSession: audio.sessionIdRef.current });
    audio.trainingAbortRef.current = true;
    isTrainingRef.current = false;
    cancelRuntimeSession();
    setRuntimeAudioStatus('closed');
    audio.stopAudio();
  };

  const isGroupInputLockedDuringPlayback = (index: number): boolean =>
    (settings.lockInputDuringGroupPlayback ?? true) &&
    runtime.status === 'playingGroup' &&
    index === currentGroup;

  const confirmGroupAnswer = (index: number, overrideValue?: string): void => {
    if (isPlaybackFrozen) return;
    if (!sentGroups.length || isGroupInputLockedDuringPlayback(index)) return;
    const normalized = (overrideValue ?? userInput[index] ?? '').trim().toUpperCase();
    const nextAnswers = [...userInput];
    nextAnswers[index] = normalized;
    userInputRef.current = nextAnswers;
    const nextConfirmed = { ...confirmedGroupsRef.current, [index]: true };
    confirmedGroupsRef.current = nextConfirmed;
    const answeredAt = Date.now();
    if (!groupAnswerAtRef.current[index]) groupAnswerAtRef.current[index] = answeredAt;
    confirmRuntimeAnswer(index, normalized, answeredAt);
    registerGroupAnswerForSampling(index, normalized);

    const resolver = groupCompletionResolversRef.current[index];
    if (resolver) {
      resolver({ timedOut: false });
      delete groupCompletionResolversRef.current[index];
    }

    const nextIndex = index + 1;
    if (nextIndex < sentGroups.length) {
      setRuntimeFocusedGroup(nextIndex);
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
    if (isPlaybackFrozen) return;
    if (isGroupInputLockedDuringPlayback(index)) return;
    const nextAnswers = [...userInput];
    nextAnswers[index] = value;
    userInputRef.current = nextAnswers;
    updateRuntimeInput(index, value);

    if (
      value.length === sentGroups[index]?.length &&
      value.length > 0 &&
      !groupAnswerAtRef.current[index]
    ) {
      const answeredAt = Date.now();
      groupAnswerAtRef.current[index] = answeredAt;
      recordRuntimeAnswerTime(index, answeredAt);
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
    logTraining('dismiss-results');
    dismissRuntimeResults();
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
          if (!groupAnswerAtRef.current[i]) {
            const answeredAt = Date.now();
            groupAnswerAtRef.current[i] = answeredAt;
            recordRuntimeAnswerTime(i, answeredAt);
          }
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

  function autoConfirmOnTimeout(i: number): void {
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
    userInputRef.current = nextAnswers;
    const nextConfirmed = { ...confirmedGroupsRef.current, [i]: true };
    confirmedGroupsRef.current = nextConfirmed;
    confirmRuntimeAnswer(i, currentValue, groupAnswerAtRef.current[i] || Date.now());
    registerGroupAnswerForSampling(i, currentValue);
    const nextIndex = i + 1;
    if (nextIndex < activeSentGroupsRef.current.length) {
      setRuntimeFocusedGroup(nextIndex);
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
    hasActiveSession,
    isPlaybackFrozen,
    runtimeStatus: runtime.status,
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
    setCurrentFocusedGroup: setRuntimeFocusedGroup,
    dismissResults,
    inputRefs,
    inputRefCallback,
    ...(sessionIssueMessage !== undefined ? { sessionIssueMessage } : {}),
  };
}
