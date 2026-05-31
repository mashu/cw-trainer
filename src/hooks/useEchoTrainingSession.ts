'use client';

import { useCallback, useEffect, useRef } from 'react';

import { buildSessionResult } from '@/lib/buildSessionResult';
import { MAX_DIGITS_LEVEL, MAX_KOCH_LEVEL_GUESS } from '@/lib/constants';
import { ensureAppError } from '@/lib/errors';
import { clampExtraSpacingMultiplier } from '@/lib/extraSpacing';
import { evaluateAutoLevelAdjust } from '@/lib/kochAutoAdjust';
import type { AutoAdjustMode } from '@/lib/kochAutoAdjust';
import { playMorseCodeControlled, resumeAudioContextFromUserGesture } from '@/lib/morseAudio';
import { MORSE_CODE } from '@/lib/morseConstants';
import {
  decodeMorsePattern,
  isMorsePrefix,
  keyboardInputToMorseSignal,
  type MorseSignal,
} from '@/lib/morseSignals';
import { sessionLevelSnapshotFromSettings } from '@/lib/sessionLevelSnapshot';
import {
  isEchoTrainingRuntimeActive,
  type EchoCharacterProgress,
  type EchoCharacterState,
  type EchoSessionResultSummary,
} from '@/lib/training/echoSessionMachine';
import { generateTrainingGroup } from '@/lib/trainingSessionGroups';
import { computeTrainingGroupGapMs, pickTrainingToneHz } from '@/lib/trainingSessionPlayback';
import type { SessionResultInput } from '@/lib/validators';
import { useAppStore } from '@/store';
import type { SessionResult, TrainingSettings } from '@/types';

import type { Toast } from './useToast';
import { useTrainingAudio } from './useTrainingAudio';

export type { EchoCharacterProgress, EchoCharacterState, EchoSessionResultSummary };

export interface UseEchoTrainingSessionOptions {
  readonly settings: TrainingSettings;
  readonly sessions: readonly SessionResult[];
  readonly saveSession: (input: SessionResultInput) => Promise<SessionResult[]>;
  readonly setTrainingSettingsState: (
    next: TrainingSettings | ((prev: TrainingSettings) => TrainingSettings),
  ) => void;
  readonly showToast: (toast: Toast) => void;
}

export interface UseEchoTrainingSessionReturn {
  readonly isTraining: boolean;
  readonly isCompletingSession: boolean;
  readonly currentGroup: number;
  readonly sentGroups: string[];
  readonly currentCharacterIndex: number;
  readonly currentCharacterState: EchoCharacterState;
  readonly currentSymbols: string;
  readonly revealedCharacter: string | null;
  readonly currentGroupProgress: readonly EchoCharacterProgress[];
  readonly correctCharacters: number;
  readonly incorrectCharacters: number;
  readonly sendingScore: number;
  readonly showResults: boolean;
  readonly lastSessionResult: EchoSessionResultSummary | null;
  readonly startTraining: () => Promise<void>;
  readonly stopTraining: () => void;
  readonly dismissResults: () => void;
}

interface EchoAttemptResult {
  readonly outcome: 'correct' | 'error' | 'timeout' | 'aborted';
  readonly receivedCharacter: string;
  readonly durationMs: number;
}

interface ActiveAttempt {
  readonly expectedPattern: string;
  readonly targetCharacter: string;
  readonly startedAt: number;
  readonly resolve: (result: EchoAttemptResult) => void;
  timeoutId?: number;
  pattern: string;
  settled: boolean;
}

interface PaddleState {
  '.': boolean;
  '-': boolean;
}

const FEEDBACK_DELAY_MS = 280;
const ERROR_PLACEHOLDER = '_';

