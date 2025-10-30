import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { TrainingSettings } from './TrainingSettingsForm';
import { playMorseCodeControlled, renderMorseToWavBlob } from '@/lib/morseAudio';

interface TextPlayerProps {
  settings: TrainingSettings;
  initialText?: string;
}

const TextPlayer: React.FC<TextPlayerProps> = ({ settings, initialText }) => {
  const [text, setText] = useState<string>(initialText || 'CQ CQ DE TEST');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [durationSec, setDurationSec] = useState<number>(0);
  const [isRendering, setIsRendering] = useState<boolean>(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const abortRef = useRef<boolean>(false);
  const timerRef = useRef<number | null>(null);

  const toneHz = useMemo(() => {
    const min = Math.max(100, settings.sideToneMin);
    const max = Math.max(min, settings.sideToneMax);
    if (min === max) return min;
    return Math.floor(min + Math.random() * (max - min + 1));
  }, [settings.sideToneMin, settings.sideToneMax]);

  useEffect(() => {
    return () => {
      abortRef.current = true;
      try { stopRef.current?.(); } catch {}
      stopRef.current = null;
      try { if (timerRef.current != null) window.clearTimeout(timerRef.current); } catch {}
      timerRef.current = null;
      try { audioContextRef.current?.close(); } catch {}
      audioContextRef.current = null;
    };
  }, []);

  const handlePlay = async () => {
    if (!text.trim()) return;
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
          envelopeSmoothing: settings.envelopeSmoothing ?? 0
        },
        () => abortRef.current
      );
      stopRef.current = stop;
      setDurationSec(d);
      try { if (timerRef.current != null) window.clearTimeout(timerRef.current); } catch {}
      timerRef.current = window.setTimeout(() => {
        setIsPlaying(false);
        stopRef.current = null;
        timerRef.current = null;
      }, Math.ceil(d * 1000)) as unknown as number;
    } catch {
      setIsPlaying(false);
    }
  };

  const handleStop = () => {
    abortRef.current = true;
    try { stopRef.current?.(); } catch {}
    stopRef.current = null;
    try { if (timerRef.current != null) window.clearTimeout(timerRef.current); } catch {}
    timerRef.current = null;
    setIsPlaying(false);
  };

  const handleDownload = async () => {
    if (!text.trim() || isRendering) return;
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
      setTimeout(() => { try { URL.revokeObjectURL(url); } catch {} }, 5000);
    } finally {
      setIsRendering(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">Text Player</h2>
          <p className="text-slate-600 text-sm mt-1">Type any text and play it as Morse using current settings.</p>
        </div>
      </div>

      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-white to-slate-50 border border-slate-200">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type text here..."
          className="w-full h-40 sm:h-44 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />

        <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-slate-600">
            <div>Char WPM: {Math.max(1, settings.charWpm)} • Eff WPM: {Math.max(1, settings.effectiveWpm)}</div>
            <div>Tone: {toneHz} Hz • Extra Word Space: ×{Math.max(1, settings.extraWordSpaceMultiplier ?? 1)}</div>
            {durationSec > 0 && (
              <div className="text-[11px] text-slate-500">Last duration: ~{Math.round(durationSec)}s</div>
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
};

export default TextPlayer;


