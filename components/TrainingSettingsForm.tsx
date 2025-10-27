import React, { useState } from 'react';
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Line } from 'recharts';
import { KOCH_SEQUENCE, MORSE_CODE } from '@/lib/morseConstants';

export interface TrainingSettings {
  kochLevel: number;
  // Character set selection
  charSetMode?: 'koch' | 'digits' | 'custom';
  digitsLevel?: number; // 1..10
  customSet?: string[];
  // Tone & envelope
  sideToneMin: number;
  sideToneMax: number;
  steepness: number;
  // Session & groups
  sessionDuration: number;
  charsPerGroup: number;
  numGroups: number;
  // Timing
  charWpm: number; // character speed
  effectiveWpm: number; // perceived speed via spacing
  linkSpeeds: boolean; // binder to keep char==effective
  extraWordSpaceMultiplier?: number; // >=1.0 additional word spacing factor
  groupTimeout: number; // seconds to wait for input before auto-advance
  minGroupSize: number;
  maxGroupSize: number;
  interactiveMode: boolean;
  envelopeSmoothing?: number; // 0..1
  autoAdjustKoch?: boolean;
  autoAdjustThreshold?: number; // 0..100 (%), used for charts reference line
}

interface TrainingSettingsFormProps {
  settings: TrainingSettings;
  setSettings: (s: TrainingSettings) => void;
}

