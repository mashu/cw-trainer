import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { TrainingSettings } from './TrainingSettingsForm';
import { playMorseCodeControlled } from '@/lib/morseAudio';

interface TextPlayerModalProps {
  open: boolean;
  onClose: () => void;
  settings: TrainingSettings;
  initialText?: string;
}

const TextPlayerModal: React.FC<TextPlayerModalProps> = ({ open, onClose, settings, initialText }) => {
  const [text, setText] = useState<string>(initialText || 'CQ CQ TEST');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [durationSec, setDurationSec] = useState<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const abortRef = useRef<boolean>(false);

  const toneHz = useMemo(() => {
    const min = Math.max(100, settings.sideToneMin);
    const max = Math.max(min, settings.sideToneMax);
    if (min === max) return min;
    return Math.floor(min + Math.random() * (max - min + 1));
  }, [settings.sideToneMin, settings.sideToneMax]);

  useEffect(() => {
    if (!open) {
      try { stopRef.current?.(); } catch {}
      stopRef.current = null;
      setIsPlaying(false);
      setDurationSec(0);
      abortRef.current = true;
      abortRef.current = false;
    }
  }, [open]);

  useEffect(() => {
    return () => {
      try { stopRef.current?.(); } catch {}
      stopRef.current = null;
      try { audioContextRef.current?.close(); } catch {}
      audioContextRef.current = null;
    };
  }, []);

  const handlePlay = async () => {
    if (!open || !text.trim()) return;
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
      const endAt = Date.now() + Math.ceil(d * 1000);
      const tick = () => {
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

  const handleStop = () => {
    abortRef.current = true;
    try { stopRef.current?.(); } catch {}
    stopRef.current = null;
    setIsPlaying(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={() => { if (!isPlaying) onClose(); }} />
      <div className="relative z-10 w-[min(92vw,680px)] bg-white rounded-2xl shadow-2xl p-4 sm:p-6 border border-white/40">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg sm:text-xl font-semibold text-slate-800">Play Text as Morse</h3>
            <p className="text-xs text-slate-500 mt-1">Uses current speed, spacing and tone from Settings.</p>
          </div>
          <button
            onClick={() => { if (!isPlaying) onClose(); }}
            className="p-2 rounded-lg hover:bg-slate-100"
            title="Close"
          >
            <svg className="w-5 h-5 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type text here..."
            className="w-full h-32 sm:h-36 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-slate-600">
              <div>Char WPM: {Math.max(1, settings.charWpm)} • Eff WPM: {Math.max(1, settings.effectiveWpm)}</div>
              <div>Tone: {toneHz} Hz • Extra Word Space: ×{Math.max(1, settings.extraWordSpaceMultiplier ?? 1)}</div>
              {durationSec > 0 && (
                <div className="text-[11px] text-slate-500">Estimated duration: ~{Math.round(durationSec)}s</div>
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
};

export default TextPlayerModal;


