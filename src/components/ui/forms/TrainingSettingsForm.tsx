'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Line, LineChart, ResponsiveContainer, CartesianGrid, XAxis, YAxis } from 'recharts';

import { KOCH_SEQUENCE, MORSE_CODE } from '@/lib/morseConstants';
import { SEQUENCE_PRESETS } from '@/lib/sequencePresets';

import { SequenceEditorModal } from './SequenceEditorModal';

export interface TrainingSettings {
  kochLevel: number;
  charSetMode?: 'koch' | 'digits' | 'custom';
  digitsLevel?: number;
  customSet?: string[];
  customSequence?: string[]; // Custom sequence order for Koch mode
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
  // Local state for WPM inputs to allow empty/invalid values while typing
  const [charWpmInput, setCharWpmInput] = useState<string>(String(settings.charWpm));
  const [effectiveWpmInput, setEffectiveWpmInput] = useState<string>(String(settings.effectiveWpm));
  
  // Sync local state when settings change externally
  useEffect(() => {
    setCharWpmInput(String(settings.charWpm));
  }, [settings.charWpm]);
  
  useEffect(() => {
    // Only update effectiveWpmInput if speeds are not linked
    // (when linked, it's controlled by charWpm changes)
    if (!settings.linkSpeeds) {
      setEffectiveWpmInput(String(settings.effectiveWpm));
    } else {
      // When linked, sync with charWpm
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

  const charMode = settings.charSetMode || 'koch';
  const digitsAsc = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  // Filter out prosigns (characters with < > format) - only single characters allowed
  const allChars = Object.keys(MORSE_CODE).filter(char => {
    // Exclude prosigns (format like <AR>, <BT>, etc.)
    return !(char.startsWith('<') && char.endsWith('>'));
  });
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
    // Use custom sequence if available, otherwise fall back to KOCH_SEQUENCE
    const sequence = Array.isArray(settings.customSequence) && settings.customSequence.length > 0
      ? settings.customSequence
      : KOCH_SEQUENCE;
    // Level 1 = 2 characters, Level 2 = 3 characters, etc. (characters = level + 1)
    const charCount = Math.min((settings.kochLevel || 1) + 1, sequence.length);
    return sequence.slice(0, Math.max(2, charCount));
  };

  const currentPreviewChars = resolvePreviewChars();
  
  // Get current sequence for level calculation
  const currentSequence = useMemo(() => {
    if (charMode === 'koch') {
      return Array.isArray(settings.customSequence) && settings.customSequence.length > 0
        ? settings.customSequence
        : KOCH_SEQUENCE;
    }
    return [];
  }, [charMode, settings.customSequence]);

  const [showSessionHelp, setShowSessionHelp] = useState(false);
  const [showToneHelp, setShowToneHelp] = useState(false);
  const [showSequenceEditor, setShowSequenceEditor] = useState(false);

  // Detect which preset matches the current sequence
  const currentPresetId = useMemo(() => {
    // If no customSequence is set, use KOCH_SEQUENCE
    const sequence = Array.isArray(settings.customSequence) && settings.customSequence.length > 0
      ? settings.customSequence
      : KOCH_SEQUENCE;
    const sequenceStr = sequence.join(',');
    const matchingPreset = SEQUENCE_PRESETS.find(
      (preset) => preset.sequence.join(',') === sequenceStr
    );
    // If no customSequence was set and it matches KOCH, return 'koch'
    // Otherwise return the matching preset or 'custom'
    if (!Array.isArray(settings.customSequence) || settings.customSequence.length === 0) {
      return matchingPreset?.id || 'koch';
    }
    return matchingPreset?.id || 'custom';
  }, [settings.customSequence]);

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
                {(['koch', 'digits'] as const).map((mode) => (
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
                    {mode === 'koch' ? 'Koch' : 'Digits'}
                  </button>
                ))}
              </div>
              {charMode === 'koch' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Preset Sequence
                      </label>
                      <div className="relative">
                        <select
                          value={currentPresetId}
                          onChange={(e) => {
                            const presetId = e.target.value;
                            if (presetId === 'custom') {
                              // Keep current custom sequence, do nothing
                              return;
                            }
                            const preset = SEQUENCE_PRESETS.find(p => p.id === presetId);
                            if (preset) {
                              setSettings({ ...settings, customSequence: preset.sequence });
                            }
                          }}
                          className="w-full px-3 py-2 pr-8 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 appearance-none"
                        >
                          {SEQUENCE_PRESETS.map((preset) => (
                            <option key={preset.id} value={preset.id}>
                              {preset.name}
                            </option>
                          ))}
                          {currentPresetId === 'custom' && (
                            <option value="custom">✨ Custom Sequence</option>
                          )}
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                    </div>
                    <div className="pt-6">
                      <button
                        type="button"
                        onClick={() => {
                          setShowSequenceEditor(true);
                        }}
                        className="p-2 text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors flex items-center justify-center"
                        title="Edit sequence order"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Sequence Level (1-{Math.max(1, currentSequence.length - 1)})
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={Math.max(1, currentSequence.length - 1)}
                      value={settings.kochLevel}
                      onChange={(event) => {
                        const numValue = parseInt(event.target.value, 10);
                        const maxLevel = Math.max(1, currentSequence.length - 1);
                        if (!isNaN(numValue) && numValue >= 1 && numValue <= maxLevel) {
                          setSettings({ ...settings, kochLevel: numValue });
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Level {settings.kochLevel} = {Math.min(settings.kochLevel + 1, currentSequence.length)} characters
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">
                      Characters: {currentPreviewChars.join(' ')}
                    </p>
                  </div>
                  <SequenceEditorModal
                    open={showSequenceEditor}
                    onClose={() => setShowSequenceEditor(false)}
                    sequence={
                      Array.isArray(settings.customSequence) && settings.customSequence.length > 0
                        ? settings.customSequence
                        : KOCH_SEQUENCE
                    }
                    onChange={(newSequence) => {
                      setSettings({ ...settings, customSequence: newSequence });
                    }}
                  />
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
                <CustomAlphabetEditor
                  customSet={settings.customSet || []}
                  onCustomSetChange={(newSet) => {
                    setSettings({ ...settings, customSet: newSet });
                  }}
                  allChars={allChars}
                  letters={letters}
                  digitsAsc={digitsAsc}
                />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium min-h-[2.5rem] text-gray-700 mb-1">
                Number of Groups
              </label>
              <input
                type="number"
                min={1}
                value={settings.numGroups}
                onChange={(event) => {
                  const numValue = parseInt(event.target.value, 10);
                  if (!isNaN(numValue) && numValue > 0) {
                    setSettings({ ...settings, numGroups: numValue });
                  }
                }}
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
                step={1}
                value={charWpmInput}
                onChange={(event) => {
                  const inputValue = event.target.value;
                  // Update local state immediately to allow free typing
                  setCharWpmInput(inputValue);
                  // Only update settings if we have a valid number
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
                  // On blur, ensure we have a valid value
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
                    // Ensure local state matches the validated value
                    setCharWpmInput(String(numValue));
                  }
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
                step={1}
                value={effectiveWpmInput}
                disabled={Boolean(settings.linkSpeeds)}
                onChange={(event) => {
                  const inputValue = event.target.value;
                  // Update local state immediately to allow free typing
                  setEffectiveWpmInput(inputValue);
                  // Only update settings if we have a valid number
                  const numValue = parseFloat(inputValue);
                  if (!isNaN(numValue) && numValue > 0) {
                    setSettings({
                      ...settings,
                      effectiveWpm: numValue,
                    });
                  }
                }}
                onBlur={(event) => {
                  // On blur, ensure we have a valid value
                  const numValue = parseFloat(event.target.value);
                  if (isNaN(numValue) || numValue <= 0) {
                    const validValue = 1;
                    setEffectiveWpmInput(String(validValue));
                    setSettings({
                      ...settings,
                      effectiveWpm: validValue,
                    });
                  } else {
                    // Ensure local state matches the validated value
                    setEffectiveWpmInput(String(numValue));
                  }
                }}
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
                    // Sync local state when linking speeds
                    if (link) {
                      setEffectiveWpmInput(String(settings.charWpm));
                    }
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
                min={0.1}
                step={0.1}
                value={settings.extraWordSpaceMultiplier ?? 1}
                onChange={(event) => {
                  const numValue = parseFloat(event.target.value);
                  if (!isNaN(numValue) && numValue > 0) {
                    setSettings({
                      ...settings,
                      extraWordSpaceMultiplier: numValue,
                    });
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium min-h-[2.5rem] text-gray-700 mb-1">
                Group Timeout (seconds)
              </label>
              <input
                type="number"
                min={0}
                step={0.1}
                value={settings.groupTimeout}
                onChange={(event) => {
                  const numValue = parseFloat(event.target.value);
                  if (!isNaN(numValue) && numValue >= 0) {
                    setSettings({ ...settings, groupTimeout: numValue });
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium min-h-[2.5rem] text-gray-700 mb-1">
                Min Group Size
              </label>
              <input
                type="number"
                min={1}
                value={settings.minGroupSize}
                onChange={(event) => {
                  const numValue = parseInt(event.target.value, 10);
                  if (!isNaN(numValue) && numValue > 0) {
                    setSettings({ ...settings, minGroupSize: numValue });
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium min-h-[2.5rem] text-gray-700 mb-1">
                Max Group Size
              </label>
              <input
                type="number"
                min={1}
                value={settings.maxGroupSize}
                onChange={(event) => {
                  const numValue = parseInt(event.target.value, 10);
                  if (!isNaN(numValue) && numValue > 0) {
                    setSettings({ ...settings, maxGroupSize: numValue });
                  }
                }}
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
              Auto Sequence Level Adjustment
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
                Automatically adjust sequence level based on session accuracy
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
                  value={settings.autoAdjustThreshold ?? 90}
                  onChange={(event) => {
                    const numValue = parseInt(event.target.value, 10);
                    if (!isNaN(numValue) && numValue >= 0 && numValue <= 100) {
                      setSettings({
                        ...settings,
                        autoAdjustThreshold: numValue,
                      });
                    }
                  }}
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
                  step={1}
                  value={settings.sideToneMin}
                  onChange={(event) => {
                    const numValue = parseInt(event.target.value, 10);
                    if (!isNaN(numValue) && numValue >= 100 && numValue <= 2000) {
                      setSettings({
                        ...settings,
                        sideToneMin: numValue,
                      });
                    }
                  }}
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
                  step={1}
                  value={settings.sideToneMax}
                  onChange={(event) => {
                    const numValue = parseInt(event.target.value, 10);
                    if (!isNaN(numValue) && numValue >= 100 && numValue <= 2000) {
                      setSettings({
                        ...settings,
                        sideToneMax: numValue,
                      });
                    }
                  }}
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

interface CustomAlphabetEditorProps {
  customSet: string[];
  onCustomSetChange: (newSet: string[]) => void;
  allChars: string[];
  letters: string[];
  digitsAsc: string[];
}

function CustomAlphabetEditor({
  customSet,
  onCustomSetChange,
  allChars,
  letters,
  digitsAsc,
}: CustomAlphabetEditorProps): JSX.Element {
  const [draggedItem, setDraggedItem] = useState<{ char: string; index: number } | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [originalSet, setOriginalSet] = useState<string[]>([]);

  // Store original set when component mounts or set changes significantly
  useEffect(() => {
    if (customSet.length > 0 && originalSet.length === 0) {
      setOriginalSet([...customSet]);
    }
  }, [customSet, originalSet]);

  const handleDragStart = useCallback((char: string, index: number) => {
    setDraggedItem({ char, index });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedItem) return;
    
    e.dataTransfer.dropEffect = 'move';
    
    if (draggedItem.index !== index) {
      setDragOverIndex(index);
    } else {
      setDragOverIndex(null);
    }
  }, [draggedItem]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear if we're actually leaving the element (not just moving to a child)
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setDragOverIndex(null);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!draggedItem) {
      setDragOverIndex(null);
      return;
    }
    
    const sourceIndex = draggedItem.index;
    if (sourceIndex === dropIndex) {
      setDraggedItem(null);
      setDragOverIndex(null);
      return;
    }

    const newSet = [...customSet];
    
    // Remove the dragged item
    const removed = newSet.splice(sourceIndex, 1)[0];
    if (removed === undefined) {
      setDraggedItem(null);
      setDragOverIndex(null);
      return;
    }
    
    // Calculate the correct insertion index
    // If dragging to the right, we need to account for the removed item
    const insertIndex = sourceIndex < dropIndex ? dropIndex - 1 : dropIndex;
    
    // Insert at the new position
    newSet.splice(insertIndex, 0, removed);
    
    // Update the set
    onCustomSetChange(newSet);
    
    // Clean up
    setDraggedItem(null);
    setDragOverIndex(null);
  }, [draggedItem, customSet, onCustomSetChange]);

  const handleDragEnd = useCallback(() => {
    setDraggedItem(null);
    setDragOverIndex(null);
  }, []);

  const handleToggleChar = useCallback((character: string) => {
    const set = new Set(customSet.map((entry) => entry.toUpperCase()));
    if (set.has(character)) {
      set.delete(character);
    } else {
      set.add(character);
    }
    onCustomSetChange(Array.from(set));
  }, [customSet, onCustomSetChange]);

  const availableChars = useMemo(() => {
    return allChars.filter((char) => !customSet.includes(char));
  }, [allChars, customSet]);

  return (
    <div className="space-y-4">
      {/* Quick Actions */}
      <div className="flex gap-2 flex-wrap text-xs items-center">
        <button
          type="button"
          className="px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50"
          onClick={() => {
            onCustomSetChange(letters);
            setOriginalSet([...letters]);
          }}
        >
          Letters
        </button>
        <button
          type="button"
          className="px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50"
          onClick={() => {
            onCustomSetChange(digitsAsc);
            setOriginalSet([...digitsAsc]);
          }}
        >
          Digits
        </button>
        <button
          type="button"
          className="px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50"
          onClick={() => {
            onCustomSetChange(allChars);
            setOriginalSet([...allChars]);
          }}
        >
          All
        </button>
        <button
          type="button"
          className="px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50"
          onClick={() => {
            onCustomSetChange([]);
            setOriginalSet([]);
          }}
        >
          Clear
        </button>
        {originalSet.length > 0 && (
          <button
            type="button"
            className="px-2 py-1 rounded border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-700"
            onClick={() => onCustomSetChange([...originalSet])}
            title="Reset to original order"
          >
            ↺ Reset
          </button>
        )}
      </div>

      {/* Enabled Characters - Draggable */}
      {customSet.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Selected Characters ({customSet.length}) - Drag to reorder
          </label>
          <div className="min-h-[100px] p-4 bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg border border-slate-200">
            <div 
              className="grid grid-cols-5 gap-2"
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (draggedItem) {
                  setDraggedItem(null);
                  setDragOverIndex(null);
                }
              }}
            >
              {customSet.map((character, index) => {
                const isDragging = draggedItem?.index === index;
                const isDragOver = dragOverIndex === index;
                const displayChar = character || '';
                const morse = MORSE_CODE[character] || '';

                return (
                  <div
                    key={`${character}-${index}`}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'move';
                      handleDragStart(character, index);
                    }}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`
                      group relative flex items-center justify-center
                      h-10 rounded-lg border-2 font-semibold text-xs
                      cursor-move transition-all duration-200
                      ${isDragging
                        ? 'opacity-50 scale-95 bg-slate-300 border-slate-400 shadow-lg z-50'
                        : isDragOver
                        ? 'scale-110 bg-indigo-100 border-indigo-400 shadow-md ring-2 ring-indigo-300'
                        : 'bg-white hover:bg-indigo-50 border-slate-300 hover:border-indigo-400 hover:shadow-md'
                      }
                    `}
                    title={`${displayChar} (${morse}) - Drag to reorder`}
                  >
                    <span className="text-slate-800">
                      {displayChar}
                    </span>
                    {!isDragging && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleChar(character);
                        }}
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-600"
                        title="Remove character"
                      >
                        ×
                      </button>
                    )}
                    {isDragOver && (
                      <div className="absolute inset-0 border-2 border-dashed border-indigo-500 rounded-lg" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            💡 Drag characters to reorder • Click × to remove
          </p>
        </div>
      )}

      {/* Available Characters to Add */}
      {availableChars.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Add Characters ({availableChars.length} available)
          </label>
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="grid grid-cols-5 gap-2">
              {availableChars.map((character) => {
                const displayChar = character || '';
                const morse = MORSE_CODE[character] || '';
                
                return (
                  <button
                    key={character}
                    type="button"
                    onClick={() => handleToggleChar(character)}
                    className="h-10 rounded border border-gray-300 bg-white text-slate-700 hover:bg-indigo-50 hover:border-indigo-400 text-xs font-medium transition-all hover:shadow-sm flex items-center justify-center"
                    title={`${displayChar} (${morse})`}
                  >
                    {displayChar}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Preview */}
      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
        <p className="text-xs font-medium text-slate-700 mb-1">Preview:</p>
        <p className="text-xs text-slate-600 break-words font-mono">
          {customSet.length > 0 ? customSet.join(' ') : '—'}
        </p>
      </div>
    </div>
  );
}