export function useEchoTrainingSession({
  settings,
  sessions: historicalSessions,
  saveSession,
  setTrainingSettingsState,
  showToast,
}: UseEchoTrainingSessionOptions): UseEchoTrainingSessionReturn {
  const audio = useTrainingAudio(settings);

  const runtime = useAppStore((state) => state.echoTrainingRuntime);
  const beginRuntimeSession = useAppStore((state) => state.beginEchoTrainingSession);
  const setRuntimeGroups = useAppStore((state) => state.setEchoTrainingGroups);
  const setRuntimeStatus = useAppStore((state) => state.setEchoTrainingStatus);
  const setRuntimeCurrentGroup = useAppStore((state) => state.setEchoTrainingCurrentGroup);
  const updateRuntimeCharacter = useAppStore((state) => state.updateEchoTrainingCharacter);
  const setRuntimeScores = useAppStore((state) => state.setEchoTrainingScores);
  const completeRuntimeSession = useAppStore((state) => state.completeEchoTrainingSession);
  const cancelRuntimeSession = useAppStore((state) => state.cancelEchoTrainingSession);
  const dismissRuntimeResults = useAppStore((state) => state.dismissEchoTrainingResults);

  const hasActiveSession = isEchoTrainingRuntimeActive(runtime);
  const activeRuntime =
    runtime.status !== 'idle' && runtime.status !== 'results' ? runtime : null;
  const isCompletingSession = runtime.status === 'completing';
  const showResults = runtime.status === 'results';
  const isTraining = hasActiveSession && !isCompletingSession;
  const currentGroup = activeRuntime ? activeRuntime.currentGroup : 0;
  const sentGroups = activeRuntime ? [...activeRuntime.sentGroups] : [];
  const currentCharacterIndex = activeRuntime ? activeRuntime.currentCharacterIndex : 0;
  const currentCharacterState = activeRuntime ? activeRuntime.currentCharacterState : 'idle';
  const currentSymbols = activeRuntime ? activeRuntime.currentSymbols : '';
  const revealedCharacter = activeRuntime ? activeRuntime.revealedCharacter : null;
  const currentGroupProgress = activeRuntime ? [...activeRuntime.currentGroupProgress] : [];
  const lastSessionResult = runtime.status === 'results' ? runtime.result : null;
  const correctCharacters = activeRuntime
    ? activeRuntime.correctCharacters
    : lastSessionResult
      ? lastSessionResult.correctCharacters
      : 0;
  const incorrectCharacters = activeRuntime
    ? activeRuntime.incorrectCharacters
    : lastSessionResult
      ? lastSessionResult.incorrectCharacters
      : 0;

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

  const isTrainingRef = useRef(false);
  const startedAtRef = useRef<number | null>(null);
  const activeAttemptRef = useRef<ActiveAttempt | null>(null);
  const characterStateRef = useRef<EchoCharacterState>('idle');
  const paddleStateRef = useRef<PaddleState>({ '.': false, '-': false });
  const keyerRunningRef = useRef(false);
  const lastKeyerSignalRef = useRef<MorseSignal | null>(null);
  const lastPressedPaddleRef = useRef<MorseSignal | null>(null);
  const squeezeLatchedRef = useRef(false);

  const resetKeyerMemory = useCallback((): void => {
    lastKeyerSignalRef.current = null;
    lastPressedPaddleRef.current = null;
    squeezeLatchedRef.current = false;
  }, []);

  const resetAllKeyerState = useCallback((): void => {
    paddleStateRef.current = { '.': false, '-': false };
    keyerRunningRef.current = false;
    resetKeyerMemory();
  }, [resetKeyerMemory]);

  const settleActiveAttempt = useCallback(
    (result: EchoAttemptResult): void => {
      const attempt = activeAttemptRef.current;
      if (!attempt || attempt.settled) return;
      attempt.settled = true;
      if (attempt.timeoutId !== undefined) {
        try {
          window.clearTimeout(attempt.timeoutId);
        } catch {
          /* no-op */
        }
      }
      activeAttemptRef.current = null;
      resetKeyerMemory();
      attempt.resolve(result);
    },
    [resetKeyerMemory],
  );

  useEffect(() => {
    characterStateRef.current = currentCharacterState;
  }, [currentCharacterState]);

  useEffect(() => {
    return (): void => {
      audio.trainingAbortRef.current = true;
      isTrainingRef.current = false;
      resetAllKeyerState();
      settleActiveAttempt({ outcome: 'aborted', receivedCharacter: '', durationMs: 0 });
      if (isTrainingRef.current) {
        setRuntimeStatus('paused', { pauseReason: 'Echo training view was remounted.' });
      }
      audio.stopAudio();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const playCharacter = useCallback(
    async (character: string, sessionId: number): Promise<void> => {
      if (audio.trainingAbortRef.current || audio.sessionIdRef.current !== sessionId) return;
      if (!audio.audioContextRef.current) audio.audioContextRef.current = new AudioContext();
      const audioContext = audio.audioContextRef.current;
      const { durationSec } = await playMorseCodeControlled(
        audioContext,
        character,
        {
          charWpmMin: Math.max(1, settings.charWpmMin),
          charWpmMax: Math.max(1, settings.charWpmMax),
          effectiveWpmMin: Math.max(1, settings.effectiveWpmMin),
          effectiveWpmMax: Math.max(1, settings.effectiveWpmMax),
          extraWordSpaceMultiplier: clampExtraSpacingMultiplier(settings.extraWordSpaceMultiplier),
          sideTone: pickTrainingToneHz(settings),
          steepness: settings.steepness,
          envelopeSmoothing: settings.envelopeSmoothing ?? 0,
          volumeMin: settings.volumeMin,
          volumeMax: settings.volumeMax,
          linkVolume: settings.linkVolume,
        },
        () => audio.trainingAbortRef.current || audio.sessionIdRef.current !== sessionId,
      );
      await audio.sleepCancelable(
        Math.max(0, Math.ceil((durationSec || 0) * 1000) + 60),
        sessionId,
      );
    },
    [settings, audio],
  );

  const playInputFeedback = useCallback(
    async (signal: '.' | '-'): Promise<void> => {
      if (audio.trainingAbortRef.current) return;
      if (!audio.audioContextRef.current) audio.audioContextRef.current = new AudioContext();
      resumeAudioContextFromUserGesture(audio.audioContextRef.current);
      await playMorseCodeControlled(
        audio.audioContextRef.current,
        signal === '.' ? 'E' : 'T',
        {
          charWpmMin: Math.max(1, settings.charWpmMin),
          charWpmMax: Math.max(1, settings.charWpmMax),
          effectiveWpmMin: Math.max(1, settings.effectiveWpmMin),
          effectiveWpmMax: Math.max(1, settings.effectiveWpmMax),
          extraWordSpaceMultiplier: 1,
          sideTone: settings.sideToneMin,
          steepness: settings.steepness,
          envelopeSmoothing: settings.envelopeSmoothing ?? 0,
          volumeMin: settings.volumeMax,
          volumeMax: settings.volumeMax,
          linkVolume: true,
        },
        () => audio.trainingAbortRef.current,
      );
    },
    [settings, audio],
  );

  const applySignalToActiveAttempt = useCallback(
    (signal: MorseSignal): void => {
      const activeAttempt = activeAttemptRef.current;
      if (!activeAttempt || audio.trainingAbortRef.current) return;
      const nextPattern = `${activeAttempt.pattern}${signal}`;
      activeAttempt.pattern = nextPattern;
      updateRuntimeCharacter({ symbols: nextPattern, characterState: 'receiving' });

      if (!isMorsePrefix(activeAttempt.expectedPattern, nextPattern)) {
        settleActiveAttempt({
          outcome: 'error',
          receivedCharacter: decodeMorsePattern(nextPattern) ?? ERROR_PLACEHOLDER,
          durationMs: Math.max(0, Date.now() - activeAttempt.startedAt),
        });
        return;
      }
      if (nextPattern === activeAttempt.expectedPattern) {
        settleActiveAttempt({
          outcome: 'correct',
          receivedCharacter: decodeMorsePattern(nextPattern) ?? activeAttempt.targetCharacter,
          durationMs: Math.max(0, Date.now() - activeAttempt.startedAt),
        });
      }
    },
    [settleActiveAttempt, audio, updateRuntimeCharacter],
  );

  const dispatchSignal = useCallback(
    (signal: MorseSignal): void => {
      if (audio.trainingAbortRef.current) return;
      void playInputFeedback(signal);
      if (activeAttemptRef.current) applySignalToActiveAttempt(signal);
    },
    [applySignalToActiveAttempt, playInputFeedback, audio],
  );

  const keyerDotMs = useCallback((): number => {
    const min = Math.max(1, settings.charWpmMin);
    const max = Math.max(min, settings.charWpmMax);
    return 1200 / Math.max(1, Math.round((min + max) / 2));
  }, [settings.charWpmMax, settings.charWpmMin]);

  const chooseNextPaddleSignal = useCallback((): MorseSignal | null => {
    const ditPressed = paddleStateRef.current['.'];
    const dahPressed = paddleStateRef.current['-'];
    if (ditPressed && dahPressed) {
      const last = lastKeyerSignalRef.current;
      if (last === '.') return '-';
      if (last === '-') return '.';
      return lastPressedPaddleRef.current ?? '.';
    }
    if (ditPressed) return '.';
    if (dahPressed) return '-';
    if (squeezeLatchedRef.current && lastKeyerSignalRef.current) {
      squeezeLatchedRef.current = false;
      return lastKeyerSignalRef.current === '.' ? '-' : '.';
    }
    return null;
  }, []);

  const runPaddleKeyer = useCallback(async (): Promise<void> => {
    if (
      keyerRunningRef.current ||
      audio.trainingAbortRef.current ||
      !isTrainingRef.current ||
      !activeAttemptRef.current
    )
      return;
    keyerRunningRef.current = true;
    try {
      while (!audio.trainingAbortRef.current && isTrainingRef.current && activeAttemptRef.current) {
        const signal = chooseNextPaddleSignal();
        if (!signal) break;
        lastKeyerSignalRef.current = signal;
        dispatchSignal(signal);
        const dotMs = keyerDotMs();
        await audio.sleepCancelable(
          signal === '.' ? dotMs * 2 : dotMs * 4,
          audio.sessionIdRef.current,
        );
      }
    } finally {
      keyerRunningRef.current = false;
    }
  }, [chooseNextPaddleSignal, dispatchSignal, keyerDotMs, audio]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      const signal = keyboardInputToMorseSignal({ key: event.key, code: event.code });
      if (
        !signal ||
        !isTrainingRef.current ||
        audio.trainingAbortRef.current ||
        !activeAttemptRef.current
      )
        return;
      if (event.repeat) return;
      event.preventDefault();
      event.stopPropagation();
      paddleStateRef.current[signal] = true;
      lastPressedPaddleRef.current = signal;
      if (paddleStateRef.current['.'] && paddleStateRef.current['-'])
        squeezeLatchedRef.current = true;
      void runPaddleKeyer();
    };
    const handleKeyUp = (event: KeyboardEvent): void => {
      const signal = keyboardInputToMorseSignal({ key: event.key, code: event.code });
      if (!signal) return;
      event.preventDefault();
      event.stopPropagation();
      paddleStateRef.current[signal] = false;
    };
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    return (): void => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
    };
  }, [runPaddleKeyer, audio.trainingAbortRef]);

  useEffect(() => {
    if (currentCharacterState !== 'awaiting' || !isTraining || audio.trainingAbortRef.current)
      return;
    const paddleDown = paddleStateRef.current['.'] || paddleStateRef.current['-'];
    if (!paddleDown || !activeAttemptRef.current) return;
    void runPaddleKeyer();
  }, [currentCharacterState, isTraining, runPaddleKeyer, audio.trainingAbortRef]);

  const waitForAttempt = useCallback(
    (
      targetCharacter: string,
      expectedPattern: string,
      sessionId: number,
    ): Promise<EchoAttemptResult> =>
      new Promise((resolve) => {
        if (audio.trainingAbortRef.current || audio.sessionIdRef.current !== sessionId) {
          resolve({ outcome: 'aborted', receivedCharacter: '', durationMs: 0 });
          return;
        }
        const attempt: ActiveAttempt = {
          expectedPattern,
          targetCharacter,
          startedAt: Date.now(),
          resolve,
          pattern: '',
          settled: false,
        };
        if (settings.groupTimeout > 0) {
          attempt.timeoutId = window.setTimeout(() => {
            settleActiveAttempt({
              outcome: 'timeout',
              receivedCharacter: decodeMorsePattern(attempt.pattern) ?? ERROR_PLACEHOLDER,
              durationMs: Math.max(0, Date.now() - attempt.startedAt),
            });
          }, settings.groupTimeout * 1000);
        }
        activeAttemptRef.current = attempt;
      }),
    [settings.groupTimeout, settleActiveAttempt, audio],
  );

  const processResults = useCallback(
    async (
      groupsSent: readonly string[],
      groupsReceived: readonly string[],
      groupResponseTimes: readonly number[],
      nextCorrectChars: number,
      nextIncorrectChars: number,
    ): Promise<void> => {
      if (groupsSent.length === 0) return;
      const groupTimings = groupsSent.map((sent, i) => {
        const ms = Math.max(0, groupResponseTimes[i] ?? 0);
        return {
          timeToCompleteMs: ms,
          ...(sent.length > 0 ? { perCharMs: Math.round(ms / sent.length) } : {}),
        };
      });

      const currentSettings = settingsRef.current;
      const result = buildSessionResult({
        sentGroups: groupsSent,
        answers: [...groupsReceived],
        startedAt: startedAtRef.current ?? Date.now(),
        groupTimings,
        mode: 'echo',
        levelSnapshot: sessionLevelSnapshotFromSettings(currentSettings),
      });

      const sendingScore = nextCorrectChars - nextIncorrectChars;
      const summary: EchoSessionResultSummary = {
        accuracy: result.accuracy,
        groups: result.groups,
        avgResponseMs: result.avgResponseMs,
        score: result.score,
        sendingScore,
        correctCharacters: nextCorrectChars,
        incorrectCharacters: nextIncorrectChars,
      };
      completeRuntimeSession(summary);

      const currentSaveSession = saveSessionRef.current;
      const currentShowToast = showToastRef.current;
      const currentSetTrainingSettingsState = setTrainingSettingsStateRef.current;

      try {
        await currentSaveSession(result as SessionResultInput);
      } catch (error) {
        currentShowToast({ message: ensureAppError(error).message, type: 'error' });
      }

      try {
        const charSetMode = currentSettings.charSetMode ?? 'koch';
        const mode: AutoAdjustMode =
          charSetMode === 'digits'
            ? 'echo-digits'
            : charSetMode === 'mixed'
              ? 'echo-mixed'
              : 'echo-koch';
        const isMixed = charSetMode === 'mixed';
        const isDigits = charSetMode === 'digits';
        const adjustment = evaluateAutoLevelAdjust(result.accuracy, {
          enabled: Boolean(currentSettings.echoAutoAdjustKoch),
          mode,
          threshold: currentSettings.echoAutoAdjustThreshold ?? 90,
          aboveThresholdCount: Math.max(0, currentSettings.echoAutoAdjustAboveThresholdCount ?? 0),
          belowThresholdCount: Math.max(0, currentSettings.echoAutoAdjustBelowThresholdCount ?? 0),
          currentLevel: isDigits
            ? (currentSettings.digitsLevel ?? 10)
            : currentSettings.kochLevel,
          maxLevel: isDigits ? MAX_DIGITS_LEVEL : MAX_KOCH_LEVEL_GUESS,
          ...(isMixed
            ? {
                pairedDigitsLevel: currentSettings.digitsLevel ?? 10,
                maxDigitsLevel: MAX_DIGITS_LEVEL,
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
        console.warn('[EchoTraining] Auto-adjust error:', autoAdjustError);
      }
    },
    [completeRuntimeSession],
  );

  const stopTraining = useCallback((): void => {
    audio.trainingAbortRef.current = true;
    isTrainingRef.current = false;
    resetAllKeyerState();
    cancelRuntimeSession();
    settleActiveAttempt({ outcome: 'aborted', receivedCharacter: '', durationMs: 0 });
    audio.stopAudio();
  }, [resetAllKeyerState, settleActiveAttempt, audio, cancelRuntimeSession]);

  const dismissResults = useCallback((): void => {
    dismissRuntimeResults();
  }, [dismissRuntimeResults]);

  const startTraining = useCallback(async (): Promise<void> => {
    if (isTrainingRef.current) return;

    try {
      audio.stopAudio();
      audio.trainingAbortRef.current = false;
      resetAllKeyerState();
      cancelRuntimeSession();

      audio.ensureAudioReady();

      const mySession = audio.sessionIdRef.current + 1;
      audio.sessionIdRef.current = mySession;
      startedAtRef.current = Date.now();
      isTrainingRef.current = true;
      beginRuntimeSession({ sessionId: mySession, startedAt: startedAtRef.current });
      setRuntimeStatus('running');

      const groups = Array.from({ length: settings.numGroups }, () =>
        generateTrainingGroup(settings, historicalSessions),
      );
      setRuntimeGroups(groups);

      const receivedGroups: string[] = [];
      const groupResponseTimes: number[] = [];
      let nextCorrect = 0;
      let nextIncorrect = 0;

      for (let gi = 0; gi < groups.length; gi += 1) {
        const group = groups[gi];
        if (!group || audio.trainingAbortRef.current || audio.sessionIdRef.current !== mySession)
          break;
        let groupProgress: EchoCharacterProgress[] = group.split('').map(() => ({
          revealedCharacter: null,
          status: 'pending' as const,
        }));
        setRuntimeCurrentGroup(gi, groupProgress);
        if (gi > 0) await audio.sleepCancelable(computeTrainingGroupGapMs(settings), mySession);

        let receivedGroup = '';
        let groupTimeMs = 0;

        for (let ci = 0; ci < group.length; ci += 1) {
          const target = group[ci];
          if (!target || audio.trainingAbortRef.current || audio.sessionIdRef.current !== mySession)
            break;
          updateRuntimeCharacter({
            index: ci,
            characterState: 'playing',
            symbols: '',
            revealedCharacter: null,
          });

          await playCharacter(target, mySession);
          if (audio.trainingAbortRef.current || audio.sessionIdRef.current !== mySession) break;
          const expectedPattern = MORSE_CODE[target] ?? '';
          if (!expectedPattern) continue;

          updateRuntimeCharacter({ characterState: 'awaiting', symbols: '' });
          const attemptResult = await waitForAttempt(target, expectedPattern, mySession);
          if (
            attemptResult.outcome === 'aborted' ||
            audio.trainingAbortRef.current ||
            audio.sessionIdRef.current !== mySession
          )
            break;

          const success = attemptResult.outcome === 'correct';
          const normalizedReceived = success
            ? target
            : attemptResult.receivedCharacter || ERROR_PLACEHOLDER;
          receivedGroup += normalizedReceived;
          groupTimeMs += attemptResult.durationMs;
          nextCorrect += success ? 1 : 0;
          nextIncorrect += success ? 0 : 1;
          setRuntimeScores(nextCorrect, nextIncorrect);
          groupProgress = groupProgress.map((item, idx) =>
            idx === ci
              ? { revealedCharacter: target, status: success ? ('correct' as const) : ('error' as const) }
              : item,
          );
          updateRuntimeCharacter({
            revealedCharacter: target,
            characterState: success ? 'correct' : 'error',
            groupProgress,
          });
          await audio.sleepCancelable(FEEDBACK_DELAY_MS, mySession);
        }
        receivedGroups.push(receivedGroup);
        groupResponseTimes.push(groupTimeMs);
      }

      const willProcessResults =
        !audio.trainingAbortRef.current && audio.sessionIdRef.current === mySession;
      if (willProcessResults) {
        setRuntimeStatus('completing');
      }
      isTrainingRef.current = false;
      resetAllKeyerState();
      audio.stopAudio();
      updateRuntimeCharacter({ characterState: 'idle', symbols: '' });

      if (willProcessResults) {
        await processResults(
          groups,
          receivedGroups,
          groupResponseTimes,
          nextCorrect,
          nextIncorrect,
        );
      } else {
        cancelRuntimeSession();
      }
    } catch (error) {
      console.error('[EchoTraining] Unexpected training error:', error);
      showToast({
        message: `Echo training error: ${ensureAppError(error).message}`,
        type: 'error',
      });
      stopTraining();
    }
  }, [
    historicalSessions,
    playCharacter,
    processResults,
    resetAllKeyerState,
    settings,
    showToast,
    audio,
    stopTraining,
    waitForAttempt,
    beginRuntimeSession,
    cancelRuntimeSession,
    setRuntimeGroups,
    setRuntimeStatus,
    setRuntimeCurrentGroup,
    updateRuntimeCharacter,
    setRuntimeScores,
  ]);

  return {
    isTraining,
    isCompletingSession,
    currentGroup,
    sentGroups,
    currentCharacterIndex,
    currentCharacterState,
    currentSymbols,
    revealedCharacter,
    currentGroupProgress,
    correctCharacters,
    incorrectCharacters,
    sendingScore: correctCharacters - incorrectCharacters,
    showResults,
    lastSessionResult,
    startTraining,
    stopTraining,
    dismissResults,
  };
}
