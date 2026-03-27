'use client';

import React, { useEffect, useState } from 'react';
import { Line, LineChart, ResponsiveContainer, CartesianGrid, XAxis, YAxis } from 'recharts';

import { LinkedRangeInput } from './LinkedRangeInput';

export interface SharedAudioSettings {
  charWpmMin: number;
  charWpmMax: number;
  linkCharWpm: boolean;
  effectiveWpmMin: number;
  effectiveWpmMax: number;
  linkEffectiveWpm: boolean;
  sideToneMin: number;
  sideToneMax: number;
  steepness: number;
  envelopeSmoothing: number | undefined;
}

interface SharedAudioSettingsProps {
  settings: SharedAudioSettings;
  setSettings: (
    settings: SharedAudioSettings | ((prev: SharedAudioSettings) => SharedAudioSettings),
  ) => void;
}

export function SharedAudioSettings({
  settings,
  setSettings,
}: SharedAudioSettingsProps): JSX.Element {
  // Local state for WPM inputs to allow empty/invalid values while typing
  const [charWpmMinInput, setCharWpmMinInput] = useState<string>(String(settings.charWpmMin));
  const [charWpmMaxInput, setCharWpmMaxInput] = useState<string>(String(settings.charWpmMax));
  const [effectiveWpmMinInput, setEffectiveWpmMinInput] = useState<string>(String(settings.effectiveWpmMin));
  const [effectiveWpmMaxInput, setEffectiveWpmMaxInput] = useState<string>(String(settings.effectiveWpmMax));
  
  // Sync local state when settings change externally
  useEffect(() => {
    setCharWpmMinInput(String(settings.charWpmMin));
  }, [settings.charWpmMin]);
  
  useEffect(() => {
    setCharWpmMaxInput(String(settings.charWpmMax));
  }, [settings.charWpmMax]);
  
  useEffect(() => {
    setEffectiveWpmMinInput(String(settings.effectiveWpmMin));
  }, [settings.effectiveWpmMin]);
  
  useEffect(() => {
    setEffectiveWpmMaxInput(String(settings.effectiveWpmMax));
  }, [settings.effectiveWpmMax]);
  
  const previewCharWpm = Math.max(1, settings.charWpmMin || settings.effectiveWpmMin || 20);
  const dotDurationMs: number = (1.2 / previewCharWpm) * 1000;
  const riseMs: number = Math.min(settings.steepness, dotDurationMs / 2);
  const smoothing = Math.max(0, Math.min(1, settings.envelopeSmoothing ?? 0));
  const attackFrac = Math.max(0.01, Math.min(0.49, riseMs / Math.max(1, dotDurationMs)));
  const steps = 128;
  const envelopeData = Array.from({ length: steps + 1 }, (_, index) => {
    const x = index / steps;
    if (x < attackFrac) {
      const t = x / attackFrac;
      const linear = t;
      const cosine = (1 - Math.cos(Math.PI * t)) / 2;
      return { x, y: linear * (1 - smoothing) + cosine * smoothing };
    }
    if (x <= 1 - attackFrac) {
      return { x, y: 1 };
    }
    const t = (x - (1 - attackFrac)) / attackFrac;
    const linear = 1 - t;
    const cosine = (1 + Math.cos(Math.PI * t)) / 2;
    return { x, y: linear * (1 - smoothing) + cosine * smoothing };
  });

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-slate-800">Audio Settings (Shared)</h3>
      
      <div className="grid grid-cols-1 gap-4">
        <LinkedRangeInput
          label="Character Speed (WPM)"
          minValue={charWpmMinInput}
          maxValue={charWpmMaxInput}
          linked={settings.linkCharWpm}
          onMinChange={(value) => {
            setCharWpmMinInput(value);
            if (settings.linkCharWpm) {
              setCharWpmMaxInput(value);
            }
          }}
          onMaxChange={(value) => {
            setCharWpmMaxInput(value);
          }}
          onMinBlur={() => {
            const num = parseFloat(charWpmMinInput);
            if (isNaN(num) || num <= 0) {
              setCharWpmMinInput(String(settings.charWpmMin));
            } else {
              const updates: Partial<SharedAudioSettings> = { charWpmMin: num };
              if (settings.linkCharWpm) {
                updates.charWpmMax = num;
                setCharWpmMaxInput(String(num));
              }
              if (settings.linkEffectiveWpm) {
                updates.effectiveWpmMin = num;
                updates.effectiveWpmMax = settings.linkCharWpm ? num : settings.charWpmMax;
                setEffectiveWpmMinInput(String(num));
                if (settings.linkCharWpm) {
                  setEffectiveWpmMaxInput(String(num));
                }
              }
              setSettings({ ...settings, ...updates });
            }
          }}
          onMaxBlur={() => {
            const num = parseFloat(charWpmMaxInput);
            if (isNaN(num) || num <= 0) {
              setCharWpmMaxInput(String(settings.charWpmMax));
            } else {
              const updates: Partial<SharedAudioSettings> = { charWpmMax: num };
              if (settings.linkEffectiveWpm) {
                updates.effectiveWpmMax = num;
                setEffectiveWpmMaxInput(String(num));
              }
              setSettings({ ...settings, ...updates });
            }
          }}
          onLinkToggle={(linked) => {
            const updates: Partial<SharedAudioSettings> = { linkCharWpm: linked };
            if (linked) {
              updates.charWpmMax = settings.charWpmMin;
              setCharWpmMaxInput(String(settings.charWpmMin));
            }
            setSettings({ ...settings, ...updates });
          }}
          min={1}
          unit="WPM"
          helpText="Variable WPM helps recognize letters at different speeds"
        />
        
        <LinkedRangeInput
          label="Effective Speed (WPM)"
          minValue={effectiveWpmMinInput}
          maxValue={effectiveWpmMaxInput}
          linked={settings.linkEffectiveWpm}
          onMinChange={(value) => {
            setEffectiveWpmMinInput(value);
            if (settings.linkEffectiveWpm) {
              setEffectiveWpmMaxInput(value);
            }
          }}
          onMaxChange={(value) => {
            setEffectiveWpmMaxInput(value);
          }}
          onMinBlur={() => {
            const num = parseFloat(effectiveWpmMinInput);
            if (isNaN(num) || num <= 0) {
              setEffectiveWpmMinInput(String(settings.effectiveWpmMin));
            } else {
              const updates: Partial<SharedAudioSettings> = { effectiveWpmMin: num };
              if (settings.linkEffectiveWpm) {
                updates.effectiveWpmMax = num;
                setEffectiveWpmMaxInput(String(num));
              }
              setSettings({ ...settings, ...updates });
            }
          }}
          onMaxBlur={() => {
            const num = parseFloat(effectiveWpmMaxInput);
            if (isNaN(num) || num <= 0) {
              setEffectiveWpmMaxInput(String(settings.effectiveWpmMax));
            } else {
              setSettings({ ...settings, effectiveWpmMax: num });
            }
          }}
          onLinkToggle={(linked) => {
            const updates: Partial<SharedAudioSettings> = { linkEffectiveWpm: linked };
            if (linked) {
              updates.effectiveWpmMax = settings.effectiveWpmMin;
              setEffectiveWpmMaxInput(String(settings.effectiveWpmMin));
            }
            setSettings({ ...settings, ...updates });
          }}
          min={1}
          unit="WPM"
          helpText="Farnsworth spacing: slower effective speed adds extra gaps"
        />

        <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Side Tone Min (Hz)
          </label>
          <input
            type="number"
            min={100}
            max={2000}
            step={1}
            value={settings.sideToneMin}
            onChange={(event) => {
              const numValue = parseInt(event.target.value || '600', 10);
              if (!isNaN(numValue) && numValue >= 100 && numValue <= 2000) {
                setSettings({
                  ...settings,
                  sideToneMin: numValue,
                  sideToneMax: Math.max(numValue, settings.sideToneMax),
                });
              }
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Side Tone Max (Hz)
          </label>
          <input
            type="number"
            min={100}
            max={2000}
            step={1}
            value={settings.sideToneMax}
            onChange={(event) => {
              const numValue = parseInt(event.target.value || '600', 10);
              if (!isNaN(numValue) && numValue >= 100 && numValue <= 2000) {
                setSettings({
                  ...settings,
                  sideToneMax: numValue,
                  sideToneMin: Math.min(numValue, settings.sideToneMin),
                });
              }
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Steepness
          </label>
          <input
            type="number"
            min={1}
            max={100}
            step={1}
            value={settings.steepness}
            onChange={(event) => {
              const numValue = parseInt(event.target.value || '5', 10);
              if (!isNaN(numValue) && numValue >= 1 && numValue <= 100) {
                setSettings({
                  ...settings,
                  steepness: numValue,
                });
              }
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Envelope Smoothing (0-1)
          </label>
          <input
            type="number"
            min={0}
            max={1}
            step={0.01}
            value={settings.envelopeSmoothing ?? 0}
            onChange={(event) => {
              const numValue = parseFloat(event.target.value || '0');
              if (!isNaN(numValue) && numValue >= 0 && numValue <= 1) {
                setSettings({
                  ...settings,
                  envelopeSmoothing: numValue,
                });
              }
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded"
          />
        </div>
        </div>
      </div>

      <div className="mt-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Envelope Preview
        </label>
        <div className="h-32 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={envelopeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis domain={[0, 1]} />
              <YAxis domain={[0, 1]} />
              <Line type="monotone" dataKey="y" stroke="#2563eb" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

