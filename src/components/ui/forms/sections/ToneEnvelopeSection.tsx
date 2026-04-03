import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Line, LineChart, ResponsiveContainer, CartesianGrid, XAxis, YAxis } from 'recharts';

import { useNumberField } from '@/hooks/useNumberField';
import { playMorseCodeControlled } from '@/lib/morseAudio';

import { LinkedRangeInput } from '../LinkedRangeInput';
import type { FormTrainingSettings } from '../TrainingSettingsForm';

interface ToneEnvelopeSectionProps {
  readonly settings: FormTrainingSettings;
  readonly setSettings: (s: FormTrainingSettings | ((prev: FormTrainingSettings) => FormTrainingSettings)) => void;
  readonly onSaveSettings?: () => void;
}

const clampVolume = (v: number): number => Math.max(0.1, Math.min(1, v));

export function ToneEnvelopeSection({
  settings,
  setSettings,
  onSaveSettings,
}: ToneEnvelopeSectionProps): JSX.Element {
  const sideToneMinField = useNumberField(settings.sideToneMin, {
    min: 100,
    max: 2000,
    step: 1,
    fieldName: 'sideToneMin',
    onChange: (n) => setSettings((prev) => ({ ...prev, sideToneMin: n })),
    ...(onSaveSettings !== undefined ? { onSave: onSaveSettings } : {}),
  });

  const sideToneMaxField = useNumberField(settings.sideToneMax, {
    min: 100,
    max: 2000,
    step: 1,
    fieldName: 'sideToneMax',
    onChange: (n) => setSettings((prev) => ({ ...prev, sideToneMax: n })),
    ...(onSaveSettings !== undefined ? { onSave: onSaveSettings } : {}),
  });

  const [volumeMinInput, setVolumeMinInput] = useState<string>(String(settings.volumeMin ?? 1));
  const [volumeMaxInput, setVolumeMaxInput] = useState<string>(String(settings.volumeMax ?? 1));
  const [showToneHelp, setShowToneHelp] = useState(false);
  const [isPlayingTestTone, setIsPlayingTestTone] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const currentStopRef = useRef<(() => void) | null>(null);
  const testToneTimeoutRef = useRef<number | undefined>(undefined);

  useEffect(() => { setVolumeMinInput(String(clampVolume(settings.volumeMin ?? 1))); }, [settings.volumeMin]);
  useEffect(() => { setVolumeMaxInput(String(clampVolume(settings.volumeMax ?? 1))); }, [settings.volumeMax]);

  useEffect(() => {
    return (): void => {
      if (testToneTimeoutRef.current !== undefined) window.clearTimeout(testToneTimeoutRef.current);
      currentStopRef.current?.();
      if (audioContextRef.current) audioContextRef.current.close().catch(() => {});
    };
  }, []);

  const pickToneHz = useCallback((): number => {
    const min = Math.max(100, settings.sideToneMin);
    const max = Math.max(min, settings.sideToneMax);
    if (min === max) return min;
    return Math.floor(min + Math.random() * (max - min + 1));
  }, [settings.sideToneMin, settings.sideToneMax]);

  const handleTestTone = useCallback(async (): Promise<void> => {
    if (isPlayingTestTone) {
      if (testToneTimeoutRef.current !== undefined) { window.clearTimeout(testToneTimeoutRef.current); testToneTimeoutRef.current = undefined; }
      currentStopRef.current?.();
      currentStopRef.current = null;
      setIsPlayingTestTone(false);
      return;
    }
    try {
      if (!audioContextRef.current) audioContextRef.current = new AudioContext();
      setIsPlayingTestTone(true);
      const { durationSec, stop } = await playMorseCodeControlled(
        audioContextRef.current, 'M M M',
        {
          charWpmMin: Math.max(1, settings.charWpmMin), charWpmMax: Math.max(1, settings.charWpmMax),
          effectiveWpmMin: Math.max(1, settings.effectiveWpmMin), effectiveWpmMax: Math.max(1, settings.effectiveWpmMax),
          extraWordSpaceMultiplier: Math.max(0.1, settings.extraWordSpaceMultiplier ?? 1),
          sideTone: pickToneHz(), steepness: settings.steepness, envelopeSmoothing: settings.envelopeSmoothing ?? 0,
          volumeMin: settings.volumeMin ?? 1, volumeMax: settings.volumeMax ?? 1, linkVolume: settings.linkVolume ?? true,
        },
        () => false,
      );
      currentStopRef.current = stop;
      testToneTimeoutRef.current = window.setTimeout(() => {
        setIsPlayingTestTone(false); currentStopRef.current = null; testToneTimeoutRef.current = undefined;
      }, Math.ceil((durationSec || 0) * 1000) + 100);
    } catch {
      setIsPlayingTestTone(false); currentStopRef.current = null;
      if (testToneTimeoutRef.current !== undefined) { window.clearTimeout(testToneTimeoutRef.current); testToneTimeoutRef.current = undefined; }
    }
  }, [isPlayingTestTone, settings, pickToneHz]);

  const handleResetToneEnvelope = useCallback((): void => {
    setSettings({ ...settings, sideToneMin: 600, sideToneMax: 600, steepness: 5, envelopeSmoothing: 0 });
  }, [settings, setSettings]);

  const previewCharWpm = Math.max(1, settings.charWpmMin || settings.effectiveWpmMin || 20);
  const dotDurationMs = (1.2 / previewCharWpm) * 1000;
  const riseMs = Math.min(settings.steepness, dotDurationMs / 2);
  const smoothing = Math.max(0, Math.min(1, settings.envelopeSmoothing ?? 0));
  const attackFrac = Math.max(0.01, Math.min(0.49, riseMs / Math.max(1, dotDurationMs)));
  const steps = 128;
  const envelopeData = Array.from({ length: steps + 1 }, (_, index) => {
    const x = index / steps;
    if (x < attackFrac) { const t = x / attackFrac; return { x, y: t * (1 - smoothing) + ((1 - Math.cos(Math.PI * t)) / 2) * smoothing }; }
    if (x <= 1 - attackFrac) return { x, y: 1 };
    const t = (x - (1 - attackFrac)) / attackFrac;
    return { x, y: (1 - t) * (1 - smoothing) + ((1 + Math.cos(Math.PI * t)) / 2) * smoothing };
  });

  return (
    <div className="sm:col-span-2 p-4 border border-gray-200 rounded-lg bg-slate-50">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-slate-700">Tone &amp; Envelope</h4>
        <button type="button" onClick={() => setShowToneHelp((v) => !v)}
          className={`inline-flex items-center justify-center h-6 px-2 rounded-full text-xs font-semibold border transition-colors ${showToneHelp ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'}`}
          title="What is Tone &amp; Envelope?" aria-expanded={showToneHelp}>?</button>
      </div>
      {showToneHelp && (
        <div className="mb-3 text-xs text-slate-700 bg-white border border-slate-200 rounded-lg p-3">
          <div className="font-semibold text-slate-800 mb-1">Tone &amp; Envelope</div>
          <ul className="list-disc ml-4 space-y-1">
            <li><span className="font-medium">Tone</span>: Choose min/max sidetone. Equal values lock a fixed tone.</li>
            <li><span className="font-medium">Volume</span>: Loudness 0.1–1.0. Tie = fixed volume; untie for weak-signal training.</li>
            <li><span className="font-medium">Steepness</span>: Attack/decay time of each dit/dah.</li>
            <li><span className="font-medium">Smoothness</span>: Curved vs linear envelope.</li>
            <li><span className="font-medium">Preview</span>: Chart shows a dot&apos;s amplitude envelope at current WPM.</li>
          </ul>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tone Min (Hz)</label>
            <input {...sideToneMinField.inputProps} className="w-full px-3 py-2 border border-gray-300 rounded" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tone Max (Hz)</label>
            <input {...sideToneMaxField.inputProps} className="w-full px-3 py-2 border border-gray-300 rounded" />
            <p className="text-xs text-gray-500 mt-1">Equal min/max = fixed tone.</p>
          </div>
        </div>
        <div>
          <LinkedRangeInput
            label="Volume (loudness)" minValue={volumeMinInput} maxValue={volumeMaxInput} linked={settings.linkVolume ?? true}
            onMinChange={(v) => { setVolumeMinInput(v); if (settings.linkVolume) setVolumeMaxInput(v); }}
            onMaxChange={(v) => setVolumeMaxInput(v)}
            onMinBlur={() => {
              const num = parseFloat(volumeMinInput);
              if (isNaN(num) || num < 0.1 || num > 1) { setVolumeMinInput(String(settings.volumeMin ?? 1)); if (settings.linkVolume) setVolumeMaxInput(String(settings.volumeMin ?? 1)); }
              else {
                const v = clampVolume(num); const maxVal = settings.linkVolume ? v : (settings.volumeMax ?? 1); const validMin = Math.min(v, maxVal);
                setVolumeMinInput(String(validMin));
                const updates: Partial<FormTrainingSettings> = { volumeMin: validMin };
                if (settings.linkVolume) { updates.volumeMax = validMin; setVolumeMaxInput(String(validMin)); }
                setSettings({ ...settings, ...updates });
                if (onSaveSettings) setTimeout(() => onSaveSettings(), 50);
              }
            }}
            onMaxBlur={() => {
              const num = parseFloat(volumeMaxInput);
              if (isNaN(num) || num < 0.1 || num > 1) { setVolumeMaxInput(String(settings.volumeMax ?? 1)); }
              else {
                const v = clampVolume(num); const validMax = Math.max(v, settings.volumeMin ?? 1);
                setVolumeMaxInput(String(validMax));
                setSettings({ ...settings, volumeMax: validMax });
                if (onSaveSettings) setTimeout(() => onSaveSettings(), 50);
              }
            }}
            onLinkToggle={(linked) => {
              const updates: Partial<FormTrainingSettings> = { linkVolume: linked };
              if (linked) { updates.volumeMax = settings.volumeMin ?? 1; setVolumeMaxInput(String(settings.volumeMin ?? 1)); }
              setSettings({ ...settings, ...updates });
            }}
            min={0.1} max={1} step={0.1} minLabel="Min" maxLabel="Max"
            helpText="Tie = fixed volume; range = sample per symbol (weak-signal training)."
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Steepness (ms)</label>
          <input type="range" min={1} max={50} step={1} value={settings.steepness}
            onChange={(e) => setSettings({ ...settings, steepness: parseInt(e.target.value, 10) })} className="w-full" />
          <div className="text-xs text-gray-500 mt-1">{settings.steepness} ms</div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Envelope Smoothness</label>
          <input type="range" min={0} max={1} step={0.05} value={smoothing}
            onChange={(e) => setSettings({ ...settings, envelopeSmoothing: Math.max(0, Math.min(1, parseFloat(e.target.value))) })} className="w-full" />
          <div className="flex justify-between text-xs text-gray-500"><span>Linear</span><span>Smooth</span></div>
        </div>
        <div className="h-28 md:h-32">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={envelopeData} margin={{ top: 8, right: 12, bottom: 8, left: 12 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="x" type="number" domain={[0, 1]} hide />
              <YAxis type="number" domain={[0, 1]} hide />
              <Line type="monotone" dataKey="y" stroke="#10b981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <p className="text-[11px] text-gray-500 mt-2">
        Rise/decay: {Math.round(riseMs)} ms · Dot ≈ {Math.round(dotDurationMs)} ms @ {previewCharWpm} WPM · Smoothness: {Math.round(smoothing * 100)}%
      </p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={handleTestTone}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isPlayingTestTone ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-blue-500 text-white hover:bg-blue-600'}`}>
          {isPlayingTestTone ? '⏹ Stop' : '▶ Test'}
        </button>
        <button type="button" onClick={handleResetToneEnvelope}
          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-500 text-white hover:bg-slate-600 transition-colors">
          ↺ Reset
        </button>
      </div>
    </div>
  );
}
