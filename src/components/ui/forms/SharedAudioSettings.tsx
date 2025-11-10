'use client';

import React, { useEffect, useState } from 'react';
import { Line, LineChart, ResponsiveContainer, CartesianGrid, XAxis, YAxis } from 'recharts';

export interface SharedAudioSettings {
  charWpm: number;
  effectiveWpm: number;
  linkSpeeds: boolean;
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
  const [charWpmInput, setCharWpmInput] = useState<string>(String(settings.charWpm));
  const [effectiveWpmInput, setEffectiveWpmInput] = useState<string>(String(settings.effectiveWpm));
  
  // Sync local state when settings change externally
  useEffect(() => {
    setCharWpmInput(String(settings.charWpm));
  }, [settings.charWpm]);
  
  useEffect(() => {
    // Only update effectiveWpmInput if speeds are not linked
    if (!settings.linkSpeeds) {
      setEffectiveWpmInput(String(settings.effectiveWpm));
    } else {
      setEffectiveWpmInput(String(settings.charWpm));
    }
  }, [settings.effectiveWpm, settings.charWpm, settings.linkSpeeds]);
  
  const previewCharWpm = Math.max(1, settings.charWpm || settings.effectiveWpm || 20);
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
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Character Speed (WPM)
          </label>
          <input
            type="number"
            min={1}
            step={1}
            value={charWpmInput}
            onChange={(event) => {
              const inputValue = event.target.value;
              setCharWpmInput(inputValue);
              const numValue = parseFloat(inputValue);
              if (!isNaN(numValue) && numValue > 0) {
                setSettings({
                  ...settings,
                  charWpm: numValue,
                  effectiveWpm: settings.linkSpeeds ? numValue : settings.effectiveWpm,
                });
              }
            }}
            onBlur={(event) => {
              const numValue = parseFloat(event.target.value);
              if (isNaN(numValue) || numValue <= 0) {
                const validValue = 1;
                setCharWpmInput(String(validValue));
                setSettings({
                  ...settings,
                  charWpm: validValue,
                  effectiveWpm: settings.linkSpeeds ? validValue : settings.effectiveWpm,
                });
              } else {
                setCharWpmInput(String(numValue));
              }
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Effective Speed (WPM)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              step={1}
              value={effectiveWpmInput}
              disabled={settings.linkSpeeds}
              onChange={(event) => {
                const inputValue = event.target.value;
                setEffectiveWpmInput(inputValue);
                const numValue = parseFloat(inputValue);
                if (!isNaN(numValue) && numValue > 0) {
                  setSettings({
                    ...settings,
                    effectiveWpm: numValue,
                  });
                }
              }}
              onBlur={(event) => {
                const numValue = parseFloat(event.target.value);
                if (isNaN(numValue) || numValue <= 0) {
                  const validValue = settings.linkSpeeds ? settings.charWpm : 1;
                  setEffectiveWpmInput(String(validValue));
                  setSettings({
                    ...settings,
                    effectiveWpm: validValue,
                  });
                } else {
                  setEffectiveWpmInput(String(numValue));
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded disabled:bg-gray-100"
            />
            <label className="flex items-center gap-1 text-sm text-gray-600 whitespace-nowrap">
              <input
                type="checkbox"
                checked={settings.linkSpeeds}
                onChange={(event) => {
                  const link = event.target.checked;
                  setSettings({
                    ...settings,
                    linkSpeeds: link,
                    effectiveWpm: link ? settings.charWpm : settings.effectiveWpm,
                  });
                  if (link) {
                    setEffectiveWpmInput(String(settings.charWpm));
                  }
                }}
                className="rounded"
              />
              Link
            </label>
          </div>
        </div>

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

