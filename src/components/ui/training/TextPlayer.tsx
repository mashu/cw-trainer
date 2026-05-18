'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

import type { FormTrainingSettings } from '@/components/ui/forms/TrainingSettingsForm';
import { useTrainingSessionLock } from '@/hooks/useTrainingSessionLock';
import {
  playMorseCodeControlled,
  renderMorseToWavBlob,
  ensureContext,
  resumeAudioContextFromUserGesture,
} from '@/lib/morseAudio';
import { LCWO_SEQUENCE } from '@/lib/morseConstants';
import { computeCharPool } from '@/lib/trainingUtils';

interface TextPlayerProps {
  settings: FormTrainingSettings;
  initialText?: string;
}

// Wake Lock API types (not in all TypeScript versions)
// Using type instead of interface to avoid conflicts with built-in DOM types
type WakeLockSentinel = {
  release(): Promise<void>;
  released: boolean;
  type: 'screen';
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
  dispatchEvent(event: Event): boolean;
};

type WakeLock = {
  request(type: 'screen'): Promise<WakeLockSentinel>;
};

// Use intersection type instead of extending to avoid type conflicts
type NavigatorWithWakeLock = Navigator & {
  wakeLock?: WakeLock;
};

export function TextPlayer({ settings, initialText }: TextPlayerProps): JSX.Element {
  const { takeLock: takeTextPlayerLock, releaseLock: releaseTextPlayerLock } =
    useTrainingSessionLock();

  const [text, setText] = useState<string>(initialText || 'CQ CQ DE TEST');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [durationSec, setDurationSec] = useState<number>(0);
  const [isRendering, setIsRendering] = useState<boolean>(false);
  const [isContinuousMode, setIsContinuousMode] = useState<boolean>(false);
  const [wakeLockSupported, setWakeLockSupported] = useState<boolean>(false);
  const [wakeLockActive, setWakeLockActive] = useState<boolean>(false);
  const [currentLetterIndex, setCurrentLetterIndex] = useState<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const abortRef = useRef<boolean>(false);
  const timerRef = useRef<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const continuousIndexRef = useRef<number>(0);
  const continuousTimeoutRef = useRef<number | null>(null);
  const isPlayingRef = useRef<boolean>(false);

  const playerDelaySeconds = Math.max(0, Math.min(60, settings.playerDelaySeconds ?? 2));
  const playerLetterRepeatCount = Math.max(
    1,
    Math.min(10, Math.trunc(settings.playerLetterRepeatCount ?? 1)),
  );
  const playerAnnounceLetters = settings.playerAnnounceLetters ?? false;
  const playerRandomizeLetters = settings.playerRandomizeLetters ?? false;
  const playerSpeechVoiceURI = settings.playerSpeechVoiceURI ?? '';

  const toneHz = useMemo(() => {
    const min = Math.max(100, settings.sideToneMin);
    const max = Math.max(min, settings.sideToneMax);
    if (min === max) return min;
    return Math.floor(min + Math.random() * (max - min + 1));
  }, [settings.sideToneMin, settings.sideToneMax]);

  const generateLineOfGroups = (): string => {
    const charPool = computeCharPool({
      kochLevel: settings.kochLevel,
      ...(settings.charSetMode !== undefined ? { charSetMode: settings.charSetMode } : {}),
      ...(settings.digitsLevel !== undefined ? { digitsLevel: settings.digitsLevel } : {}),
      ...(settings.customSet && settings.customSet.length > 0
        ? { customSet: [...settings.customSet] }
        : {}),
      ...(settings.customSequence && settings.customSequence.length > 0
        ? { customSequence: [...settings.customSequence] }
        : {}),
      ...(settings.slidingWindowStart !== undefined
        ? { slidingWindowStart: settings.slidingWindowStart }
        : {}),
      ...(settings.slidingWindowEnd !== undefined
        ? { slidingWindowEnd: settings.slidingWindowEnd }
        : {}),
    });
    const safePool =
      Array.isArray(charPool) && charPool.length > 0
        ? charPool
        : LCWO_SEQUENCE.slice(0, Math.min((settings.kochLevel || 1) + 1, LCWO_SEQUENCE.length));

    const numGroups = Math.max(1, settings.numGroups || 5);
    const groups: string[] = [];

    for (let i = 0; i < numGroups; i++) {
      let groupSize: number;
      if (settings.charsPerGroup && settings.charsPerGroup > 0) {
        groupSize = settings.charsPerGroup;
      } else {
        const minSize = Math.max(1, settings.minGroupSize || 2);
        const maxSize = Math.max(minSize, settings.maxGroupSize || 3);
        groupSize = Math.floor(Math.random() * (maxSize - minSize + 1)) + minSize;
      }

      let group = '';
      for (let j = 0; j < groupSize; j++) {
        group += safePool[Math.floor(Math.random() * safePool.length)];
      }
      groups.push(group);
    }

    return groups.join(' ');
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    const { selectionStart, selectionEnd } = textarea;
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      const before = text.substring(0, selectionStart);
      const after = text.substring(selectionEnd);
      const newLine = generateLineOfGroups();
      const needsNewlineBefore = before && !before.endsWith('\n');
      const newText =
        before + (needsNewlineBefore ? '\n' : '') + newLine + (after ? '\n' + after : '');
      setText(newText);
      // Restore cursor position after state update
      setTimeout(() => {
        const newPos =
          selectionStart + newLine.length + (needsNewlineBefore ? 1 : 0) + (after ? 1 : 0);
        textarea.setSelectionRange(newPos, newPos);
        textarea.focus();
      }, 0);
    }
  };

  const handlePrefill = (): void => {
    const lines: string[] = [];
    const numLines = 3;
    for (let i = 0; i < numLines; i++) {
      lines.push(generateLineOfGroups());
    }
    setText(lines.join('\n'));
  };

  const handlePrefillAlphabet = (): void => {
    setText('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
  };

  const getListeningPracticePool = (): readonly string[] => {
    const charPool = computeCharPool({
      kochLevel: settings.kochLevel,
      ...(settings.charSetMode !== undefined ? { charSetMode: settings.charSetMode } : {}),
      ...(settings.digitsLevel !== undefined ? { digitsLevel: settings.digitsLevel } : {}),
      ...(settings.customSet && settings.customSet.length > 0
        ? { customSet: [...settings.customSet] }
        : {}),
      ...(settings.customSequence && settings.customSequence.length > 0
        ? { customSequence: [...settings.customSequence] }
        : {}),
      ...(settings.slidingWindowStart !== undefined
        ? { slidingWindowStart: settings.slidingWindowStart }
        : {}),
      ...(settings.slidingWindowEnd !== undefined
        ? { slidingWindowEnd: settings.slidingWindowEnd }
        : {}),
    });

    if (Array.isArray(charPool) && charPool.length > 0) {
      return charPool;
    }

    return LCWO_SEQUENCE.slice(0, Math.min((settings.kochLevel || 1) + 1, LCWO_SEQUENCE.length));
  };

  const pickRandomListeningCharacter = (): string | null => {
    const pool = getListeningPracticePool();
    const character = pool[Math.floor(Math.random() * pool.length)];
    return character ?? null;
  };

  const speakCharacter = (char: string): Promise<void> => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(char.toUpperCase());
      const selectedVoice = window.speechSynthesis
        .getVoices()
        .find((voice) => voice.voiceURI === playerSpeechVoiceURI);
      let fallbackTimer: number | null = null;
      const finish = (): void => {
        if (fallbackTimer != null) {
          window.clearTimeout(fallbackTimer);
          fallbackTimer = null;
        }
        resolve();
      };
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
      utterance.rate = 0.9;
      utterance.onend = finish;
      utterance.onerror = finish;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
      fallbackTimer = window.setTimeout(finish, 2500) as unknown as number;
    });
  };

  const sleepDuringContinuousPlayback = (ms: number): Promise<boolean> => {
    if (ms <= 0) {
      return Promise.resolve(!abortRef.current && isPlayingRef.current);
    }

    return new Promise((resolve) => {
      continuousTimeoutRef.current = window.setTimeout(() => {
        continuousTimeoutRef.current = null;
        resolve(!abortRef.current && isPlayingRef.current);
      }, ms) as unknown as number;
    });
  };

  // Check for Wake Lock API support
  useEffect(() => {
    const nav = navigator as NavigatorWithWakeLock;
    setWakeLockSupported('wakeLock' in nav);
  }, []);

  // Handle page visibility changes to resume AudioContext
  useEffect(() => {
    const handleVisibilityChange = async (): Promise<void> => {
      if (document.visibilityState === 'visible' && audioContextRef.current) {
        try {
          await ensureContext(audioContextRef.current);
        } catch {
          // Ignore errors
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return (): void => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Request wake lock when continuous mode starts
  const requestWakeLock = async (): Promise<void> => {
    if (!wakeLockSupported) return;
    try {
      const nav = navigator as NavigatorWithWakeLock;
      const sentinel = await nav.wakeLock!.request('screen');
      wakeLockRef.current = sentinel;
      setWakeLockActive(true);

      // Handle release events (e.g., user switches tabs)
      sentinel.addEventListener('release', () => {
        setWakeLockActive(false);
        wakeLockRef.current = null;
      });
    } catch (err) {
      console.warn('Wake Lock request failed:', err);
      setWakeLockActive(false);
    }
  };

  // Release wake lock
  const releaseWakeLock = async (): Promise<void> => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
      } catch {
        // Ignore errors
      }
      wakeLockRef.current = null;
      setWakeLockActive(false);
    }
  };

  useEffect(() => {
    return (): void => {
      abortRef.current = true;
      releaseTextPlayerLock();
      try {
        stopRef.current?.();
      } catch {
        /* no-op */
      }
      stopRef.current = null;
      try {
        window.speechSynthesis?.cancel();
      } catch {
        /* no-op */
      }
      try {
        if (timerRef.current != null) window.clearTimeout(timerRef.current);
      } catch {
        /* no-op */
      }
      timerRef.current = null;
      try {
        if (continuousTimeoutRef.current != null) window.clearTimeout(continuousTimeoutRef.current);
      } catch {
        /* no-op */
      }
      continuousTimeoutRef.current = null;
      void releaseWakeLock();
      try {
        audioContextRef.current?.close();
      } catch {
        /* no-op */
      }
      audioContextRef.current = null;
    };
  }, [releaseTextPlayerLock]);

  // Continuous mode: play letters one at a time for listen-only practice.
  const playContinuous = async (): Promise<void> => {
    if (!playerRandomizeLetters && !text.trim()) {
      return;
    }

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    const ctx = audioContextRef.current;
    resumeAudioContextFromUserGesture(ctx);

    // Request wake lock for continuous mode (after audio unlock — wake lock is async)
    if (isContinuousMode) {
      await requestWakeLock();
    }

    abortRef.current = false;
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* no-op */
    }
    isPlayingRef.current = true;
    setIsPlaying(true);
    takeTextPlayerLock();
    continuousIndexRef.current = 0;
    setCurrentLetterIndex(0);

    const playNextLetter = async (): Promise<void> => {
      if (abortRef.current || !isPlayingRef.current) {
        releaseTextPlayerLock();
        return;
      }

      const cleanText = text.replace(/\s+/g, '').trim();
      if (!playerRandomizeLetters && cleanText.length === 0) {
        isPlayingRef.current = false;
        setIsPlaying(false);
        await releaseWakeLock();
        releaseTextPlayerLock();
        return;
      }

      if (!playerRandomizeLetters && continuousIndexRef.current >= cleanText.length) {
        // Loop back to start in continuous mode
        if (isContinuousMode) {
          continuousIndexRef.current = 0;
          setCurrentLetterIndex(0);
        } else {
          isPlayingRef.current = false;
          setIsPlaying(false);
          await releaseWakeLock();
          releaseTextPlayerLock();
          return;
        }
      }

      const char = playerRandomizeLetters
        ? pickRandomListeningCharacter()
        : cleanText[continuousIndexRef.current];
      if (!char) {
        if (!playerRandomizeLetters) {
          continuousIndexRef.current++;
        }
        setCurrentLetterIndex(continuousIndexRef.current);
        const shouldContinue = await sleepDuringContinuousPlayback(playerDelaySeconds * 1000);
        if (shouldContinue) {
          void playNextLetter();
        }
        return;
      }

      try {
        setCurrentLetterIndex(continuousIndexRef.current + 1);

        for (let repeat = 0; repeat < playerLetterRepeatCount; repeat++) {
          if (abortRef.current || !isPlayingRef.current) {
            return;
          }
          await ensureContext(ctx);
          const { durationSec: d, stop } = await playMorseCodeControlled(
            ctx,
            char,
            {
              charWpmMin: Math.max(1, settings.charWpmMin),
              charWpmMax: Math.max(1, settings.charWpmMax),
              effectiveWpmMin: Math.max(1, settings.effectiveWpmMin),
              effectiveWpmMax: Math.max(1, settings.effectiveWpmMax),
              extraWordSpaceMultiplier: Math.max(0.1, settings.extraWordSpaceMultiplier ?? 1),
              sideTone: toneHz,
              steepness: settings.steepness,
              envelopeSmoothing: settings.envelopeSmoothing ?? 0,
              volumeMin: settings.volumeMin ?? 1,
              volumeMax: settings.volumeMax ?? 1,
              linkVolume: settings.linkVolume ?? true,
            },
            () => abortRef.current,
          );
          stopRef.current = stop;
          setDurationSec(d);
          const shouldContinue = await sleepDuringContinuousPlayback(Math.ceil(d * 1000));
          if (!shouldContinue) {
            return;
          }
        }

        if (playerAnnounceLetters) {
          await speakCharacter(char);
          if (abortRef.current || !isPlayingRef.current) {
            return;
          }
        }

        continuousIndexRef.current++;
        const shouldContinue = await sleepDuringContinuousPlayback(playerDelaySeconds * 1000);
        if (shouldContinue) {
          void playNextLetter();
        }
      } catch (err) {
        console.error('Error playing letter:', err);
        isPlayingRef.current = false;
        setIsPlaying(false);
        await releaseWakeLock();
        releaseTextPlayerLock();
      }
    };

    await playNextLetter();
  };

  // Normal mode: play entire text at once
  const handlePlay = async (): Promise<void> => {
    if (isContinuousMode) {
      await playContinuous();
      return;
    }

    if (!text.trim()) {
      return;
    }
    abortRef.current = false;
    setIsPlaying(true);
    takeTextPlayerLock();
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    const ctx = audioContextRef.current;
    try {
      await ensureContext(ctx);
      const { durationSec: d, stop } = await playMorseCodeControlled(
        ctx,
        text,
        {
          charWpmMin: Math.max(1, settings.charWpmMin),
          charWpmMax: Math.max(1, settings.charWpmMax),
          effectiveWpmMin: Math.max(1, settings.effectiveWpmMin),
          effectiveWpmMax: Math.max(1, settings.effectiveWpmMax),
          extraWordSpaceMultiplier: Math.max(0.1, settings.extraWordSpaceMultiplier ?? 1),
          sideTone: toneHz,
          steepness: settings.steepness,
          envelopeSmoothing: settings.envelopeSmoothing ?? 0,
          volumeMin: settings.volumeMin ?? 1,
          volumeMax: settings.volumeMax ?? 1,
          linkVolume: settings.linkVolume ?? true,
        },
        () => abortRef.current,
      );
      stopRef.current = stop;
      setDurationSec(d);
      try {
        if (timerRef.current != null) window.clearTimeout(timerRef.current);
      } catch {}
      timerRef.current = window.setTimeout(
        () => {
          setIsPlaying(false);
          releaseTextPlayerLock();
          stopRef.current = null;
          timerRef.current = null;
        },
        Math.ceil(d * 1000),
      ) as unknown as number;
    } catch {
      setIsPlaying(false);
      releaseTextPlayerLock();
    }
  };

  const handleStop = async (): Promise<void> => {
    abortRef.current = true;
    isPlayingRef.current = false;
    try {
      window.speechSynthesis?.cancel();
    } catch {}
    try {
      stopRef.current?.();
    } catch {}
    stopRef.current = null;
    try {
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
    } catch {}
    timerRef.current = null;
    try {
      if (continuousTimeoutRef.current != null) window.clearTimeout(continuousTimeoutRef.current);
    } catch {}
    continuousTimeoutRef.current = null;
    continuousIndexRef.current = 0;
    setCurrentLetterIndex(0);
    setIsPlaying(false);
    releaseTextPlayerLock();
    await releaseWakeLock();
  };

  const handleDownload = async (): Promise<void> => {
    if (!text.trim() || isRendering) {
      return;
    }
    setIsRendering(true);
    try {
      const blob = renderMorseToWavBlob(text, {
        charWpmMin: Math.max(1, settings.charWpmMin),
        charWpmMax: Math.max(1, settings.charWpmMax),
        effectiveWpmMin: Math.max(1, settings.effectiveWpmMin),
        effectiveWpmMax: Math.max(1, settings.effectiveWpmMax),
        extraWordSpaceMultiplier: Math.max(0.1, settings.extraWordSpaceMultiplier ?? 1),
        sideTone: toneHz,
        steepness: settings.steepness,
        envelopeSmoothing: settings.envelopeSmoothing ?? 0,
        sampleRate: 44100,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const preview = text.trim().slice(0, 24).replace(/\s+/g, '_');
      a.download = `morse_${preview || 'text'}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => {
        try {
          URL.revokeObjectURL(url);
        } catch {}
      }, 5000);
    } finally {
      setIsRendering(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">Text Player</h2>
          <p className="text-slate-600 text-sm mt-1">
            Type any text and play it as Morse using current settings.
          </p>
        </div>
      </div>

      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-white to-slate-50 border border-slate-200">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type text here... (Press Enter to generate a line of groups)"
          className="w-full h-40 sm:h-44 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />

        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-white to-indigo-50/40">
          <div className="flex flex-col gap-2 p-2.5 sm:flex-row sm:items-center sm:justify-between">
            <label
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 transition-colors ${
                isContinuousMode
                  ? 'border-indigo-200 bg-indigo-50 text-indigo-900'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-200'
              }`}
            >
              <input
                type="checkbox"
                checked={isContinuousMode}
                onChange={(e) => {
                  setIsContinuousMode(e.target.checked);
                  if (!e.target.checked && isPlaying) {
                    handleStop();
                  }
                }}
                disabled={isPlaying}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm font-semibold">Continuous listening</span>
            </label>
            {wakeLockSupported && (
              <span
                className={`w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  wakeLockActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {wakeLockActive ? 'Screen lock active' : 'Screen lock available'}
              </span>
            )}
          </div>
          {isContinuousMode && (
            <div className="flex flex-wrap gap-1.5 border-t border-slate-200/80 bg-white/65 px-2.5 py-2">
              <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                {playerRandomizeLetters ? 'Random current alphabet' : 'Typed text'}
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                {playerLetterRepeatCount}x, then {playerDelaySeconds}s pause
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                {playerAnnounceLetters ? 'Spoken after Morse' : 'Morse only'}
              </span>
            </div>
          )}
        </div>

        <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-slate-600">
            <div>
              Char WPM:{' '}
              {settings.charWpmMin === settings.charWpmMax
                ? settings.charWpmMin
                : `${settings.charWpmMin}-${settings.charWpmMax}`}{' '}
              • Eff WPM:{' '}
              {settings.effectiveWpmMin === settings.effectiveWpmMax
                ? settings.effectiveWpmMin
                : `${settings.effectiveWpmMin}-${settings.effectiveWpmMax}`}
            </div>
            <div>
              Tone: {toneHz} Hz • Extra Word Space: ×
              {Math.max(1, settings.extraWordSpaceMultiplier ?? 1)}
            </div>
            {durationSec > 0 && (
              <div className="text-[11px] text-slate-500">
                Last duration: ~{Math.round(durationSec)}s
              </div>
            )}
            {isContinuousMode && isPlaying && (
              <div className="text-[11px] text-indigo-600 font-medium">
                {playerRandomizeLetters
                  ? `Playing random letter ${currentLetterIndex}`
                  : `Playing letter ${currentLetterIndex} of ${
                      text.replace(/\s+/g, '').length || 1
                    }`}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isPlaying ? (
              <button
                onClick={handlePlay}
                disabled={!text.trim() && !(isContinuousMode && playerRandomizeLetters)}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ▶ Play
              </button>
            ) : (
              <button
                onClick={handleStop}
                className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700"
              >
                ■ Stop
              </button>
            )}
            <button
              onClick={handleDownload}
              disabled={!text.trim() || isPlaying || isRendering}
              className="px-3 py-2 rounded-lg bg-indigo-600 text-white border border-indigo-700 hover:bg-indigo-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              title="Download WAV"
            >
              {isRendering ? 'Preparing…' : '⬇ Download WAV'}
            </button>
            <button
              onClick={handlePrefill}
              disabled={isPlaying}
              className="px-3 py-2 rounded-lg bg-blue-600 text-white border border-blue-700 hover:bg-blue-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              title="Pre-fill with groups based on current settings"
            >
              Pre-fill
            </button>
            <button
              onClick={handlePrefillAlphabet}
              disabled={isPlaying}
              className="px-3 py-2 rounded-lg bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              title="Pre-fill with A-Z for listen-only practice"
            >
              Alphabet
            </button>
            <button
              onClick={() => setText('')}
              disabled={isPlaying}
              className="px-3 py-2 rounded-lg bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Clear
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
