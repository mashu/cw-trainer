'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

import type { TrainingSettings } from '@/components/ui/forms/TrainingSettingsForm';
import { playMorseCodeControlled, renderMorseToWavBlob } from '@/lib/morseAudio';
import { KOCH_SEQUENCE } from '@/lib/morseConstants';
import { computeCharPool } from '@/lib/trainingUtils';

interface TextPlayerProps {
  settings: TrainingSettings;
  initialText?: string;
}

export function TextPlayer({ settings, initialText }: TextPlayerProps): JSX.Element {
  const [text, setText] = useState<string>(initialText || 'CQ CQ DE TEST');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [durationSec, setDurationSec] = useState<number>(0);
  const [isRendering, setIsRendering] = useState<boolean>(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const abortRef = useRef<boolean>(false);
  const timerRef = useRef<number | null>(null);
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
      ...(settings.charSetMode !== undefined ? { charSetMode: settings.charSetMode } : {}),
      ...(settings.digitsLevel !== undefined ? { digitsLevel: settings.digitsLevel } : {}),
      ...(settings.customSet && settings.customSet.length > 0 ? { customSet: [...settings.customSet] } : {}),
      ...(settings.customSequence && settings.customSequence.length > 0 ? { customSequence: [...settings.customSequence] } : {}),
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
    return (): void => {
      abortRef.current = true;
      try {
        stopRef.current?.();
      } catch {}
      stopRef.current = null;
      try {
        if (timerRef.current != null) window.clearTimeout(timerRef.current);
      } catch {}
      timerRef.current = null;
      try {
        audioContextRef.current?.close();
      } catch {}
      audioContextRef.current = null;
    };
  }, []);

  const handlePlay = async (): Promise<void> => {
    if (!text.trim()) {
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
      try {
        if (timerRef.current != null) window.clearTimeout(timerRef.current);
      } catch {}
      timerRef.current = window.setTimeout(
        () => {
          setIsPlaying(false);
          stopRef.current = null;
          timerRef.current = null;
        },
        Math.ceil(d * 1000),
      ) as unknown as number;
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
    try {
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
    } catch {}
    timerRef.current = null;
    setIsPlaying(false);
  };

  const handleDownload = async (): Promise<void> => {
    if (!text.trim() || isRendering) {
      return;
    }
    setIsRendering(true);
    try {
      const blob = renderMorseToWavBlob(text, {
        charWpm: Math.max(1, settings.charWpm),
        effectiveWpm: Math.max(1, settings.effectiveWpm),
        extraWordSpaceMultiplier: Math.max(1, settings.extraWordSpaceMultiplier ?? 1),
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

        <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
                Last duration: ~{Math.round(durationSec)}s
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
