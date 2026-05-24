'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { buildSessionResult } from '@/lib/buildSessionResult';
import {
  computeChaseFallMs,
  computeChaseLevelProgress,
  computeChaseLevelSettings,
  resolveChaseTarget,
  type ChaseResolveOutcome,
} from '@/lib/chase';
import { ensureAppError } from '@/lib/errors';
import { generateTrainingGroup } from '@/lib/trainingSessionGroups';
import type { SessionResultInput } from '@/lib/validators';
import type { SessionResult, TrainingSettings } from '@/types';

import type { Toast } from './useToast';
import { useTrainingAudio } from './useTrainingAudio';
import { useTrainingSessionLock } from './useTrainingSessionLock';

const FEEDBACK_PAUSE_MS = 420;
const ALLOWED_CHASE_INPUT = /[^A-Z0-9/=?.,+]/g;

export interface ChaseTarget {
  readonly id: number;
  readonly group: string;
  readonly lanePercent: number;
  readonly level: number;
  readonly spawnedAt: number;
  readonly deadlineAt: number;
  readonly fallMs: number;
}

export interface ChaseResolvedTarget {
  readonly sent: string;
  readonly received: string;
  readonly outcome: ChaseResolveOutcome;
  readonly scoreDelta: number;
}

export interface ChaseSessionResultSummary {
  readonly accuracy: number;
  readonly groups: ReadonlyArray<{
    readonly sent: string;
    readonly received: string;
    readonly correct: boolean;
  }>;
  readonly avgResponseMs: number;
  readonly score: number;
  readonly maxLevel: number;
  readonly survivedMs: number;
  readonly bestStreak: number;
  readonly livesLost: number;
}

export interface UseChaseTrainingSessionOptions {
  readonly settings: TrainingSettings;
  readonly sessions: readonly SessionResult[];
  readonly saveSession: (input: SessionResultInput) => Promise<SessionResult[]>;
  readonly showToast: (t: Toast) => void;
}

export interface UseChaseTrainingSessionReturn {
  readonly status: 'idle' | 'running' | 'completing' | 'results' | 'failed';
  readonly isTraining: boolean;
  readonly target: ChaseTarget | null;
  readonly lastResolvedTarget: ChaseResolvedTarget | null;
  readonly userInput: string;
  readonly lives: number;
  readonly level: number;
  readonly score: number;
  readonly streak: number;
  readonly bestStreak: number;
  readonly correctInLevel: number;
  readonly levelProgress: number;
  readonly groupsCompleted: number;
  readonly sessionIssueMessage?: string;
  readonly lastSessionResult: ChaseSessionResultSummary | null;
  readonly startTraining: () => Promise<void>;
  readonly stopTraining: () => void;
  readonly dismissResults: () => void;
  readonly handleInputChange: (value: string) => void;
  readonly submitAnswer: () => void;
}

type PendingTargetResult =
  | { readonly status: 'answered'; readonly received: string; readonly answeredAt: number }
  | { readonly status: 'timeout'; readonly answeredAt: number }
  | { readonly status: 'aborted'; readonly answeredAt: number };

type PendingTargetResolver = (result: PendingTargetResult) => void;

