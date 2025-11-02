'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

import type { TrainingSettings } from '@/components/ui/forms/TrainingSettingsForm';
import { playMorseCodeControlled } from '@/lib/morseAudio';
import { KOCH_SEQUENCE } from '@/lib/morseConstants';
import { computeCharPool } from '@/lib/trainingUtils';

interface TextPlayerModalProps {
  open: boolean;
  onClose: () => void;
  settings: TrainingSettings;
  initialText?: string;
}

export function TextPlayerModal({
  open,
  onClose,
  settings,
  initialText,
}: TextPlayerModalProps): JSX.Element {
  const [text, setText] = useState<string>(initialText || 'CQ CQ TEST');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [durationSec, setDurationSec] = useState<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const abortRef = useRef<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const toneHz = useMemo(() => {
    const min = Math.max(100, settings.sideToneMin);
    const max = Math.max(min, settings.sideToneMax);
    if (min === max) return min;
    return Math.floor(min + Math.random() * (max - min + 1));
  }, [settings.sideToneMin, settings.sideToneMax]);

  const generateLineOfGroups = (): string => {
    const charPool = computeCharPool({
      kochLevel: settings.kochLevel,
      charSetMode: settings.charSetMode,
      digitsLevel: settings.digitsLevel,
      customSet: settings.customSet,
    });
    const safePool =
      Array.isArray(charPool) && charPool.length > 0
        ? charPool
        : KOCH_SEQUENCE.slice(0, Math.max(1, settings.kochLevel || 1));

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
      try {
        stopRef.current?.();
      } catch {}
      stopRef.current = null;
      setIsPlaying(false);
      setDurationSec(0);
      abortRef.current = true;
      abortRef.current = false;
    }
  }, [open]);

  useEffect(() => {
    return (): void => {
      try {
        stopRef.current?.();
      } catch {}
      stopRef.current = null;
      try {
        audioContextRef.current?.close();
      } catch {}
      audioContextRef.current = null;
    };
  }, []);

  const handlePlay = async (): Promise<void> => {
    if (!open || !text.trim()) {
      return;
    }
    abortRef.current = false;
    setIsPlaying(true);
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    const ctx = audioContextRef.current;
    try {
      const { durationSec: d, stop } = await playMorseCodeControlled(
        ctx,
        text,
        {
          charWpm: Math.max(1, settings.charWpm),
          effectiveWpm: Math.max(1, settings.effectiveWpm),
          extraWordSpaceMultiplier: Math.max(1, settings.extraWordSpaceMultiplier ?? 1),
          sideTone: toneHz,
          steepness: settings.steepness,
          envelopeSmoothing: settings.envelopeSmoothing ?? 0,
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
          setIsPlaying(false);
          stopRef.current = null;
          return;
        }
        window.setTimeout(tick, Math.min(250, Math.max(50, remaining)));
      };
      window.setTimeout(tick, 50);
    } catch {
      setIsPlaying(false);
    }
  };

  const handleStop = (): void => {
    abortRef.current = true;
    try {
      stopRef.current?.();
    } catch {}
    stopRef.current = null;
    setIsPlaying(false);
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
                Char WPM: {Math.max(1, settings.charWpm)} • Eff WPM:{' '}
                {Math.max(1, settings.effectiveWpm)}
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
