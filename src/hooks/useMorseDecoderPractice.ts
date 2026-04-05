import { useCallback, useEffect, useRef, useState } from 'react';

import {
  playMorseCodeControlled,
  resumeAudioContextFromUserGesture,
} from '@/lib/morseAudio';
import {
  decodeMorsePattern,
  keyboardInputToMorseSignal,
  type MorseSignal,
} from '@/lib/morseSignals';
import { computeMorseDotMsFromSettings } from '@/lib/training/morseTiming';
import { sleepCancelablePolled } from '@/lib/training/sleepCancelablePolled';
import type { TrainingSettings } from '@/types';

interface PaddleState {
  readonly '.': boolean;
  readonly '-': boolean;
}

const INVALID_PLACEHOLDER = '\uFFFD';
const MAX_SEGMENTS = 96;

export interface MorseDecoderSegment {
  readonly id: string;
  readonly display: string;
}

export interface UseMorseDecoderPracticeOptions {
  readonly enabled: boolean;
  readonly settings: TrainingSettings;
}

export interface UseMorseDecoderPracticeReturn {
  readonly segments: readonly MorseDecoderSegment[];
  readonly livePattern: string;
  readonly clear: () => void;
}

export function useMorseDecoderPractice({
  enabled,
  settings,
}: UseMorseDecoderPracticeOptions): UseMorseDecoderPracticeReturn {
  const [segments, setSegments] = useState<readonly MorseDecoderSegment[]>([]);
  const [livePattern, setLivePattern] = useState('');

  const sessionIdRef = useRef(0);
  const abortRef = useRef(false);
  const segmentIdRef = useRef(0);
  const patternBufferRef = useRef('');
  const lastCommitAtRef = useRef<number | null>(null);
  const letterGapTimerRef = useRef<number | undefined>(undefined);

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

  const resetPaddleHardware = useCallback((): void => {
    paddleStateRef.current = { '.': false, '-': false };
    keyerRunningRef.current = false;
    resetKeyerMemory();
  }, [resetKeyerMemory]);

  const clearLetterTimer = useCallback((): void => {
    if (letterGapTimerRef.current !== undefined) {
      window.clearTimeout(letterGapTimerRef.current);
      letterGapTimerRef.current = undefined;
    }
  }, []);

  const appendSegment = useCallback((display: string): void => {
    const id = `d-${segmentIdRef.current}`;
    segmentIdRef.current += 1;
    setSegments((prev) => {
      const next = [...prev, { id, display }];
      return next.length > MAX_SEGMENTS ? next.slice(-MAX_SEGMENTS) : next;
    });
  }, []);

  const commitBufferedPattern = useCallback((): void => {
    const pattern = patternBufferRef.current;
    patternBufferRef.current = '';
    setLivePattern('');
    if (pattern.length === 0) {
      return;
    }
    const decoded = decodeMorsePattern(pattern);
    const now = Date.now();
    const dotMs = computeMorseDotMsFromSettings(settings);
    const wordGapMs = dotMs * 7;
    if (lastCommitAtRef.current !== null && now - lastCommitAtRef.current >= wordGapMs) {
      appendSegment(' ');
    }
    lastCommitAtRef.current = now;
    appendSegment(decoded ?? INVALID_PLACEHOLDER);
  }, [appendSegment, settings]);

  const scheduleLetterCommit = useCallback((): void => {
    clearLetterTimer();
    const dotMs = computeMorseDotMsFromSettings(settings);
    const letterGapMs = dotMs * 3;
    letterGapTimerRef.current = window.setTimeout(() => {
      letterGapTimerRef.current = undefined;
      commitBufferedPattern();
    }, letterGapMs);
  }, [clearLetterTimer, commitBufferedPattern, settings]);

  const audioContextRef = useRef<AudioContext | null>(null);

  const playInputFeedback = useCallback(
    async (signal: '.' | '-', sessionId: number): Promise<void> => {
      if (abortRef.current || sessionIdRef.current !== sessionId) return;
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      resumeAudioContextFromUserGesture(audioContextRef.current);
      await playMorseCodeControlled(
        audioContextRef.current,
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
          volumeMin: settings.volumeMax,
          volumeMax: settings.volumeMax,
          linkVolume: true,
        },
        () => abortRef.current || sessionIdRef.current !== sessionId,
      );
    },
    [settings],
  );

  const dispatchSignal = useCallback(
    (signal: MorseSignal, sessionId: number): void => {
      if (abortRef.current || sessionIdRef.current !== sessionId) return;
      clearLetterTimer();
      patternBufferRef.current = `${patternBufferRef.current}${signal}`;
      setLivePattern(patternBufferRef.current);
      void playInputFeedback(signal, sessionId);
    },
    [clearLetterTimer, playInputFeedback],
  );

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
    if (keyerRunningRef.current || abortRef.current || !enabled) return;
    const sessionId = sessionIdRef.current;
    keyerRunningRef.current = true;
    try {
      while (!abortRef.current && enabled && sessionIdRef.current === sessionId) {
        const signal = chooseNextPaddleSignal();
        if (!signal) break;
        lastKeyerSignalRef.current = signal;
        dispatchSignal(signal, sessionId);
        const dotMs = computeMorseDotMsFromSettings(settings);
        await sleepCancelablePolled(
          signal === '.' ? dotMs * 2 : dotMs * 4,
          () => abortRef.current || sessionIdRef.current !== sessionId,
        );
      }
    } finally {
      keyerRunningRef.current = false;
      if (enabled && sessionIdRef.current === sessionId && !abortRef.current) {
        scheduleLetterCommit();
      }
    }
  }, [chooseNextPaddleSignal, dispatchSignal, enabled, scheduleLetterCommit, settings]);

  useEffect(() => {
    if (!enabled) {
      abortRef.current = true;
      sessionIdRef.current += 1;
      clearLetterTimer();
      resetPaddleHardware();
      return;
    }
    abortRef.current = false;
    const handleKeyDown = (event: KeyboardEvent): void => {
      const signal = keyboardInputToMorseSignal({ key: event.key, code: event.code });
      // Do not compare sessionIdRef to a value captured when this effect ran: clear() bumps the
      // ref to cancel an in-flight keyer, and listeners must keep accepting keys afterward.
      if (!signal || abortRef.current) return;
      if (event.repeat) return;
      event.preventDefault();
      event.stopPropagation();
      clearLetterTimer();
      paddleStateRef.current = { ...paddleStateRef.current, [signal]: true };
      lastPressedPaddleRef.current = signal;
      if (paddleStateRef.current['.'] && paddleStateRef.current['-']) {
        squeezeLatchedRef.current = true;
      }
      void runPaddleKeyer();
    };
    const handleKeyUp = (event: KeyboardEvent): void => {
      const signal = keyboardInputToMorseSignal({ key: event.key, code: event.code });
      if (!signal) return;
      event.preventDefault();
      event.stopPropagation();
      paddleStateRef.current = { ...paddleStateRef.current, [signal]: false };
    };
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    return (): void => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
    };
  }, [enabled, clearLetterTimer, resetPaddleHardware, runPaddleKeyer]);

  const clear = useCallback((): void => {
    sessionIdRef.current += 1;
    clearLetterTimer();
    patternBufferRef.current = '';
    lastCommitAtRef.current = null;
    resetPaddleHardware();
    setLivePattern('');
    setSegments([]);
  }, [clearLetterTimer, resetPaddleHardware]);

  useEffect(() => {
    return (): void => {
      abortRef.current = true;
      sessionIdRef.current += 1;
      clearLetterTimer();
      resetPaddleHardware();
      try {
        audioContextRef.current?.close().catch(() => {});
      } catch {
        /* no-op */
      }
      audioContextRef.current = null;
    };
  }, [clearLetterTimer, resetPaddleHardware]);

  return { segments, livePattern, clear };
}
