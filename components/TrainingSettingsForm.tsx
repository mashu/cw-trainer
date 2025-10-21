import React from 'react';
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Line } from 'recharts';
import { KOCH_SEQUENCE } from '@/lib/morseConstants';

export interface TrainingSettings {
  kochLevel: number;
  sideTone: number;
  steepness: number;
  sessionDuration: number;
  charsPerGroup: number;
  numGroups: number;
  wpm: number;
  groupTimeout: number; // seconds to wait for input before auto-advance
  minGroupSize: number;
  maxGroupSize: number;
  interactiveMode: boolean;
  envelopeSmoothing?: number; // 0..1
}

interface TrainingSettingsFormProps {
  settings: TrainingSettings;
  setSettings: (s: TrainingSettings) => void;
}

const TrainingSettingsForm: React.FC<TrainingSettingsFormProps> = ({ settings, setSettings }) => {
  // Preview values for steepness envelope (dot symbol)
  const dotDurationMs: number = (1.2 / settings.wpm) * 1000;
  const riseMs: number = Math.min(settings.steepness, dotDurationMs / 2);
  const attackPct: number = dotDurationMs > 0 ? (riseMs / dotDurationMs) * 100 : 0;
  const smoothing = Math.max(0, Math.min(1, settings.envelopeSmoothing ?? 0));
  // Prepare envelope data for plotting (0..1 symbol duration)
  const attackFrac = Math.max(0.01, Math.min(0.49, riseMs / Math.max(1, dotDurationMs)));
  const steps = 128;
  const envelopeData = Array.from({ length: steps + 1 }, (_, i) => {
    const x = i / steps;
    let y: number;
    if (x < attackFrac) {
      const t = x / attackFrac;
      const linear = t;
      const cosine = (1 - Math.cos(Math.PI * t)) / 2;
      y = linear * (1 - smoothing) + cosine * smoothing;
    } else if (x <= 1 - attackFrac) {
      y = 1;
    } else {
      const t = (x - (1 - attackFrac)) / attackFrac;
      const linear = 1 - t;
      const cosine = (1 + Math.cos(Math.PI * t)) / 2;
      y = linear * (1 - smoothing) + cosine * smoothing;
    }
    return { x, y };
  });
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2 p-4 border border-gray-200 rounded-lg bg-slate-50">
          <h4 className="text-sm font-semibold text-slate-700 mb-3">Session & Groups</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Koch Level (1-{KOCH_SEQUENCE.length})</label>
              <input type="number" min="1" max={KOCH_SEQUENCE.length} value={settings.kochLevel} onChange={(e) => setSettings({ ...settings, kochLevel: parseInt(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 rounded" />
              <p className="text-xs text-gray-500 mt-1 h-4">Characters: {KOCH_SEQUENCE.slice(0, settings.kochLevel).join(' ')}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Number of Groups</label>
              <input type="number" value={settings.numGroups} onChange={(e) => setSettings({ ...settings, numGroups: parseInt(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 rounded" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Group Timeout (seconds)</label>
              <input type="number" step="0.5" value={settings.groupTimeout} onChange={(e) => setSettings({ ...settings, groupTimeout: parseFloat(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 rounded" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Min Group Size</label>
              <input type="number" value={settings.minGroupSize} onChange={(e) => setSettings({ ...settings, minGroupSize: parseInt(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 rounded" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Group Size</label>
              <input type="number" value={settings.maxGroupSize} onChange={(e) => setSettings({ ...settings, maxGroupSize: parseInt(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 rounded" />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <input type="checkbox" checked={settings.interactiveMode} onChange={(e) => setSettings({ ...settings, interactiveMode: e.target.checked })} className="w-4 h-4" />
            <label className="text-sm font-medium text-gray-700">Interactive Mode (submit after each group)</label>
          </div>
        </div>

        <div className="sm:col-span-2 p-4 border border-gray-200 rounded-lg bg-slate-50">
          <h4 className="text-sm font-semibold text-slate-700 mb-3">Tone & Envelope</h4>
          <div className="grid grid-cols-1 gap-4">
            {/* Speed and Side Tone in a single row as number inputs (spinbuttons) */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Speed (WPM)</label>
                <input type="number" value={settings.wpm} onChange={(e) => setSettings({ ...settings, wpm: parseInt(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 rounded" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Side Tone (Hz)</label>
                <input type="number" value={settings.sideTone} onChange={(e) => setSettings({ ...settings, sideTone: parseInt(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 rounded" />
              </div>
            </div>
            {/* Steepness slider (ms) - one per row */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Steepness (ms)</label>
              <input
                type="range"
                min={1}
                max={50}
                step={1}
                value={settings.steepness}
                onChange={(e) => setSettings({ ...settings, steepness: parseInt(e.target.value) })}
                className="w-full"
              />
              <div className="text-xs text-gray-500 mt-1">{settings.steepness} ms</div>
            </div>
            {/* Smoothness slider - one per row */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Envelope Smoothness</label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={smoothing}
                onChange={(e) => setSettings({ ...settings, envelopeSmoothing: Math.max(0, Math.min(1, parseFloat(e.target.value))) })}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>Linear</span>
                <span>Smooth</span>
              </div>
            </div>
            {/* Envelope preview (reduced height) */}
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
          <p className="text-[11px] text-gray-500 mt-2">Rise/decay: {Math.round(riseMs)} ms • Dot ≈ {Math.round(dotDurationMs)} ms @ {settings.wpm} WPM • Smoothness: {Math.round(smoothing * 100)}%</p>
        </div>
      </div>

      {/* Removed duplicate Envelope Smoothness slider (kept within Tone & Envelope group) */}
    </>
  );
};

export default TrainingSettingsForm;