export function useChaseTrainingSession({
  settings,
  sessions,
  saveSession,
  showToast,
}: UseChaseTrainingSessionOptions): UseChaseTrainingSessionReturn {
  const audio = useTrainingAudio(settings);
  const { takeLock, releaseLock } = useTrainingSessionLock();

  const [status, setStatus] = useState<UseChaseTrainingSessionReturn['status']>('idle');
  const [target, setTarget] = useState<ChaseTarget | null>(null);
  const [lastResolvedTarget, setLastResolvedTarget] = useState<ChaseResolvedTarget | null>(null);
  const [userInput, setUserInput] = useState('');
  const [lives, setLives] = useState(settings.chaseLives);
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [correctInLevel, setCorrectInLevel] = useState(0);
  const [groupsCompleted, setGroupsCompleted] = useState(0);
  const [sessionIssueMessage, setSessionIssueMessage] = useState<string | undefined>();
  const [lastSessionResult, setLastSessionResult] = useState<ChaseSessionResultSummary | null>(
    null,
  );

  const settingsRef = useRef(settings);
  const sessionsRef = useRef(sessions);
  const saveSessionRef = useRef(saveSession);
  const showToastRef = useRef(showToast);
  const isTrainingRef = useRef(false);
  const startedAtRef = useRef<number | null>(null);
  const userInputRef = useRef('');
  const targetRef = useRef<ChaseTarget | null>(null);
  const pendingResolverRef = useRef<PendingTargetResolver | null>(null);
  const pendingTimeoutRef = useRef<number | undefined>(undefined);

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
  useEffect(() => {
    targetRef.current = target;
  }, [target]);

  const clearPendingTarget = useCallback((): void => {
    if (pendingTimeoutRef.current !== undefined) {
      window.clearTimeout(pendingTimeoutRef.current);
      pendingTimeoutRef.current = undefined;
    }
    pendingResolverRef.current = null;
  }, []);

  const waitForTarget = useCallback(
    (fallMs: number): Promise<PendingTargetResult> =>
      new Promise((resolve) => {
        let settled = false;
        const settle = (result: PendingTargetResult): void => {
          if (settled) return;
          settled = true;
          clearPendingTarget();
          resolve(result);
        };
        pendingResolverRef.current = settle;
        pendingTimeoutRef.current = window.setTimeout(() => {
          settle({ status: 'timeout', answeredAt: Date.now() });
        }, fallMs);
      }),
    [clearPendingTarget],
  );

  const processResults = useCallback(
    async (
      sentGroups: readonly string[],
      answers: readonly string[],
      timings: readonly { readonly timeToCompleteMs: number; readonly perCharMs?: number }[],
      maxLevel: number,
      bestRunStreak: number,
    ): Promise<void> => {
      if (sentGroups.length === 0) return;
      const result = buildSessionResult({
        sentGroups,
        answers,
        startedAt: startedAtRef.current ?? Date.now(),
        groupTimings: timings,
        mode: 'chase',
      });
      const survivedMs = Math.max(0, result.finishedAt - result.startedAt);
      setLastSessionResult({
        accuracy: result.accuracy,
        groups: result.groups,
        avgResponseMs: result.avgResponseMs,
        score: result.score,
        maxLevel,
        survivedMs,
        bestStreak: bestRunStreak,
        livesLost: settingsRef.current.chaseLives,
      });
      setStatus('results');
      await saveSessionRef.current(result as SessionResultInput);
    },
    [],
  );

  const stopTraining = useCallback((): void => {
    audio.trainingAbortRef.current = true;
    isTrainingRef.current = false;
    pendingResolverRef.current?.({ status: 'aborted', answeredAt: Date.now() });
    clearPendingTarget();
    setStatus('idle');
    setTarget(null);
    releaseLock();
    audio.stopAudio();
  }, [audio, clearPendingTarget, releaseLock]);

  useEffect(() => {
    return (): void => {
      audio.trainingAbortRef.current = true;
      isTrainingRef.current = false;
      pendingResolverRef.current?.({ status: 'aborted', answeredAt: Date.now() });
      clearPendingTarget();
      releaseLock();
      audio.stopAudio();
    };
    // Match the training hooks: cleanup owns the active session lifetime, not every render.
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
    startedAtRef.current = Date.now();
    takeLock();

    setStatus('running');
    setSessionIssueMessage(undefined);
    setLastSessionResult(null);
    setLastResolvedTarget(null);
    setLives(settingsRef.current.chaseLives);
    setLevel(1);
    setScore(0);
    setStreak(0);
    setBestStreak(0);
    setCorrectInLevel(0);
    setGroupsCompleted(0);

    const sentGroups: string[] = [];
    const answers: string[] = [];
    const timings: Array<{ timeToCompleteMs: number; perCharMs?: number }> = [];
    let nextLives = settingsRef.current.chaseLives;
    let nextLevel = 1;
    let nextScore = 0;
    let nextStreak = 0;
    let nextBestStreak = 0;
    let nextCorrectInLevel = 0;
    let targetIndex = 0;

    let sessionEndedDueToIssue = false;

    try {
      while (
        nextLives > 0 &&
        isTrainingRef.current &&
        !audio.trainingAbortRef.current &&
        audio.sessionIdRef.current === mySession
      ) {
        const levelSettings = computeChaseLevelSettings(settingsRef.current, nextLevel);
        const group = generateTrainingGroup(levelSettings, sessionsRef.current);
        const currentSettings = settingsRef.current;
        const groupsPerLevel = currentSettings.chaseGroupsPerLevel;
        const fallMs = computeChaseFallMs({
          level: nextLevel,
          targetIndex,
          groupsPerLevel,
          startFallMs: currentSettings.chaseStartFallMs,
          minFallMs: currentSettings.chaseMinFallMs,
          levelSpeedupMs: currentSettings.chaseLevelSpeedupMs,
          groupSpeedupMs: currentSettings.chaseGroupSpeedupMs,
        });
        const spawnedAt = Date.now();
        const deadlineAt = spawnedAt + fallMs;
        const nextTarget: ChaseTarget = {
          id: targetIndex,
          group,
          lanePercent: 8 + ((targetIndex * 23) % 78),
          level: nextLevel,
          spawnedAt,
          deadlineAt,
          fallMs,
        };

        userInputRef.current = '';
        setUserInput('');
        setTarget(nextTarget);
        targetRef.current = nextTarget;

        const playback = await audio.playMorse(group, mySession);
        if (playback.status === 'failed' || playback.status === 'suspended') {
          const message =
            playback.status === 'failed'
              ? playback.message
              : 'Audio was suspended by the browser. Start a new Chase run when ready.';
          setSessionIssueMessage(message);
          setStatus('failed');
          showToastRef.current({ message, type: 'error' });
          audio.trainingAbortRef.current = true;
          sessionEndedDueToIssue = true;
          break;
        }

        const completion = await waitForTarget(fallMs);
        if (completion.status === 'aborted') break;

        const received = completion.status === 'answered' ? completion.received : '';
        const outcome: ChaseResolveOutcome =
          completion.status === 'timeout'
            ? 'missed'
            : received.trim().toUpperCase() === group
              ? 'correct'
              : 'wrong';
        const remainingMs = Math.max(0, deadlineAt - completion.answeredAt);
        const responseMs = Math.max(0, fallMs - remainingMs);
        const resolved = resolveChaseTarget({
          expected: group,
          received,
          outcome,
          level: nextLevel,
          lives: nextLives,
          score: nextScore,
          streak: nextStreak,
          remainingMs,
        });

        sentGroups.push(group);
        answers.push(received);
        timings.push({
          timeToCompleteMs: responseMs,
          ...(group.length > 0 ? { perCharMs: Math.round(responseMs / group.length) } : {}),
        });

        nextLives = resolved.lives;
        nextScore = resolved.score;
        nextStreak = resolved.streak;
        nextBestStreak = Math.max(nextBestStreak, nextStreak);
        nextCorrectInLevel = resolved.correct ? nextCorrectInLevel + 1 : nextCorrectInLevel;

        if (nextCorrectInLevel >= groupsPerLevel) {
          nextLevel += 1;
          nextCorrectInLevel = 0;
          showToastRef.current({
            message: `Chase level ${nextLevel}: new group pressure`,
            type: 'success',
          });
        }

        setLives(nextLives);
        setLevel(nextLevel);
        setScore(nextScore);
        setStreak(nextStreak);
        setBestStreak(nextBestStreak);
        setCorrectInLevel(nextCorrectInLevel);
        setGroupsCompleted(sentGroups.length);
        setLastResolvedTarget({
          sent: group,
          received,
          outcome,
          scoreDelta: resolved.scoreDelta,
        });
        setTarget(null);
        targetRef.current = null;

        targetIndex += 1;
        await audio.sleepCancelable(FEEDBACK_PAUSE_MS, mySession);
      }

      isTrainingRef.current = false;
      audio.stopAudio();
      clearPendingTarget();

      if (nextLives <= 0 && sentGroups.length > 0) {
        setStatus('completing');
        await processResults(sentGroups, answers, timings, nextLevel, nextBestStreak);
      } else if (!sessionEndedDueToIssue) {
        setStatus('idle');
      }
    } catch (error) {
      const appError = ensureAppError(error);
      setSessionIssueMessage(appError.message);
      setStatus('failed');
      showToastRef.current({ message: `Chase error: ${appError.message}`, type: 'error' });
    } finally {
      isTrainingRef.current = false;
      releaseLock();
      audio.stopAudio();
      clearPendingTarget();
    }
  }, [audio, clearPendingTarget, processResults, releaseLock, takeLock, waitForTarget]);

  const handleInputChange = useCallback((value: string): void => {
    const currentTarget = targetRef.current;
    const maxLength = currentTarget?.group.length ?? Number.POSITIVE_INFINITY;
    const normalized = value.toUpperCase().replace(ALLOWED_CHASE_INPUT, '').slice(0, maxLength);
    userInputRef.current = normalized;
    setUserInput(normalized);
    if (currentTarget && normalized.length >= currentTarget.group.length) {
      pendingResolverRef.current?.({
        status: 'answered',
        received: normalized,
        answeredAt: Date.now(),
      });
    }
  }, []);

  const submitAnswer = useCallback((): void => {
    pendingResolverRef.current?.({
      status: 'answered',
      received: userInputRef.current,
      answeredAt: Date.now(),
    });
  }, []);

  const dismissResults = useCallback((): void => {
    setStatus('idle');
    setLastSessionResult(null);
    setLastResolvedTarget(null);
  }, []);

  return {
    status,
    isTraining: status === 'running' || status === 'completing',
    target,
    lastResolvedTarget,
    userInput,
    lives,
    level,
    score,
    streak,
    bestStreak,
    correctInLevel,
    levelProgress: computeChaseLevelProgress(correctInLevel, settings.chaseGroupsPerLevel),
    groupsCompleted,
    ...(sessionIssueMessage !== undefined ? { sessionIssueMessage } : {}),
    lastSessionResult,
    startTraining,
    stopTraining,
    dismissResults,
    handleInputChange,
    submitAnswer,
  };
}
