'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { buildSessionResult } from '@/lib/buildSessionResult';
import { MAX_DIGITS_LEVEL, MAX_KOCH_LEVEL_GUESS } from '@/lib/constants';
import { ensureAppError } from '@/lib/errors';
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
import { generateTrainingGroup } from '@/lib/trainingSessionGroups';
import { computeTrainingGroupGapMs, pickTrainingToneHz } from '@/lib/trainingSessionPlayback';
import type { SessionResultInput } from '@/lib/validators';
import type { SessionResult, TrainingSettings } from '@/types';

import type { Toast } from './useToast';
import { useTrainingAudio } from './useTrainingAudio';
import { useTrainingSessionLock } from './useTrainingSessionLock';

type EchoCharacterState = 'idle' | 'playing' | 'awaiting' | 'receiving' | 'correct' | 'error';
type EchoAttemptOutcome = 'correct' | 'error' | 'timeout' | 'aborted';

export interface EchoCharacterProgress {
  readonly revealedCharacter: string | null;
  readonly status: 'pending' | 'correct' | 'error';
}

export interface EchoSessionResultSummary {
  readonly accuracy: number;
  readonly groups: ReadonlyArray<{ sent: string; received: string; correct: boolean }>;
  readonly avgResponseMs: number;
  readonly score: number;
  readonly sendingScore: number;
  readonly correctCharacters: number;
  readonly incorrectCharacters: number;
}

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
  /** True while playback stopped but results UI / persistence are still being prepared — avoids a routing flash to home. */
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
  readonly outcome: EchoAttemptOutcome;
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
  const { takeLock: takeSessionLock, releaseLock: dropSessionLock } = useTrainingSessionLock();
  const audio = useTrainingAudio(settings);

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

  const [isTraining, setIsTraining] = useState(false);
  const [currentGroup, setCurrentGroup] = useState(0);
  const [sentGroups, setSentGroups] = useState<string[]>([]);
  const [currentCharacterIndex, setCurrentCharacterIndex] = useState(0);
  const [currentCharacterState, setCurrentCharacterState] = useState<EchoCharacterState>('idle');
  const [currentSymbols, setCurrentSymbols] = useState('');
  const [revealedCharacter, setRevealedCharacter] = useState<string | null>(null);
  const [currentGroupProgress, setCurrentGroupProgress] = useState<
    readonly EchoCharacterProgress[]
  >([]);
  const [correctCharacters, setCorrectCharacters] = useState(0);
  const [incorrectCharacters, setIncorrectCharacters] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [lastSessionResult, setLastSessionResult] = useState<EchoSessionResultSummary | null>(null);
  const [isCompletingSession, setIsCompletingSession] = useState(false);

  const isTrainingRef = useRef(false);
  const startedAtRef = useRef<number | null>(null);
  const activeAttemptRef = useRef<ActiveAttempt | null>(null);
  const characterStateRef = useRef<EchoCharacterState>('idle');
  const paddleStateRef = useRef<PaddleState>({ '.': false, '-': false });
  const keyerRunningRef = useRef(false);
  const lastKeyerSignalRef = useRef<MorseSignal | null>(null);
  const lastPressedPaddleRef = useRef<MorseSignal | null>(null);
  const squeezeLatchedRef = useRef(false);

  /** Clears iambic/manual memory only. Paddle refs follow real keyup/keydown — do not clear on attempt settle or keys stay “up” in software while still held. */
  const resetKeyerMemory = useCallback((): void => {
    lastKeyerSignalRef.current = null;
    lastPressedPaddleRef.current = null;
    squeezeLatchedRef.current = false;
  }, []);

  /** Full reset: training stop / session start / unmount. */
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
          extraWordSpaceMultiplier: Math.max(0.1, settings.extraWordSpaceMultiplier ?? 1),
          sideTone: pickTrainingToneHz(settings),
          steepness: settings.steepness,
          envelopeSmoothing: settings.envelopeSmoothing ?? 0,
          volumeMin: settings.volumeMin,
          volumeMax: settings.volumeMax,
          linkVolume: settings.linkVolume,
        },
        () => audio.trainingAbortRef.current || audio.sessionIdRef.current !== sessionId,
      );
      // Keep stop ref in the shared audio engine would require more complex changes;
      // we use a local wait instead
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
      setCurrentSymbols(nextPattern);
      setCurrentCharacterState('receiving');

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
    [settleActiveAttempt, audio],
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

  /** Iambic and manual keyboard paddle paths share the same timing and squeeze logic. */
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

      const result = buildSessionResult({
        sentGroups: groupsSent,
        answers: [...groupsReceived],
        startedAt: startedAtRef.current ?? Date.now(),
        groupTimings,
        mode: 'echo',
      });

      const sendingScore = nextCorrectChars - nextIncorrectChars;
      setLastSessionResult({
        accuracy: result.accuracy,
        groups: result.groups,
        avgResponseMs: result.avgResponseMs,
        score: result.score,
        sendingScore,
        correctCharacters: nextCorrectChars,
        incorrectCharacters: nextIncorrectChars,
      });
      setShowResults(true);

      const currentSaveSession = saveSessionRef.current;
      const currentShowToast = showToastRef.current;
      const currentSetTrainingSettingsState = setTrainingSettingsStateRef.current;
      const currentSettings = settingsRef.current;

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
    [],
  );

  const stopTraining = useCallback((): void => {
    audio.trainingAbortRef.current = true;
    isTrainingRef.current = false;
    resetAllKeyerState();
    setIsTraining(false);
    dropSessionLock();
    settleActiveAttempt({ outcome: 'aborted', receivedCharacter: '', durationMs: 0 });
    audio.stopAudio();
    setCurrentCharacterState('idle');
  }, [resetAllKeyerState, settleActiveAttempt, audio, dropSessionLock]);

  const dismissResults = useCallback((): void => {
    setShowResults(false);
    setLastSessionResult(null);
  }, []);

  const startTraining = useCallback(async (): Promise<void> => {
    if (isTrainingRef.current) return;

    try {
      audio.stopAudio();
      audio.trainingAbortRef.current = false;
      resetAllKeyerState();
      setIsCompletingSession(false);
      setShowResults(false);
      setLastSessionResult(null);
      setCurrentGroup(0);
      setCurrentCharacterIndex(0);
      setCurrentCharacterState('idle');
      setCurrentSymbols('');
      setRevealedCharacter(null);
      setCurrentGroupProgress([]);
      setCorrectCharacters(0);
      setIncorrectCharacters(0);

      audio.ensureAudioReady();

      const mySession = audio.sessionIdRef.current + 1;
      audio.sessionIdRef.current = mySession;
      startedAtRef.current = Date.now();
      isTrainingRef.current = true;
      setIsTraining(true);
      takeSessionLock();

      const groups = Array.from({ length: settings.numGroups }, () =>
        generateTrainingGroup(settings, historicalSessions),
      );
      setSentGroups(groups);

      const receivedGroups: string[] = [];
      const groupResponseTimes: number[] = [];
      let nextCorrect = 0;
      let nextIncorrect = 0;

      for (let gi = 0; gi < groups.length; gi += 1) {
        const group = groups[gi];
        if (!group || audio.trainingAbortRef.current || audio.sessionIdRef.current !== mySession)
          break;
        setCurrentGroup(gi);
        setCurrentGroupProgress(
          group.split('').map(() => ({ revealedCharacter: null, status: 'pending' as const })),
        );
        if (gi > 0) await audio.sleepCancelable(computeTrainingGroupGapMs(settings), mySession);

        let receivedGroup = '';
        let groupTimeMs = 0;

        for (let ci = 0; ci < group.length; ci += 1) {
          const target = group[ci];
          if (!target || audio.trainingAbortRef.current || audio.sessionIdRef.current !== mySession)
            break;
          setCurrentCharacterIndex(ci);
          setCurrentCharacterState('playing');
          setCurrentSymbols('');
          setRevealedCharacter(null);

          await playCharacter(target, mySession);
          if (audio.trainingAbortRef.current || audio.sessionIdRef.current !== mySession) break;
          const expectedPattern = MORSE_CODE[target] ?? '';
          if (!expectedPattern) continue;

          setCurrentCharacterState('awaiting');
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
          setCorrectCharacters(nextCorrect);
          setIncorrectCharacters(nextIncorrect);
          setRevealedCharacter(target);
          setCurrentCharacterState(success ? 'correct' : 'error');
          setCurrentGroupProgress((prev) =>
            prev.map((item, idx) =>
              idx === ci
                ? { revealedCharacter: target, status: success ? 'correct' : 'error' }
                : item,
            ),
          );
          await audio.sleepCancelable(FEEDBACK_DELAY_MS, mySession);
        }
        receivedGroups.push(receivedGroup);
        groupResponseTimes.push(groupTimeMs);
      }

      const willProcessResults =
        !audio.trainingAbortRef.current && audio.sessionIdRef.current === mySession;
      if (willProcessResults) {
        setIsCompletingSession(true);
      }
      isTrainingRef.current = false;
      setIsTraining(false);
      resetAllKeyerState();
      audio.stopAudio();
      setCurrentCharacterState('idle');
      setCurrentSymbols('');

      if (willProcessResults) {
        try {
          await processResults(
            groups,
            receivedGroups,
            groupResponseTimes,
            nextCorrect,
            nextIncorrect,
          );
        } finally {
          dropSessionLock();
          setIsCompletingSession(false);
        }
      } else {
        dropSessionLock();
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
    takeSessionLock,
    dropSessionLock,
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
