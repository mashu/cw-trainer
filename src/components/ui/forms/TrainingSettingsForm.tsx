import React, { useState } from 'react';
import { Line, LineChart, ResponsiveContainer, CartesianGrid, XAxis, YAxis } from 'recharts';

import { KOCH_SEQUENCE, MORSE_CODE } from '@/lib/morseConstants';

export interface TrainingSettings {
  kochLevel: number;
  charSetMode?: 'koch' | 'digits' | 'custom';
  digitsLevel?: number;
  customSet?: string[];
  sideToneMin: number;
  sideToneMax: number;
  steepness: number;
  sessionDuration: number;
  charsPerGroup: number;
  numGroups: number;
  charWpm: number;
  effectiveWpm: number;
  linkSpeeds: boolean;
  extraWordSpaceMultiplier?: number;
  groupTimeout: number;
  minGroupSize: number;
  maxGroupSize: number;
  interactiveMode: boolean;
  envelopeSmoothing?: number;
  autoAdjustKoch?: boolean;
  autoAdjustThreshold?: number;
}

interface TrainingSettingsFormProps {
  settings: TrainingSettings;
  setSettings: (
    settings: TrainingSettings | ((prev: TrainingSettings) => TrainingSettings),
  ) => void;
}

export function TrainingSettingsForm({
  settings,
  setSettings,
}: TrainingSettingsFormProps): JSX.Element {
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

  const charMode = settings.charSetMode || 'koch';
  const digitsAsc = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  const allChars = Object.keys(MORSE_CODE);
  const letters = allChars.filter((character) => /[A-Z]/.test(character));

  const resolvePreviewChars = (): string[] => {
    if (charMode === 'digits') {
      const level = Math.max(1, Math.min(10, settings.digitsLevel || 10));
      return digitsAsc.slice(0, level);
    }
    if (charMode === 'custom') {
      const set = Array.isArray(settings.customSet) ? settings.customSet : [];
      return Array.from(new Set(set.map((entry) => (entry || '').toUpperCase()).filter(Boolean)));
    }
    return KOCH_SEQUENCE.slice(
      0,
      Math.max(1, Math.min(KOCH_SEQUENCE.length, settings.kochLevel || 1)),
    );
  };

  const currentPreviewChars = resolvePreviewChars();

  const [showSessionHelp, setShowSessionHelp] = useState(false);
  const [showToneHelp, setShowToneHelp] = useState(false);

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2 p-4 border border-gray-200 rounded-lg bg-slate-50">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-slate-700">Session &amp; Groups</h4>
            <button
              type="button"
              onClick={() => setShowSessionHelp((value) => !value)}
              className={`inline-flex items-center justify-center h-6 px-2 rounded-full text-xs font-semibold border transition-colors ${
                showSessionHelp
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
              title="What is Session &amp; Groups?"
              aria-expanded={showSessionHelp}
            >
              ?
            </button>
          </div>
          {showSessionHelp && (
            <div className="mb-3 text-xs text-slate-700 bg-white border border-slate-200 rounded-lg p-3">
              <div className="font-semibold text-slate-800 mb-1">Session &amp; Groups</div>
              <ul className="list-disc ml-4 space-y-1">
                <li>
                  <span className="font-medium">Character set</span>: Pick Koch progression, digits,
                  or a custom pool.
                </li>
                <li>
                  <span className="font-medium">Speeds</span>: Character WPM vs Effective WPM
                  (Farnsworth spacing). Link to keep equal.
                </li>
                <li>
                  <span className="font-medium">Spacing</span>: Extra word spacing multiplies the
                  inter-word gap.
                </li>
                <li>
                  <span className="font-medium">Groups</span>: Control number of groups, size range,
                  timeout, and interactive mode.
                </li>
              </ul>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Character Set</label>
              <div className="flex gap-2 mb-3">
                {(['koch', 'digits', 'custom'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setSettings({ ...settings, charSetMode: mode })}
                    className={`px-3 py-1.5 rounded-lg text-sm border ${
                      charMode === mode
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white hover:bg-gray-50 border-gray-300 text-slate-700'
                    }`}
                  >
                    {mode === 'koch' ? 'Koch' : mode === 'digits' ? 'Digits' : 'Custom'}
                  </button>
                ))}
              </div>
              {charMode === 'koch' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium min-h-[2.5rem] text-gray-700 mb-1">
                      Koch Level (1-{KOCH_SEQUENCE.length})
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={KOCH_SEQUENCE.length}
                      value={settings.kochLevel}
                      onChange={(event) =>
                        setSettings({ ...settings, kochLevel: parseInt(event.target.value, 10) })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-xs text-gray-500 mt-1 whitespace-normal break-words">
                      Characters: {currentPreviewChars.join(' ')}
                    </p>
                  </div>
                </div>
              )}
              {charMode === 'digits' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Digits Level (count)
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      step={1}
                      value={Math.max(1, Math.min(10, settings.digitsLevel || 10))}
                      onChange={(event) =>
                        setSettings({ ...settings, digitsLevel: parseInt(event.target.value, 10) })
                      }
                      className="w-full"
                    />
                    <div className="text-xs text-gray-500 mt-1">
                      {Math.max(1, Math.min(10, settings.digitsLevel || 10))} digits
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-xs text-gray-500 mt-1 whitespace-normal break-words">
                      Digits: {currentPreviewChars.join(' ')}
                    </p>
                  </div>
                </div>
              )}
              {charMode === 'custom' && (
                <div className="space-y-2">
                  <div className="flex gap-2 flex-wrap text-xs">
                    <button
                      type="button"
                      className="px-2 py-1 rounded border border-gray-300"
                      onClick={() => setSettings({ ...settings, customSet: letters })}
                    >
                      Letters
                    </button>
                    <button
                      type="button"
                      className="px-2 py-1 rounded border border-gray-300"
                      onClick={() => setSettings({ ...settings, customSet: digitsAsc })}
                    >
                      Digits
                    </button>
                    <button
                      type="button"
                      className="px-2 py-1 rounded border border-gray-300"
                      onClick={() => setSettings({ ...settings, customSet: allChars })}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      className="px-2 py-1 rounded border border-gray-300"
                      onClick={() => setSettings({ ...settings, customSet: [] })}
                    >
                      Clear
                    </button>
                  </div>
                  <div className="grid grid-cols-8 sm:grid-cols-12 gap-1">
                    {allChars.map((character) => {
                      const enabled = (settings.customSet || []).includes(character);
                      return (
                        <button
                          key={character}
                          type="button"
                          onClick={() => {
                            const set = new Set(
                              (settings.customSet || []).map((entry) => entry.toUpperCase()),
                            );
                            if (set.has(character)) {
                              set.delete(character);
                            } else {
                              set.add(character);
                            }
                            setSettings({ ...settings, customSet: Array.from(set) });
                          }}
                          className={`flex w-full items-center justify-center h-8 text-sm leading-none rounded border select-none ${
                            enabled
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white text-slate-700 border-gray-300 hover:bg-gray-50'
                          }`}
                          title={character}
                        >
                          {character}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-500">
                    Selected: {currentPreviewChars.join(' ') || '—'}
                  </p>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium min-h-[2.5rem] text-gray-700 mb-1">
                Number of Groups
              </label>
              <input
                type="number"
                value={settings.numGroups}
                onChange={(event) =>
                  setSettings({ ...settings, numGroups: parseInt(event.target.value, 10) })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium min-h-[2.5rem] text-gray-700 mb-1">
                Character Speed (WPM)
              </label>
              <input
                type="number"
                min={1}
                value={settings.charWpm}
                onChange={(event) => {
                  const value = parseInt(event.target.value || '1', 10);
                  setSettings({
                    ...settings,
                    charWpm: value,
                    effectiveWpm: settings.linkSpeeds ? value : settings.effectiveWpm,
                  });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium min-h-[2.5rem] text-gray-700 mb-1">
                Effective Speed (WPM)
              </label>
              <input
                type="number"
                min={1}
                value={settings.effectiveWpm}
                disabled={Boolean(settings.linkSpeeds)}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    effectiveWpm: parseInt(event.target.value || '1', 10),
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded disabled:bg-gray-100"
              />
              <div className="mt-1 text-xs text-slate-600 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={Boolean(settings.linkSpeeds)}
                  onChange={(event) => {
                    const link = event.target.checked;
                    setSettings({
                      ...settings,
                      linkSpeeds: link,
                      effectiveWpm: link ? settings.charWpm : settings.effectiveWpm,
                    });
                  }}
                />
                <span>Link speeds (effective = character)</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium min-h-[2.5rem] text-gray-700 mb-1">
                Extra Word Spacing (×)
              </label>
              <input
                type="number"
                min={1}
                step={0.1}
                value={Math.max(1, settings.extraWordSpaceMultiplier ?? 1)}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    extraWordSpaceMultiplier: Math.max(1, parseFloat(event.target.value || '1')),
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium min-h-[2.5rem] text-gray-700 mb-1">
                Group Timeout (seconds)
              </label>
              <input
                type="number"
                step="0.5"
                value={settings.groupTimeout}
                onChange={(event) =>
                  setSettings({ ...settings, groupTimeout: parseFloat(event.target.value) })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium min-h-[2.5rem] text-gray-700 mb-1">
                Min Group Size
              </label>
              <input
                type="number"
                value={settings.minGroupSize}
                onChange={(event) =>
                  setSettings({ ...settings, minGroupSize: parseInt(event.target.value, 10) })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium min-h-[2.5rem] text-gray-700 mb-1">
                Max Group Size
              </label>
              <input
                type="number"
                value={settings.maxGroupSize}
                onChange={(event) =>
                  setSettings({ ...settings, maxGroupSize: parseInt(event.target.value, 10) })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <input
              type="checkbox"
              checked={settings.interactiveMode}
              onChange={(event) =>
                setSettings({ ...settings, interactiveMode: event.target.checked })
              }
              className="w-4 h-4"
            />
            <label className="text-sm font-medium text-gray-700">
              Interactive Mode (submit after each group)
            </label>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h5 className="text-sm font-semibold text-slate-700 mb-2">
              Auto Koch Level Adjustment
            </h5>
            <div className="flex items-center gap-2">
              <input
                id="autoAdjustKoch"
                type="checkbox"
                checked={Boolean(settings.autoAdjustKoch)}
                onChange={(event) =>
                  setSettings({ ...settings, autoAdjustKoch: event.target.checked })
                }
                className="w-4 h-4"
              />
              <label htmlFor="autoAdjustKoch" className="text-sm font-medium text-gray-700">
                Automatically adjust Koch level based on session accuracy
              </label>
            </div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Accuracy Threshold (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={Math.max(0, Math.min(100, settings.autoAdjustThreshold ?? 90))}
                  onChange={(event) =>
                    setSettings({
                      ...settings,
                      autoAdjustThreshold: Math.max(
                        0,
                        Math.min(100, parseInt(event.target.value || '0', 10)),
                      ),
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                />
                <p className="text-xs text-gray-500 mt-1">
                  If accuracy ≥ threshold: increase level; otherwise decrease by 1.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="sm:col-span-2 p-4 border border-gray-200 rounded-lg bg-slate-50">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-slate-700">Tone &amp; Envelope</h4>
            <button
              type="button"
              onClick={() => setShowToneHelp((value) => !value)}
              className={`inline-flex items-center justify-center h-6 px-2 rounded-full text-xs font-semibold border transition-colors ${
                showToneHelp
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
              title="What is Tone &amp; Envelope?"
              aria-expanded={showToneHelp}
            >
              ?
            </button>
          </div>
          {showToneHelp && (
            <div className="mb-3 text-xs text-slate-700 bg-white border border-slate-200 rounded-lg p-3">
              <div className="font-semibold text-slate-800 mb-1">Tone &amp; Envelope</div>
              <ul className="list-disc ml-4 space-y-1">
                <li>
                  <span className="font-medium">Tone</span>: Choose min/max sidetone. Equal values
                  lock a fixed tone.
                </li>
                <li>
                  <span className="font-medium">Steepness</span>: Attack/decay time of each dit/dah;
                  higher is smoother, slower.
                </li>
                <li>
                  <span className="font-medium">Smoothness</span>: Curved vs linear envelope; higher
                  blends edges to reduce clicks.
                </li>
                <li>
                  <span className="font-medium">Preview</span>: The chart shows a dot’s amplitude
                  envelope at current WPM.
                </li>
              </ul>
            </div>
          )}
          <div className="grid grid-cols-1 gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tone Min (Hz)
                </label>
                <input
                  type="number"
                  min={100}
                  max={2000}
                  step={50}
                  value={settings.sideToneMin}
                  onChange={(event) =>
                    setSettings({
                      ...settings,
                      sideToneMin: parseInt(event.target.value || '600', 10),
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tone Max (Hz)
                </label>
                <input
                  type="number"
                  min={100}
                  max={2000}
                  step={50}
                  value={settings.sideToneMax}
                  onChange={(event) =>
                    setSettings({
                      ...settings,
                      sideToneMax: parseInt(event.target.value || '600', 10),
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                />
                <p className="text-xs text-gray-500 mt-1">Equal min/max = fixed tone.</p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Steepness (ms)</label>
              <input
                type="range"
                min={1}
                max={50}
                step={1}
                value={settings.steepness}
                onChange={(event) =>
                  setSettings({ ...settings, steepness: parseInt(event.target.value, 10) })
                }
                className="w-full"
              />
              <div className="text-xs text-gray-500 mt-1">{settings.steepness} ms</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Envelope Smoothness
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={smoothing}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    envelopeSmoothing: Math.max(0, Math.min(1, parseFloat(event.target.value))),
                  })
                }
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>Linear</span>
                <span>Smooth</span>
              </div>
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
            Rise/decay: {Math.round(riseMs)} ms • Dot ≈ {Math.round(dotDurationMs)} ms @{' '}
            {previewCharWpm} WPM • Smoothness: {Math.round(smoothing * 100)}%
          </p>
        </div>
      </div>
    </>
  );
}
