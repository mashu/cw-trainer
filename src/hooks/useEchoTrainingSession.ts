'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { buildSessionResult } from '@/lib/buildSessionResult';
import { ensureAppError } from '@/lib/errors';
import {
  playMorseCodeControlled,
  resumeAudioContextFromUserGesture,
} from '@/lib/morseAudio';
import { MORSE_CODE } from '@/lib/morseConstants';
import {
  decodeMorsePattern,
  isMorsePrefix,
  keyboardInputToMorseSignal,
  type MorseSignal,
  MORSE_DASH_KEY,
  MORSE_DOT_KEY,
} from '@/lib/morseSignals';
import { generateTrainingGroup } from '@/lib/trainingSessionGroups';
import {
  computeTrainingGroupGapMs,
  pickTrainingToneHz,
} from '@/lib/trainingSessionPlayback';
import { useAppStore } from '@/store';
import type { SessionResult, TrainingSettings } from '@/types';

import type { Toast } from './useToast';
import { useTrainingAudio } from './useTrainingAudio';

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
  readonly saveSession: (input: Record<string, unknown>) => Promise<SessionResult[]>;
  readonly showToast: (toast: Toast) => void;
}

export interface UseEchoTrainingSessionReturn {
  readonly isTraining: boolean;
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

interface PaddleState { '.': boolean; '-': boolean }

const FEEDBACK_DELAY_MS = 280;
const ERROR_PLACEHOLDER = '_';

export function useEchoTrainingSession({
  settings,
  sessions: historicalSessions,
  saveSession,
  showToast,
}: UseEchoTrainingSessionOptions): UseEchoTrainingSessionReturn {
  const setTrainingSessionActive = useAppStore((state) => state.setTrainingSessionActive);
  const audio = useTrainingAudio(settings);

  const [isTraining, setIsTraining] = useState(false);
  const [currentGroup, setCurrentGroup] = useState(0);
  const [sentGroups, setSentGroups] = useState<string[]>([]);
  const [currentCharacterIndex, setCurrentCharacterIndex] = useState(0);
  const [currentCharacterState, setCurrentCharacterState] = useState<EchoCharacterState>('idle');
  const [currentSymbols, setCurrentSymbols] = useState('');
  const [revealedCharacter, setRevealedCharacter] = useState<string | null>(null);
  const [currentGroupProgress, setCurrentGroupProgress] = useState<readonly EchoCharacterProgress[]>([]);
  const [correctCharacters, setCorrectCharacters] = useState(0);
  const [incorrectCharacters, setIncorrectCharacters] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [lastSessionResult, setLastSessionResult] = useState<EchoSessionResultSummary | null>(null);

  const isTrainingRef = useRef(false);
  const startedAtRef = useRef<number | null>(null);
  const activeAttemptRef = useRef<ActiveAttempt | null>(null);
  const characterStateRef = useRef<EchoCharacterState>('idle');
  const paddleStateRef = useRef<PaddleState>({ '.': false, '-': false });
  const keyerRunningRef = useRef(false);
  const lastKeyerSignalRef = useRef<MorseSignal | null>(null);
  const lastPressedPaddleRef = useRef<MorseSignal | null>(null);
  const squeezeLatchedRef = useRef(false);

  const resetKeyerState = useCallback((): void => {
    paddleStateRef.current = { '.': false, '-': false };
    keyerRunningRef.current = false;
    lastKeyerSignalRef.current = null;
    lastPressedPaddleRef.current = null;
    squeezeLatchedRef.current = false;
  }, []);

  const echoKeyerMode = settings.echoKeyerMode ?? 'manual';

  const settleActiveAttempt = useCallback((result: EchoAttemptResult): void => {
    const attempt = activeAttemptRef.current;
    if (!attempt || attempt.settled) return;
    attempt.settled = true;
    if (attempt.timeoutId !== undefined) {
      try { window.clearTimeout(attempt.timeoutId); } catch { /* no-op */ }
    }
    activeAttemptRef.current = null;
    resetKeyerState();
    attempt.resolve(result);
  }, [resetKeyerState]);

  useEffect(() => { characterStateRef.current = currentCharacterState; }, [currentCharacterState]);

  useEffect(() => {
    return (): void => {
      audio.trainingAbortRef.current = true;
      isTrainingRef.current = false;
      resetKeyerState();
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
        audioContext, character,
        {
          charWpmMin: Math.max(1, settings.charWpmMin),
          charWpmMax: Math.max(1, settings.charWpmMax),
          effectiveWpmMin: Math.max(1, settings.effectiveWpmMin),
          effectiveWpmMax: Math.max(1, settings.effectiveWpmMax),
          extraWordSpaceMultiplier: Math.max(0.1, settings.extraWordSpaceMultiplier ?? 1),
          sideTone: pickTrainingToneHz(settings),
          steepness: settings.steepness,
          envelopeSmoothing: settings.envelopeSmoothing ?? 0,
          volumeMin: settings.volumeMin, volumeMax: settings.volumeMax,
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
          effectiveWpmMin: Math.max(1, settings.charWpmMin),
          effectiveWpmMax: Math.max(1, settings.charWpmMax),
          extraWordSpaceMultiplier: 1,
          sideTone: settings.sideToneMin,
          steepness: settings.steepness,
          envelopeSmoothing: settings.envelopeSmoothing ?? 0,
          volumeMin: settings.volumeMax, volumeMax: settings.volumeMax,
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

  const chooseNextIambicSignal = useCallback((): MorseSignal | null => {
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

  const runIambicKeyer = useCallback(async (): Promise<void> => {
    if (keyerRunningRef.current || audio.trainingAbortRef.current || !isTrainingRef.current || !activeAttemptRef.current) return;
    keyerRunningRef.current = true;
    try {
      while (!audio.trainingAbortRef.current && isTrainingRef.current && activeAttemptRef.current) {
        const signal = chooseNextIambicSignal();
        if (!signal) break;
        lastKeyerSignalRef.current = signal;
        dispatchSignal(signal);
        const dotMs = keyerDotMs();
        await audio.sleepCancelable(signal === '.' ? dotMs * 2 : dotMs * 4, audio.sessionIdRef.current);
      }
    } finally { keyerRunningRef.current = false; }
  }, [chooseNextIambicSignal, dispatchSignal, keyerDotMs, audio]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      const signal = keyboardInputToMorseSignal({ key: event.key, code: event.code });
      if (!signal || !isTrainingRef.current || audio.trainingAbortRef.current || !activeAttemptRef.current) return;
      event.preventDefault();
      event.stopPropagation();
      if (echoKeyerMode === 'iambic-b') {
        paddleStateRef.current[signal] = true;
        lastPressedPaddleRef.current = signal;
        if (paddleStateRef.current['.'] && paddleStateRef.current['-']) squeezeLatchedRef.current = true;
        void runIambicKeyer();
        return;
      }
      dispatchSignal(signal);
    };
    const handleKeyUp = (event: KeyboardEvent): void => {
      if (echoKeyerMode !== 'iambic-b') return;
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
  }, [dispatchSignal, echoKeyerMode, runIambicKeyer, audio]);

  const waitForAttempt = useCallback(
    (targetCharacter: string, expectedPattern: string, sessionId: number): Promise<EchoAttemptResult> =>
      new Promise((resolve) => {
        if (audio.trainingAbortRef.current || audio.sessionIdRef.current !== sessionId) {
          resolve({ outcome: 'aborted', receivedCharacter: '', durationMs: 0 });
          return;
        }
        const attempt: ActiveAttempt = {
          expectedPattern, targetCharacter, startedAt: Date.now(), resolve,
          pattern: '', settled: false,
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
      groupsSent: readonly string[], groupsReceived: readonly string[],
      groupResponseTimes: readonly number[],
      nextCorrectChars: number, nextIncorrectChars: number,
    ): Promise<void> => {
      if (groupsSent.length === 0) return;
      const groupTimings = groupsSent.map((sent, i) => {
        const ms = Math.max(0, groupResponseTimes[i] ?? 0);
        return { timeToCompleteMs: ms, ...(sent.length > 0 ? { perCharMs: Math.round(ms / sent.length) } : {}) };
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
      await saveSession(result as unknown as Record<string, unknown>);
    },
    [saveSession],
  );

  const stopTraining = useCallback((): void => {
    audio.trainingAbortRef.current = true;
    isTrainingRef.current = false;
    resetKeyerState();
    setIsTraining(false);
    setTrainingSessionActive(false);
    settleActiveAttempt({ outcome: 'aborted', receivedCharacter: '', durationMs: 0 });
    audio.stopAudio();
    setCurrentCharacterState('idle');
  }, [resetKeyerState, setTrainingSessionActive, settleActiveAttempt, audio]);

  const dismissResults = useCallback((): void => {
    setShowResults(false);
    setLastSessionResult(null);
  }, []);

  const startTraining = useCallback(async (): Promise<void> => {
    if (isTrainingRef.current) return;

    try {
      audio.stopAudio();
      audio.trainingAbortRef.current = false;
      resetKeyerState();
      setShowResults(false); setLastSessionResult(null);
      setCurrentGroup(0); setCurrentCharacterIndex(0); setCurrentCharacterState('idle');
      setCurrentSymbols(''); setRevealedCharacter(null); setCurrentGroupProgress([]);
      setCorrectCharacters(0); setIncorrectCharacters(0);

      audio.ensureAudioReady();

      const mySession = audio.sessionIdRef.current + 1;
      audio.sessionIdRef.current = mySession;
      startedAtRef.current = Date.now();
      isTrainingRef.current = true;
      setIsTraining(true);
      setTrainingSessionActive(true);

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
        if (!group || audio.trainingAbortRef.current || audio.sessionIdRef.current !== mySession) break;
        setCurrentGroup(gi);
        setCurrentGroupProgress(group.split('').map(() => ({ revealedCharacter: null, status: 'pending' as const })));
        if (gi > 0) await audio.sleepCancelable(computeTrainingGroupGapMs(settings), mySession);

        let receivedGroup = '';
        let groupTimeMs = 0;

        for (let ci = 0; ci < group.length; ci += 1) {
          const target = group[ci];
          if (!target || audio.trainingAbortRef.current || audio.sessionIdRef.current !== mySession) break;
          setCurrentCharacterIndex(ci);
          setCurrentCharacterState('playing');
          setCurrentSymbols(''); setRevealedCharacter(null);

          await playCharacter(target, mySession);
          if (audio.trainingAbortRef.current || audio.sessionIdRef.current !== mySession) break;
          const expectedPattern = MORSE_CODE[target] ?? '';
          if (!expectedPattern) continue;

          setCurrentCharacterState('awaiting');
          const attemptResult = await waitForAttempt(target, expectedPattern, mySession);
          if (attemptResult.outcome === 'aborted' || audio.trainingAbortRef.current || audio.sessionIdRef.current !== mySession) break;

          const success = attemptResult.outcome === 'correct';
          const normalizedReceived = success ? target : attemptResult.receivedCharacter || ERROR_PLACEHOLDER;
          receivedGroup += normalizedReceived;
          groupTimeMs += attemptResult.durationMs;
          nextCorrect += success ? 1 : 0;
          nextIncorrect += success ? 0 : 1;
          setCorrectCharacters(nextCorrect);
          setIncorrectCharacters(nextIncorrect);
          setRevealedCharacter(target);
          setCurrentCharacterState(success ? 'correct' : 'error');
          setCurrentGroupProgress((prev) =>
            prev.map((item, idx) => idx === ci ? { revealedCharacter: target, status: success ? 'correct' : 'error' } : item),
          );
          await audio.sleepCancelable(FEEDBACK_DELAY_MS, mySession);
        }
        receivedGroups.push(receivedGroup);
        groupResponseTimes.push(groupTimeMs);
      }

      isTrainingRef.current = false;
      setIsTraining(false);
      setTrainingSessionActive(false);
      resetKeyerState();
      audio.stopAudio();
      setCurrentCharacterState('idle');
      setCurrentSymbols('');

      if (!audio.trainingAbortRef.current && audio.sessionIdRef.current === mySession) {
        await processResults(groups, receivedGroups, groupResponseTimes, nextCorrect, nextIncorrect);
      }
    } catch (error) {
      console.error('[EchoTraining] Unexpected training error:', error);
      showToast({ message: `Echo training error: ${ensureAppError(error).message}`, type: 'error' });
      stopTraining();
    }
  }, [historicalSessions, playCharacter, processResults, resetKeyerState, settings, showToast, audio, stopTraining, waitForAttempt, setTrainingSessionActive]);

  return {
    isTraining, currentGroup, sentGroups, currentCharacterIndex, currentCharacterState,
    currentSymbols, revealedCharacter, currentGroupProgress, correctCharacters, incorrectCharacters,
    sendingScore: correctCharacters - incorrectCharacters,
    showResults, lastSessionResult, startTraining, stopTraining, dismissResults,
  };
}

export { MORSE_DASH_KEY, MORSE_DOT_KEY };
