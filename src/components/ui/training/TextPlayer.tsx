'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

import type { FormTrainingSettings } from '@/components/ui/forms/TrainingSettingsForm';
import {
  playMorseCodeControlled,
  renderMorseToWavBlob,
  ensureContext,
  resumeAudioContextFromUserGesture,
} from '@/lib/morseAudio';
import { LCWO_SEQUENCE } from '@/lib/morseConstants';
import { computeCharPool } from '@/lib/trainingUtils';
import { useAppStore } from '@/store';

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
  const acquireTrainingSessionLock = useAppStore((state) => state.acquireTrainingSessionLock);
  const releaseTrainingSessionLock = useAppStore((state) => state.releaseTrainingSessionLock);
  const textPlayerSessionLockHeldRef = useRef(false);
  const takeTextPlayerLock = (): void => {
    if (!textPlayerSessionLockHeldRef.current) {
      acquireTrainingSessionLock();
      textPlayerSessionLockHeldRef.current = true;
    }
  };
  const releaseTextPlayerLock = (): void => {
    if (textPlayerSessionLockHeldRef.current) {
      releaseTrainingSessionLock();
      textPlayerSessionLockHeldRef.current = false;
    }
  };

  const [text, setText] = useState<string>(initialText || 'CQ CQ DE TEST');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [durationSec, setDurationSec] = useState<number>(0);
  const [isRendering, setIsRendering] = useState<boolean>(false);
  const [isContinuousMode, setIsContinuousMode] = useState<boolean>(false);
  const [ttlSeconds, setTtlSeconds] = useState<number>(2); // Time between letters in continuous mode
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
      ...(settings.customSet && settings.customSet.length > 0 ? { customSet: [...settings.customSet] } : {}),
      ...(settings.customSequence && settings.customSequence.length > 0 ? { customSequence: [...settings.customSequence] } : {}),
      ...(settings.slidingWindowStart !== undefined ? { slidingWindowStart: settings.slidingWindowStart } : {}),
      ...(settings.slidingWindowEnd !== undefined ? { slidingWindowEnd: settings.slidingWindowEnd } : {}),
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
  }, []);

  // Continuous mode: play letters one at a time with TTL delay
  const playContinuous = async (): Promise<void> => {
    if (!text.trim()) {
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
    isPlayingRef.current = true;
    setIsPlaying(true);
    takeTextPlayerLock();
    continuousIndexRef.current = 0;
    setCurrentLetterIndex(0);

    const playNextLetter = async (): Promise<void> => {
      if (abortRef.current || !isPlayingRef.current) {
        if (!isContinuousMode) {
          await releaseWakeLock();
        }
        releaseTextPlayerLock();
        return;
      }

      const cleanText = text.replace(/\s+/g, '').trim();
      if (cleanText.length === 0) {
        isPlayingRef.current = false;
        setIsPlaying(false);
        await releaseWakeLock();
        releaseTextPlayerLock();
        return;
      }

      if (continuousIndexRef.current >= cleanText.length) {
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

      const char = cleanText[continuousIndexRef.current];
      if (!char) {
        continuousIndexRef.current++;
        setCurrentLetterIndex(continuousIndexRef.current);
        // Schedule next letter after TTL delay
        continuousTimeoutRef.current = window.setTimeout(
          playNextLetter,
          ttlSeconds * 1000,
        ) as unknown as number;
        return;
      }

      try {
        await ensureContext(ctx);
        setCurrentLetterIndex(continuousIndexRef.current + 1);
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
        
        continuousIndexRef.current++;
        
        // Schedule next letter after current letter finishes + TTL delay
        const totalDelay = Math.ceil(d * 1000) + (ttlSeconds * 1000);
        continuousTimeoutRef.current = window.setTimeout(
          playNextLetter,
          totalDelay,
        ) as unknown as number;
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

        {/* Continuous Mode Controls */}
        <div className="mt-3 p-3 bg-slate-100 rounded-lg border border-slate-200">
          <div className="flex items-center gap-3 mb-2">
            <label className="flex items-center gap-2 cursor-pointer">
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
                className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
              />
              <span className="text-sm font-medium text-slate-700">
                Continuous Mode (plays letters one at a time)
              </span>
            </label>
            {wakeLockSupported && (
              <span className="text-xs text-slate-500">
                {wakeLockActive ? '🔒 Screen lock active' : '🔓 Screen lock available'}
              </span>
            )}
          </div>
          {isContinuousMode && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-600">
                TTL (delay between letters):
              </label>
              <input
                type="number"
                min="0"
                max="60"
                step="0.1"
                value={ttlSeconds}
                onChange={(e) => setTtlSeconds(Math.max(0, Math.min(60, parseFloat(e.target.value) || 0)))}
                disabled={isPlaying}
                className="w-20 px-2 py-1 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <span className="text-xs text-slate-500">seconds</span>
            </div>
          )}
        </div>

        <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-slate-600">
            <div>
              Char WPM: {settings.charWpmMin === settings.charWpmMax ? settings.charWpmMin : `${settings.charWpmMin}-${settings.charWpmMax}`} • Eff WPM:{' '}
              {settings.effectiveWpmMin === settings.effectiveWpmMax ? settings.effectiveWpmMin : `${settings.effectiveWpmMin}-${settings.effectiveWpmMax}`}
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
                Playing letter {currentLetterIndex} of {text.replace(/\s+/g, '').length || 1}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isPlaying ? (
              <button
                onClick={handlePlay}
                disabled={!text.trim()}
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