const TrainingSettingsForm: React.FC<TrainingSettingsFormProps> = ({ settings, setSettings }) => {
  // Preview values for steepness envelope (dot symbol) based on character WPM
  const previewCharWpm = Math.max(1, settings.charWpm || settings.effectiveWpm || 20);
  const dotDurationMs: number = (1.2 / previewCharWpm) * 1000;
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
  const charMode = settings.charSetMode || 'koch';
  const digitsAsc = ['0','1','2','3','4','5','6','7','8','9'];
  const allChars = Object.keys(MORSE_CODE);
  const letters = allChars.filter(c => /[A-Z]/.test(c));
  const digits = allChars.filter(c => /[0-9]/.test(c)).sort();
  const punct = allChars.filter(c => !/[A-Z0-9]/.test(c));

  const currentPreviewChars: string[] = (() => {
    if (charMode === 'digits') {
      const lvl = Math.max(1, Math.min(10, settings.digitsLevel || 10));
      return digitsAsc.slice(0, lvl);
    }
    if (charMode === 'custom') {
      const set = Array.isArray(settings.customSet) ? settings.customSet : [];
      return Array.from(new Set(set.map(s => (s || '').toUpperCase()).filter(Boolean)));
    }
    return KOCH_SEQUENCE.slice(0, Math.max(1, Math.min(KOCH_SEQUENCE.length, settings.kochLevel || 1)));
  })();
  const [showSessionHelp, setShowSessionHelp] = useState(false);
  const [showToneHelp, setShowToneHelp] = useState(false);
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2 p-4 border border-gray-200 rounded-lg bg-slate-50">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-slate-700">Session & Groups</h4>
            <button
              type="button"
              onClick={() => setShowSessionHelp(v => !v)}
              className={`inline-flex items-center justify-center h-6 px-2 rounded-full text-xs font-semibold border transition-colors ${showSessionHelp ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'}`}
              title="What is Session & Groups?"
              aria-expanded={showSessionHelp}
            >
              ?
            </button>
          </div>
          {showSessionHelp && (
            <div className="mb-3 text-xs text-slate-700 bg-white border border-slate-200 rounded-lg p-3">
              <div className="font-semibold text-slate-800 mb-1">Session & Groups</div>
              <ul className="list-disc ml-4 space-y-1">
                <li><span className="font-medium">Character set</span>: Pick Koch progression, digits, or a custom pool.</li>
                <li><span className="font-medium">Speeds</span>: Character WPM vs Effective WPM (Farnsworth spacing). Link to keep equal.</li>
                <li><span className="font-medium">Spacing</span>: Extra word spacing multiplies the inter‑word gap.</li>
                <li><span className="font-medium">Groups</span>: Control number of groups, size range, timeout, and interactive mode.</li>
              </ul>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Character Set</label>
              <div className="flex gap-2 mb-3">
                {(['koch','digits','custom'] as const).map(mode => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setSettings({ ...settings, charSetMode: mode })}
                    className={`px-3 py-1.5 rounded-lg text-sm border ${charMode === mode ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white hover:bg-gray-50 border-gray-300 text-slate-700'}`}
                  >
                    {mode === 'koch' ? 'Koch' : mode === 'digits' ? 'Digits' : 'Custom'}
                  </button>
                ))}
              </div>
              {charMode === 'koch' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium min-h-[2.5rem] text-gray-700 mb-1">Koch Level (1-{KOCH_SEQUENCE.length})</label>
                    <input type="number" min="1" max={KOCH_SEQUENCE.length} value={settings.kochLevel} onChange={(e) => setSettings({ ...settings, kochLevel: parseInt(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 rounded" />
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-xs text-gray-500 mt-1 whitespace-normal break-words">Characters: {currentPreviewChars.join(' ')}</p>
                  </div>
                </div>
              )}
              {charMode === 'digits' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Digits Level (count)</label>
                    <input type="range" min={1} max={10} step={1} value={Math.max(1, Math.min(10, settings.digitsLevel || 10))} onChange={(e) => setSettings({ ...settings, digitsLevel: parseInt(e.target.value) })} className="w-full" />
                    <div className="text-xs text-gray-500 mt-1">{Math.max(1, Math.min(10, settings.digitsLevel || 10))} digits</div>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-xs text-gray-500 mt-1 whitespace-normal break-words">Digits: {currentPreviewChars.join(' ')}</p>
                  </div>
                </div>
              )}
              {charMode === 'custom' && (
                <div className="space-y-2">
                  <div className="flex gap-2 flex-wrap text-xs">
                    <button type="button" className="px-2 py-1 rounded border border-gray-300" onClick={() => setSettings({ ...settings, customSet: letters })}>Letters</button>
                    <button type="button" className="px-2 py-1 rounded border border-gray-300" onClick={() => setSettings({ ...settings, customSet: digitsAsc })}>Digits</button>
                    <button type="button" className="px-2 py-1 rounded border border-gray-300" onClick={() => setSettings({ ...settings, customSet: allChars })}>All</button>
                    <button type="button" className="px-2 py-1 rounded border border-gray-300" onClick={() => setSettings({ ...settings, customSet: [] })}>Clear</button>
                  </div>
                  <div className="grid grid-cols-8 sm:grid-cols-12 gap-1">
                    {allChars.map(ch => {
                      const enabled = (settings.customSet || []).includes(ch);
                      return (
                        <button
                          key={ch}
                          type="button"
                          onClick={() => {
                            const set = new Set((settings.customSet || []).map(s => s.toUpperCase()));
                            if (set.has(ch)) set.delete(ch); else set.add(ch);
                            setSettings({ ...settings, customSet: Array.from(set) });
                          }}
                          className={`flex w-full items-center justify-center h-8 text-sm leading-none rounded border select-none ${enabled ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-700 border-gray-300 hover:bg-gray-50'}`}
                          title={ch}
                        >{ch}</button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-500">Selected: {currentPreviewChars.join(' ') || '—'}</p>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium min-h-[2.5rem] text-gray-700 mb-1">Number of Groups</label>
              <input type="number" value={settings.numGroups} onChange={(e) => setSettings({ ...settings, numGroups: parseInt(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 rounded" />
            </div>
            {/* Farnsworth controls (always on) */}
            <div>
              <label className="block text-sm font-medium min-h-[2.5rem] text-gray-700 mb-1">Character Speed (WPM)</label>
              <input type="number" min={1} value={settings.charWpm} onChange={(e) => {
                const v = parseInt(e.target.value || '1');
                setSettings({ ...settings, charWpm: v, effectiveWpm: settings.linkSpeeds ? v : settings.effectiveWpm });
              }} className="w-full px-3 py-2 border border-gray-300 rounded" />
            </div>
            <div>
              <label className="block text-sm font-medium min-h-[2.5rem] text-gray-700 mb-1">Effective Speed (WPM)</label>
              <input type="number" min={1} value={settings.effectiveWpm} disabled={!!settings.linkSpeeds} onChange={(e) => setSettings({ ...settings, effectiveWpm: parseInt(e.target.value || '1') })} className="w-full px-3 py-2 border border-gray-300 rounded disabled:bg-gray-100" />
              <div className="mt-1 text-xs text-slate-600 flex items-center gap-2">
                <input type="checkbox" checked={!!settings.linkSpeeds} onChange={(e) => {
                  const link = e.target.checked;
                  setSettings({ ...settings, linkSpeeds: link, effectiveWpm: link ? settings.charWpm : settings.effectiveWpm });
                }} />
                <span>Link speeds (effective = character)</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium min-h-[2.5rem] text-gray-700 mb-1">Extra Word Spacing (×)</label>
              <input type="number" min={1} step={0.1} value={Math.max(1, settings.extraWordSpaceMultiplier ?? 1)} onChange={(e) => setSettings({ ...settings, extraWordSpaceMultiplier: Math.max(1, parseFloat(e.target.value || '1')) })} className="w-full px-3 py-2 border border-gray-300 rounded" />
            </div>
            <div>
              <label className="block text-sm font-medium min-h-[2.5rem] text-gray-700 mb-1">Group Timeout (seconds)</label>
              <input type="number" step="0.5" value={settings.groupTimeout} onChange={(e) => setSettings({ ...settings, groupTimeout: parseFloat(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 rounded" />
            </div>
            <div>
              <label className="block text-sm font-medium min-h-[2.5rem] text-gray-700 mb-1">Min Group Size</label>
              <input type="number" value={settings.minGroupSize} onChange={(e) => setSettings({ ...settings, minGroupSize: parseInt(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 rounded" />
            </div>
            <div>
              <label className="block text-sm font-medium min-h-[2.5rem] text-gray-700 mb-1">Max Group Size</label>
              <input type="number" value={settings.maxGroupSize} onChange={(e) => setSettings({ ...settings, maxGroupSize: parseInt(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 rounded" />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <input type="checkbox" checked={settings.interactiveMode} onChange={(e) => setSettings({ ...settings, interactiveMode: e.target.checked })} className="w-4 h-4" />
            <label className="text-sm font-medium text-gray-700">Interactive Mode (submit after each group)</label>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h5 className="text-sm font-semibold text-slate-700 mb-2">Auto Koch Level Adjustment</h5>
            <div className="flex items-center gap-2">
              <input
                id="autoAdjustKoch"
                type="checkbox"
                checked={!!settings.autoAdjustKoch}
                onChange={(e) => setSettings({ ...settings, autoAdjustKoch: e.target.checked })}
                className="w-4 h-4"
              />
              <label htmlFor="autoAdjustKoch" className="text-sm font-medium text-gray-700">Automatically adjust Koch level based on session accuracy</label>
            </div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Accuracy Threshold (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={Math.max(0, Math.min(100, settings.autoAdjustThreshold ?? 90))}
                  onChange={(e) => setSettings({ ...settings, autoAdjustThreshold: Math.max(0, Math.min(100, parseInt(e.target.value || '0'))) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                />
                <p className="text-xs text-gray-500 mt-1">If accuracy ≥ threshold: increase level; otherwise decrease by 1.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="sm:col-span-2 p-4 border border-gray-200 rounded-lg bg-slate-50">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-slate-700">Tone & Envelope</h4>
            <button
              type="button"
              onClick={() => setShowToneHelp(v => !v)}
              className={`inline-flex items-center justify-center h-6 px-2 rounded-full text-xs font-semibold border transition-colors ${showToneHelp ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'}`}
              title="What is Tone & Envelope?"
              aria-expanded={showToneHelp}
            >
              ?
            </button>
          </div>
          {showToneHelp && (
            <div className="mb-3 text-xs text-slate-700 bg-white border border-slate-200 rounded-lg p-3">
              <div className="font-semibold text-slate-800 mb-1">Tone & Envelope</div>
              <ul className="list-disc ml-4 space-y-1">
                <li><span className="font-medium">Tone</span>: Choose min/max sidetone. Equal values lock a fixed tone.</li>
                <li><span className="font-medium">Steepness</span>: Attack/decay time of each dit/dah; higher is smoother, slower.</li>
                <li><span className="font-medium">Smoothness</span>: Curved vs linear envelope; higher blends edges to reduce clicks.</li>
                <li><span className="font-medium">Preview</span>: The chart shows a dot’s amplitude envelope at current WPM.</li>
              </ul>
            </div>
          )}
          <div className="grid grid-cols-1 gap-4">
            {/* Speed and Side Tone in a single row as number inputs (spinbuttons) */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tone Min (Hz)</label>
                <input type="number" min={100} max={2000} step={50} value={settings.sideToneMin} onChange={(e) => setSettings({ ...settings, sideToneMin: parseInt(e.target.value || '600') })} className="w-full px-3 py-2 border border-gray-300 rounded" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tone Max (Hz)</label>
                <input type="number" min={100} max={2000} step={50} value={settings.sideToneMax} onChange={(e) => setSettings({ ...settings, sideToneMax: parseInt(e.target.value || '600') })} className="w-full px-3 py-2 border border-gray-300 rounded" />
                <p className="text-xs text-gray-500 mt-1">Equal min/max = fixed tone.</p>
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
          <p className="text-[11px] text-gray-500 mt-2">Rise/decay: {Math.round(riseMs)} ms • Dot ≈ {Math.round(dotDurationMs)} ms @ {previewCharWpm} WPM • Smoothness: {Math.round(smoothing * 100)}%</p>
        </div>
      </div>

      {/* Removed duplicate Envelope Smoothness slider (kept within Tone & Envelope group) */}
    </>
  );
};

export default TrainingSettingsForm;


