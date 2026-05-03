'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { FormTrainingSettings } from '@/components/ui/forms/TrainingSettingsForm';
import { useTrainingSessionLock } from '@/hooks/useTrainingSessionLock';
import { playMorseCodeControlled, resumeAudioContextFromUserGesture } from '@/lib/morseAudio';
import { LCWO_SEQUENCE } from '@/lib/morseConstants';
import { computeCharPool } from '@/lib/trainingUtils';

interface TextPlayerModalProps {
  open: boolean;
  onClose: () => void;
  settings: FormTrainingSettings;
  initialText?: string;
}

export function TextPlayerModal({
  open,
  onClose,
  settings,
  initialText,
}: TextPlayerModalProps): JSX.Element | null {
  const { takeLock: takeModalLock, releaseLock: releaseModalLock } = useTrainingSessionLock();

  const [text, setText] = useState<string>(initialText || 'CQ CQ TEST');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [durationSec, setDurationSec] = useState<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const abortRef = useRef<boolean>(false);
  const tickTimeoutRef = useRef<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const clearPlaybackTick = useCallback((): void => {
    if (tickTimeoutRef.current != null) {
      try {
        window.clearTimeout(tickTimeoutRef.current);
      } catch {
        /* no-op */
      }
      tickTimeoutRef.current = null;
    }
  }, []);

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

  useEffect(() => {
    if (!open) {
      abortRef.current = true;
      clearPlaybackTick();
      try {
        stopRef.current?.();
      } catch {
        /* no-op */
      }
      stopRef.current = null;
      setIsPlaying(false);
      setDurationSec(0);
      releaseModalLock();
    }
  }, [open, clearPlaybackTick, releaseModalLock]);

  useEffect(() => {
    return (): void => {
      abortRef.current = true;
      releaseModalLock();
      clearPlaybackTick();
      try {
        stopRef.current?.();
      } catch {
        /* no-op */
      }
      stopRef.current = null;
      try {
        audioContextRef.current?.close();
      } catch {
        /* no-op */
      }
      audioContextRef.current = null;
    };
  }, [clearPlaybackTick, releaseModalLock]);

  const handlePlay = async (): Promise<void> => {
    if (!open || !text.trim()) {
      return;
    }
    abortRef.current = false;
    clearPlaybackTick();
    setIsPlaying(true);
    takeModalLock();
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    const ctx = audioContextRef.current;
    resumeAudioContextFromUserGesture(ctx);
    try {
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
      const endAt = Date.now() + Math.ceil(d * 1000);
      const tick = (): void => {
        if (abortRef.current) return;
        const remaining = endAt - Date.now();
        if (remaining <= 0) {
          tickTimeoutRef.current = null;
          setIsPlaying(false);
          releaseModalLock();
          stopRef.current = null;
          return;
        }
        tickTimeoutRef.current = window.setTimeout(
          tick,
          Math.min(250, Math.max(50, remaining)),
        ) as unknown as number;
      };
      tickTimeoutRef.current = window.setTimeout(tick, 50) as unknown as number;
    } catch {
      setIsPlaying(false);
      releaseModalLock();
    }
  };

  const handleStop = (): void => {
    abortRef.current = true;
    clearPlaybackTick();
    try {
      stopRef.current?.();
    } catch {
      /* no-op */
    }
    stopRef.current = null;
    setIsPlaying(false);
    releaseModalLock();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => {
          if (!isPlaying) onClose();
        }}
      />
      <div className="relative z-10 w-[min(92vw,680px)] bg-white rounded-2xl shadow-2xl p-4 sm:p-6 border border-white/40">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg sm:text-xl font-semibold text-slate-800">Play Text as Morse</h3>
            <p className="text-xs text-slate-500 mt-1">
              Uses current speed, spacing and tone from Settings.
            </p>
          </div>
          <button
            onClick={() => {
              if (!isPlaying) onClose();
            }}
            className="p-2 rounded-lg hover:bg-slate-100"
            title="Close"
          >
            <svg
              className="w-5 h-5 text-slate-600"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type text here... (Press Enter to generate a line of groups)"
            className="w-full h-32 sm:h-36 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
                  Estimated duration: ~{Math.round(durationSec)}s
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
    </div>
  );
}
