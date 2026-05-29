'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

import type { FormTrainingSettings } from '@/components/ui/forms/TrainingSettingsForm';
import {
  HelpChip,
  ListeningSourcePanel,
  ModeTabButton,
  PlaybackMeta,
  type TextPlayerMode,
} from '@/components/ui/training/text-player-ui';
import { useTrainingSessionLock } from '@/hooks/useTrainingSessionLock';
import { clampExtraSpacingMultiplier } from '@/lib/extraSpacing';
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
  const [playerMode, setPlayerMode] = useState<TextPlayerMode>('playText');
  const [showPlayTextHelp, setShowPlayTextHelp] = useState<boolean>(false);
  const [showListeningHelp, setShowListeningHelp] = useState<boolean>(false);
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

  const isListeningPractice = playerMode === 'listeningPractice';
  const showTextEntry = playerMode === 'playText' || !playerRandomizeLetters;

  const charWpmLabel =
    settings.charWpmMin === settings.charWpmMax
      ? String(settings.charWpmMin)
      : `${settings.charWpmMin}–${settings.charWpmMax}`;
  const effWpmLabel =
    settings.effectiveWpmMin === settings.effectiveWpmMax
      ? String(settings.effectiveWpmMin)
      : `${settings.effectiveWpmMin}–${settings.effectiveWpmMax}`;

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

    // Request wake lock for listening practice (after audio unlock — wake lock is async)
    if (isListeningPractice) {
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
        // Loop back to start in listening practice
        if (isListeningPractice) {
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
              extraWordSpaceMultiplier: clampExtraSpacingMultiplier(settings.extraWordSpaceMultiplier),
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
    if (isListeningPractice) {
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
          extraWordSpaceMultiplier: clampExtraSpacingMultiplier(settings.extraWordSpaceMultiplier),
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
        extraWordSpaceMultiplier: clampExtraSpacingMultiplier(settings.extraWordSpaceMultiplier),
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

  const handleModeChange = (next: TextPlayerMode): void => {
    if (next === playerMode) {
      return;
    }
    if (isPlaying) {
      void handleStop();
    }
    setPlayerMode(next);
  };

  const listeningStatusLine =
    isListeningPractice && isPlaying
      ? playerRandomizeLetters
        ? `Listening — random letter ${currentLetterIndex}`
        : `Listening — letter ${currentLetterIndex} of ${text.replace(/\s+/g, '').length || 1}`
      : undefined;

  const playDisabled =
    isListeningPractice
      ? !playerRandomizeLetters && !text.trim()
      : !text.trim();

  const primaryActionLabel = isListeningPractice
    ? isPlaying
      ? 'Stop listening'
      : 'Start listening'
    : isPlaying
      ? 'Stop playback'
      : 'Play text';

  return (
    <div className="space-y-5 sm:space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 px-4 py-4 sm:px-5 sm:py-5">
        <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">Text Player</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
          Hear Morse from typed text, or practice copy-free listening one letter at a time. Speed,
          tone, and alphabet follow your training settings.
        </p>
      </header>

      <div
        role="tablist"
        aria-label="Text player mode"
        className="grid grid-cols-1 gap-2 rounded-2xl border border-slate-200 bg-slate-100/80 p-2 sm:grid-cols-2"
      >
        <ModeTabButton
          mode="playText"
          active={playerMode === 'playText'}
          disabled={isPlaying}
          title="Play text"
          subtitle="Send your message as one continuous transmission"
          onSelect={() => handleModeChange('playText')}
        />
        <ModeTabButton
          mode="listeningPractice"
          active={playerMode === 'listeningPractice'}
          disabled={isPlaying}
          title="Listening practice"
          subtitle="One letter at a time — ideal for head-copy drills"
          onSelect={() => handleModeChange('listeningPractice')}
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-white to-slate-50 shadow-sm">
        <div
          role="tabpanel"
          id={`text-player-panel-${playerMode}`}
          aria-labelledby={`text-player-tab-${playerMode}`}
          className="space-y-4 p-4 sm:space-y-5 sm:p-5"
        >
          {playerMode === 'playText' ? (
            <HelpChip
              expanded={showPlayTextHelp}
              onToggle={() => setShowPlayTextHelp((value) => !value)}
              title="How play text works"
            >
              <p>
                Type or paste any text. Spaces add extra spacing between words (see{' '}
                <span className="font-semibold">Extra spacing</span> in settings). Press{' '}
                <span className="font-semibold">Enter</span> to append a line of random groups from
                your current Koch / character settings. Use <span className="font-semibold">Pre-fill</span>{' '}
                for several lines at once, or download a WAV to listen offline.
              </p>
            </HelpChip>
          ) : (
            <HelpChip
              expanded={showListeningHelp}
              onToggle={() => setShowListeningHelp((value) => !value)}
              title="How listening practice works"
            >
              <ul className="list-disc space-y-2 pl-5">
                <li>
                  Plays <span className="font-semibold">one character</span> at a time, then pauses
                  before the next.
                </li>
                <li>
                  Choose random letters from your training alphabet, or your own text — one
                  character at a time.
                </li>
                <li>
                  With random letters you can press Start right away; with your own text, type the
                  letters below and playback loops when it reaches the end.
                </li>
                <li>
                  Repeats, pause, speech, and random vs. your own letters are in Settings →{' '}
                  <span className="font-semibold">Player Listening Practice</span>.
                </li>
              </ul>
            </HelpChip>
          )}

          {playerMode === 'listeningPractice' && (
            <ListeningSourcePanel
              randomizeLetters={playerRandomizeLetters}
              repeatCount={playerLetterRepeatCount}
              delaySeconds={playerDelaySeconds}
              announceLetters={playerAnnounceLetters}
              wakeLockSupported={wakeLockSupported}
              wakeLockActive={wakeLockActive}
            />
          )}

          {showTextEntry && (
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-800 sm:text-base">
                {playerMode === 'playText'
                  ? 'Text to transmit'
                  : 'Letters to practice (loops in order)'}
              </span>
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={playerMode === 'playText' ? handleKeyDown : undefined}
                placeholder={
                  playerMode === 'playText'
                    ? 'Type text here… Press Enter to add a line of random groups'
                    : 'e.g. ABCDE — spaces are ignored; one letter plays at a time'
                }
                className="min-h-[10rem] w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base leading-relaxed text-slate-900 shadow-inner focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:min-h-[11rem]"
              />
            </label>
          )}

          <PlaybackMeta
            charWpmLabel={charWpmLabel}
            effWpmLabel={effWpmLabel}
            toneHz={toneHz}
            extraSpacing={clampExtraSpacingMultiplier(settings.extraWordSpaceMultiplier)}
            durationSec={durationSec}
            statusLine={listeningStatusLine}
          />

          <div className="flex flex-col gap-3 border-t border-slate-200/80 pt-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {!isPlaying ? (
                <button
                  type="button"
                  onClick={() => void handlePlay()}
                  disabled={playDisabled}
                  className="min-h-[3rem] flex-1 rounded-xl bg-emerald-600 px-5 py-3 text-base font-bold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-[12rem]"
                >
                  ▶ {primaryActionLabel}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleStop()}
                  className="min-h-[3rem] flex-1 rounded-xl bg-rose-600 px-5 py-3 text-base font-bold text-white shadow-sm hover:bg-rose-700 sm:min-w-[12rem]"
                >
                  ■ {primaryActionLabel}
                </button>
              )}
            </div>

            {playerMode === 'playText' ? (
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                <button
                  type="button"
                  onClick={() => void handleDownload()}
                  disabled={!text.trim() || isPlaying || isRendering}
                  className="min-h-[2.75rem] rounded-xl border border-indigo-700 bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-1"
                  title="Download WAV"
                >
                  {isRendering ? 'Preparing…' : '⬇ Download WAV'}
                </button>
                <button
                  type="button"
                  onClick={handlePrefill}
                  disabled={isPlaying}
                  className="min-h-[2.75rem] rounded-xl border border-blue-700 bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-1"
                  title="Pre-fill with groups based on current settings"
                >
                  Pre-fill groups
                </button>
                <button
                  type="button"
                  onClick={handlePrefillAlphabet}
                  disabled={isPlaying}
                  className="min-h-[2.75rem] rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-1"
                  title="Pre-fill with A–Z"
                >
                  Alphabet A–Z
                </button>
                <button
                  type="button"
                  onClick={() => setText('')}
                  disabled={isPlaying}
                  className="min-h-[2.75rem] rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-1"
                >
                  Clear text
                </button>
              </div>
            ) : (
              showTextEntry && (
                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                  <button
                    type="button"
                    onClick={handlePrefillAlphabet}
                    disabled={isPlaying}
                    className="min-h-[2.75rem] rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-1"
                  >
                    Fill A–Z
                  </button>
                  <button
                    type="button"
                    onClick={() => setText('')}
                    disabled={isPlaying}
                    className="min-h-[2.75rem] rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-1"
                  >
                    Clear text
                  </button>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
