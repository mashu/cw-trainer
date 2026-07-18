'use client';

import React, { useEffect, useState, useMemo } from 'react';

import { useNumberField } from '@/hooks/useNumberField';
import {
  EXTRA_SPACING_LABEL,
  EXTRA_SPACING_MULTIPLIER_MIN,
  EXTRA_SPACING_SETTINGS_HELP,
} from '@/lib/extraSpacing';
import {
  digitsUnlockedCount,
  nextMixedUnlockPreviewChar,
  unlockedCharCountForLevel,
} from '@/lib/levelUnlock';
import { LCWO_SEQUENCE, MORSE_CODE } from '@/lib/morseConstants';
import { SEQUENCE_PRESETS } from '@/lib/sequencePresets';
import { computeCharPool } from '@/lib/trainingUtils';

import {
  AutoLevelAdjustProfiles,
  type AutoLevelAdjustProfileMode,
} from './AutoLevelAdjustProfiles';
import { CustomAlphabetEditor } from './CustomAlphabetEditor';
import { LinkedRangeInput } from './LinkedRangeInput';
import { BandConditionsSection } from './sections/BandConditionsSection';
import { ToneEnvelopeSection } from './sections/ToneEnvelopeSection';
import { SequenceEditorModal } from './SequenceEditorModal';

export interface FormTrainingSettings {
  kochLevel: number;
  charSetMode?: 'koch' | 'digits' | 'custom' | 'mixed';
  digitsLevel?: number;
  /** When charSetMode is 'mixed': 0–100 = percent of characters that are letters. Default 70. */
  mixedLettersPercent?: number;
  /** Mixed auto-level: which axis adjusts on the next qualifying session. */
  mixedAutoLevelNextAxis?: 'letters' | 'digits';
  customSet?: string[];
  customSequence?: string[]; // Custom sequence order for Koch mode
  slidingWindowStart?: number; // 1-based start index in unlocked sequence (1 = first)
  slidingWindowEnd?: number; // 1-based end index (inclusive); default wide = all unlocked
  sideToneMin: number;
  sideToneMax: number;
  volumeMin?: number;
  volumeMax?: number;
  linkVolume?: boolean;
  steepness: number;
  sessionDuration: number;
  charsPerGroup: number;
  numGroups: number;
  charWpmMin: number;
  charWpmMax: number;
  linkCharWpm: boolean;
  effectiveWpmMin: number;
  effectiveWpmMax: number;
  linkEffectiveWpm: boolean;
  linkCharToEffective: boolean;
  echoKeyerMode?: 'manual' | 'iambic-b';
  extraWordSpaceMultiplier?: number;
  groupTimeout: number;
  lockInputDuringGroupPlayback?: boolean;
  minGroupSize: number;
  maxGroupSize: number;
  linkGroupSize: boolean;
  envelopeSmoothing?: number;
  qsbEnabled?: boolean;
  qsbDepth?: number;
  qsbRateHz?: number;
  qrnEnabled?: boolean;
  qrnLevel?: number;
  qrmEnabled?: boolean;
  qrmLevel?: number;
  qrmProfile?: 'whistle' | 'ringing' | 'mixed';
  receiverBackgroundGain?: number;
  receiverBackgroundExcitationRate?: number;
  receiverBackgroundResonance?: number;
  receiverBackgroundDecay?: number;
  receiverBackgroundOffsetHz?: number;
  receiverBackgroundOffsetModDepthHz?: number;
  receiverBackgroundOffsetModRateHz?: number;
  autoAdjustKoch?: boolean;
  autoAdjustThreshold?: number;
  autoAdjustBelowThresholdCount?: number;
  autoAdjustAboveThresholdCount?: number;
  echoAutoAdjustKoch?: boolean;
  echoAutoAdjustThreshold?: number;
  echoAutoAdjustBelowThresholdCount?: number;
  echoAutoAdjustAboveThresholdCount?: number;
  chaseLives?: number;
  chaseAutoLevelEnabled?: boolean;
  chaseGroupsPerLevel?: number;
  chaseStartFallMs?: number;
  chaseMinFallMs?: number;
  chaseLevelSpeedupMs?: number;
  chaseGroupSpeedupMs?: number;
  errorWeightStrength?: number;
  charSamplingCoverageStrength?: number;
  charSamplingThompson?: boolean;
  playerAnnounceLetters?: boolean;
  playerLetterRepeatCount?: number;
  playerRandomizeLetters?: boolean;
  playerDelaySeconds?: number;
  playerSpeechVoiceURI?: string;
}

interface TrainingSettingsFormProps {
  settings: FormTrainingSettings;
  setSettings: (
    settings: FormTrainingSettings | ((prev: FormTrainingSettings) => FormTrainingSettings),
  ) => void;
  onSaveSettings?: () => void;
  /** Auto level adjustment profile shown in the sidebar (group vs echo). Defaults to group. */
  autoAdjustProfile?: AutoLevelAdjustProfileMode;
}

function AutoAdjustProfileIcon({
  profile,
}: {
  readonly profile: AutoLevelAdjustProfileMode;
}): JSX.Element {
  if (profile === 'echo') {
    return (
      <svg
        className="w-4 h-4 text-violet-700 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M12 3a9 9 0 0 1 9 9" />
        <path d="M12 3a9 9 0 0 0-9 9" />
        <path d="M12 21a9 9 0 0 0 9-9" />
        <path d="M12 21a9 9 0 0 1-9-9" />
        <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  return (
    <svg
      className="w-4 h-4 text-slate-600 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="4" width="7" height="7" rx="1" />
      <rect x="14" y="4" width="7" height="7" rx="1" />
      <rect x="14" y="13" width="7" height="7" rx="1" />
      <rect x="3" y="13" width="7" height="7" rx="1" />
    </svg>
  );
}

export function TrainingSettingsForm({
  settings,
  setSettings,
  onSaveSettings,
  autoAdjustProfile = 'group',
}: TrainingSettingsFormProps): JSX.Element {
  const charMode = settings.charSetMode || 'koch';

  const currentSequence = useMemo(() => {
    if (charMode === 'koch' || charMode === 'mixed') {
      return Array.isArray(settings.customSequence) && settings.customSequence.length > 0
        ? settings.customSequence
        : LCWO_SEQUENCE;
    }
    return [];
  }, [charMode, settings.customSequence]);

  const kochLevelMax = useMemo(() => {
    if (charMode === 'koch' || charMode === 'mixed') {
      return Math.max(1, currentSequence.length - 1);
    }
    return 40;
  }, [charMode, currentSequence.length]);

  const [charWpmMinInput, setCharWpmMinInput] = useState<string>(String(settings.charWpmMin));
  const [charWpmMaxInput, setCharWpmMaxInput] = useState<string>(String(settings.charWpmMax));
  const [effectiveWpmMinInput, setEffectiveWpmMinInput] = useState<string>(
    String(settings.effectiveWpmMin),
  );
  const [effectiveWpmMaxInput, setEffectiveWpmMaxInput] = useState<string>(
    String(settings.effectiveWpmMax),
  );
  const [minGroupSizeInput, setMinGroupSizeInput] = useState<string>(String(settings.minGroupSize));
  const [maxGroupSizeInput, setMaxGroupSizeInput] = useState<string>(String(settings.maxGroupSize));

  const [showCharacterSetHelp, setShowCharacterSetHelp] = useState(false);
  const [showSpeedGroupsHelp, setShowSpeedGroupsHelp] = useState(false);
  const [showAutoAdjustHelp, setShowAutoAdjustHelp] = useState(false);
  const [showSequenceEditor, setShowSequenceEditor] = useState(false);

  const kochLevelField = useNumberField(settings.kochLevel, {
    min: 1,
    max: kochLevelMax,
    step: 1,
    fieldName: 'kochLevel',
    onChange: (n) => setSettings((prev) => ({ ...prev, kochLevel: n })),
    ...(onSaveSettings !== undefined ? { onSave: onSaveSettings } : {}),
  });

  const digitsLevelField = useNumberField(settings.digitsLevel ?? 10, {
    min: 1,
    max: 10,
    step: 1,
    fieldName: 'digitsLevel',
    onChange: (n) => setSettings((prev) => ({ ...prev, digitsLevel: n })),
    ...(onSaveSettings !== undefined ? { onSave: onSaveSettings } : {}),
  });

  const mixedLettersPercentField = useNumberField(settings.mixedLettersPercent ?? 70, {
    min: 0,
    max: 100,
    step: 1,
    fieldName: 'mixedLettersPercent',
    onChange: (n) => setSettings((prev) => ({ ...prev, mixedLettersPercent: n })),
    ...(onSaveSettings !== undefined ? { onSave: onSaveSettings } : {}),
  });

  const numGroupsField = useNumberField(settings.numGroups, {
    min: 1,
    max: 10_000,
    step: 1,
    fieldName: 'numGroups',
    onChange: (n) => setSettings((prev) => ({ ...prev, numGroups: n })),
    ...(onSaveSettings !== undefined ? { onSave: onSaveSettings } : {}),
  });

  const extraWordSpaceField = useNumberField(settings.extraWordSpaceMultiplier ?? 1, {
    min: EXTRA_SPACING_MULTIPLIER_MIN,
    max: 100,
    step: 0.1,
    fieldName: 'extraWordSpaceMultiplier',
    onChange: (n) => setSettings((prev) => ({ ...prev, extraWordSpaceMultiplier: n })),
    ...(onSaveSettings !== undefined ? { onSave: onSaveSettings } : {}),
  });

  const groupTimeoutField = useNumberField(settings.groupTimeout, {
    min: 0,
    max: 600,
    step: 0.1,
    fieldName: 'groupTimeout',
    onChange: (n) => setSettings((prev) => ({ ...prev, groupTimeout: n })),
    ...(onSaveSettings !== undefined ? { onSave: onSaveSettings } : {}),
  });

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

  useEffect(() => {
    setMinGroupSizeInput(String(settings.minGroupSize));
  }, [settings.minGroupSize]);

  useEffect(() => {
    setMaxGroupSizeInput(String(settings.maxGroupSize));
  }, [settings.maxGroupSize]);
  const digitsAsc = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  // Filter out prosigns (characters with < > format) - only single characters allowed
  const allChars = Object.keys(MORSE_CODE).filter((char) => {
    // Exclude prosigns (format like <AR>, <BT>, etc.)
    return !(char.startsWith('<') && char.endsWith('>'));
  });
  const letters = allChars.filter((character) => /[A-Z]/.test(character));

  // Use the shared computeCharPool instead of reimplementing sliding window logic
  const currentPreviewChars = useMemo(
    () =>
      computeCharPool({
        kochLevel: settings.kochLevel,
        ...(settings.charSetMode !== undefined ? { charSetMode: settings.charSetMode } : {}),
        ...(settings.digitsLevel !== undefined ? { digitsLevel: settings.digitsLevel } : {}),
        ...(settings.mixedLettersPercent !== undefined
          ? { mixedLettersPercent: settings.mixedLettersPercent }
          : {}),
        ...(settings.customSet !== undefined ? { customSet: settings.customSet } : {}),
        ...(settings.customSequence !== undefined
          ? { customSequence: settings.customSequence }
          : {}),
        ...(settings.slidingWindowStart !== undefined
          ? { slidingWindowStart: settings.slidingWindowStart }
          : {}),
        ...(settings.slidingWindowEnd !== undefined
          ? { slidingWindowEnd: settings.slidingWindowEnd }
          : {}),
      }),
    [
      settings.kochLevel,
      settings.charSetMode,
      settings.digitsLevel,
      settings.mixedLettersPercent,
      settings.customSet,
      settings.customSequence,
      settings.slidingWindowStart,
      settings.slidingWindowEnd,
    ],
  );

  // Detect which preset matches the current sequence
  const currentPresetId = useMemo(() => {
    // If no customSequence is set, use LCWO_SEQUENCE
    const sequence =
      Array.isArray(settings.customSequence) && settings.customSequence.length > 0
        ? settings.customSequence
        : LCWO_SEQUENCE;
    const sequenceStr = sequence.join(',');
    const matchingPreset = SEQUENCE_PRESETS.find(
      (preset) => preset.sequence.join(',') === sequenceStr,
    );
    // If no customSequence was set and it matches LCWO, return 'lcwo'
    // Otherwise return the matching preset or 'custom'
    if (!Array.isArray(settings.customSequence) || settings.customSequence.length === 0) {
      return matchingPreset?.id || 'lcwo';
    }
    return matchingPreset?.id || 'custom';
  }, [settings.customSequence]);

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2 p-4 border border-gray-200 rounded-lg bg-slate-50">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="text-sm font-semibold text-slate-700">Shared character set</h4>
              <p className="mt-0.5 text-xs text-slate-500">
                Applies to Group, Echo, Chase, ICR, and Player.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCharacterSetHelp((value) => !value)}
              className={`inline-flex items-center justify-center h-6 px-2 rounded-full text-xs font-semibold border transition-colors ${
                showCharacterSetHelp
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
              title="What is Character set?"
              aria-expanded={showCharacterSetHelp}
            >
              ?
            </button>
          </div>
          {showCharacterSetHelp && (
            <div className="mb-3 text-xs text-slate-700 bg-white border border-slate-200 rounded-lg p-3">
              <ul className="list-disc ml-4 space-y-1">
                <li>
                  <span className="font-medium">Alphabet</span>: Letters from a preset sequence
                  (e.g. LCWO). Preset and Level choose which letters are unlocked; Practice narrows
                  the range.
                </li>
                <li>
                  <span className="font-medium">Digits</span>: Digits 0–9 by level. Level 1 unlocks
                  2 digits; each level adds one more (level + 1 characters).
                </li>
                <li>
                  <span className="font-medium">Mixed</span>: Level splits letters and digits from
                  the same preset — level 1 is 1 letter + 1 digit, level 2 is 2 letters + 1 digit, and
                  so on (level + 1 characters total). Letters % sets draw bias.
                </li>
                <li>
                  <span className="font-medium">Custom</span>: Pick your own set and order.
                </li>
              </ul>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Mode</label>
              <div className="flex gap-2 mb-3">
                {(['koch', 'digits', 'mixed'] as const).map((mode) => (
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
                    {mode === 'koch' ? 'Alphabet' : mode === 'digits' ? 'Digits' : 'Mixed'}
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
                            const preset = SEQUENCE_PRESETS.find((p) => p.id === presetId);
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
                          <svg
                            className="w-4 h-4 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
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
                  {/* Unified: Level (number input for accuracy) + Practice (dropdown) */}
                  {((): JSX.Element => {
                    const nLetters = Math.max(
                      2,
                      Math.min(unlockedCharCountForLevel(settings.kochLevel), currentSequence.length),
                    );
                    const start = Math.max(1, Math.min(settings.slidingWindowStart ?? 1, nLetters));
                    const end = Math.max(1, Math.min(settings.slidingWindowEnd ?? 40, nLetters));
                    const startIdx = Math.min(start, end);
                    const endIdx = Math.max(start, end);
                    const isAll = startIdx === 1 && endIdx >= nLetters;
                    const isLast3 =
                      nLetters >= 3 && startIdx === nLetters - 2 && endIdx === nLetters;
                    const isLast5 =
                      nLetters >= 5 && startIdx === nLetters - 4 && endIdx === nLetters;
                    const practiceValue = isAll
                      ? 'all'
                      : isLast3
                        ? 'last3'
                        : isLast5
                          ? 'last5'
                          : 'all';
                    return (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Level
                            </label>
                            <input
                              {...kochLevelField.inputProps}
                              className="w-full px-3 py-2 border border-gray-300 rounded"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              {nLetters} letters unlocked
                            </p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Practice
                            </label>
                            <select
                              value={practiceValue}
                              onChange={(e) => {
                                const v = e.target.value as 'all' | 'last3' | 'last5';
                                const n = Math.max(
                                  2,
                                  Math.min(settings.kochLevel + 1, currentSequence.length),
                                );
                                if (v === 'all')
                                  setSettings({
                                    ...settings,
                                    slidingWindowStart: 1,
                                    slidingWindowEnd: n,
                                  });
                                else if (v === 'last3')
                                  setSettings({
                                    ...settings,
                                    slidingWindowStart: Math.max(1, n - 2),
                                    slidingWindowEnd: n,
                                  });
                                else if (v === 'last5')
                                  setSettings({
                                    ...settings,
                                    slidingWindowStart: Math.max(1, n - 4),
                                    slidingWindowEnd: n,
                                  });
                              }}
                              className="w-full px-3 py-2 pr-8 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                              <option value="all">All</option>
                              <option value="last3">Last 3</option>
                              <option value="last5">Last 5</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">
                            Characters: {currentPreviewChars.join(' ')}
                          </p>
                        </div>
                      </div>
                    );
                  })()}
                  <SequenceEditorModal
                    open={showSequenceEditor}
                    onClose={() => setShowSequenceEditor(false)}
                    sequence={
                      Array.isArray(settings.customSequence) && settings.customSequence.length > 0
                        ? settings.customSequence
                        : LCWO_SEQUENCE
                    }
                    onChange={(newSequence) => {
                      setSettings({ ...settings, customSequence: newSequence });
                    }}
                  />
                </div>
              )}
              {charMode === 'digits' &&
                ((): JSX.Element => {
                  const nDigits = digitsUnlockedCount(settings.digitsLevel ?? 1);
                  const start = Math.max(1, Math.min(settings.slidingWindowStart ?? 1, nDigits));
                  const end = Math.max(1, Math.min(settings.slidingWindowEnd ?? 40, nDigits));
                  const startIdx = Math.min(start, end);
                  const endIdx = Math.max(start, end);
                  const isAll = startIdx === 1 && endIdx >= nDigits;
                  const isLast3 = nDigits >= 3 && startIdx === nDigits - 2 && endIdx === nDigits;
                  const isLast5 = nDigits >= 5 && startIdx === nDigits - 4 && endIdx === nDigits;
                  const practiceValue = isAll
                    ? 'all'
                    : isLast3
                      ? 'last3'
                      : isLast5
                        ? 'last5'
                        : 'all';
                  return (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Level
                          </label>
                          <input
                            {...digitsLevelField.inputProps}
                            className="w-full px-3 py-2 border border-gray-300 rounded"
                          />
                          <p className="text-xs text-gray-500 mt-1">{nDigits} digits</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Practice
                          </label>
                          <select
                            value={practiceValue}
                            onChange={(e) => {
                              const v = e.target.value as 'all' | 'last3' | 'last5';
                              const n = digitsUnlockedCount(settings.digitsLevel ?? 1);
                              if (v === 'all')
                                setSettings({
                                  ...settings,
                                  slidingWindowStart: 1,
                                  slidingWindowEnd: n,
                                });
                              else if (v === 'last3')
                                setSettings({
                                  ...settings,
                                  slidingWindowStart: Math.max(1, n - 2),
                                  slidingWindowEnd: n,
                                });
                              else if (v === 'last5')
                                setSettings({
                                  ...settings,
                                  slidingWindowStart: Math.max(1, n - 4),
                                  slidingWindowEnd: n,
                                });
                            }}
                            className="w-full px-3 py-2 pr-8 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="all">All</option>
                            <option value="last3">Last 3</option>
                            <option value="last5">Last 5</option>
                          </select>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500">
                        Digits: {currentPreviewChars.join(' ')}
                      </p>
                    </div>
                  );
                })()}
              {charMode === 'mixed' &&
                ((): JSX.Element => {
                  const nLetters = Math.min(
                    unlockedCharCountForLevel(settings.kochLevel),
                    currentSequence.length,
                  );
                  const nDigits = digitsUnlockedCount(settings.digitsLevel ?? 1);
                  const nextAxis = settings.mixedAutoLevelNextAxis ?? 'letters';
                  const nextUnlockChar = nextMixedUnlockPreviewChar(
                    nextAxis,
                    settings.kochLevel,
                    settings.digitsLevel ?? 1,
                    currentSequence,
                  );
                  const autoAdjustEnabled =
                    autoAdjustProfile === 'echo'
                      ? Boolean(settings.echoAutoAdjustKoch)
                      : Boolean(settings.autoAdjustKoch);
                  return (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Preset sequence
                          </label>
                          <div className="relative">
                            <select
                              value={currentPresetId}
                              onChange={(e) => {
                                const presetId = e.target.value;
                                if (presetId === 'custom') return;
                                const preset = SEQUENCE_PRESETS.find((p) => p.id === presetId);
                                if (preset)
                                  setSettings({ ...settings, customSequence: preset.sequence });
                              }}
                              className="w-full px-3 py-2 pr-8 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 appearance-none"
                            >
                              {SEQUENCE_PRESETS.map((preset) => (
                                <option key={preset.id} value={preset.id}>
                                  {preset.name}
                                </option>
                              ))}
                              {currentPresetId === 'custom' && (
                                <option value="custom">✨ Custom sequence</option>
                              )}
                            </select>
                            <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                              <svg
                                className="w-4 h-4 text-gray-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 9l-7 7-7-7"
                                />
                              </svg>
                            </div>
                          </div>
                        </div>
                        <div className="pt-6">
                          <button
                            type="button"
                            onClick={() => setShowSequenceEditor(true)}
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
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Alphabet level
                          </label>
                          <input
                            {...kochLevelField.inputProps}
                            className="w-full px-3 py-2 border border-gray-300 rounded"
                          />
                          <p className="text-xs text-gray-500 mt-1">{nLetters} letters unlocked</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Digits level
                          </label>
                          <input
                            {...digitsLevelField.inputProps}
                            className="w-full px-3 py-2 border border-gray-300 rounded"
                          />
                          <p className="text-xs text-gray-500 mt-1">{nDigits} digits unlocked</p>
                        </div>
                      </div>
                      {autoAdjustEnabled ? (
                        <p className="text-xs text-indigo-600">
                          Next auto-level: {nextAxis === 'letters' ? 'letter' : 'digit'}
                          {nextUnlockChar ? ` (${nextUnlockChar})` : ''}
                        </p>
                      ) : null}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Letters % (draw bias)
                        </label>
                        <input
                          {...mixedLettersPercentField.inputProps}
                          className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded"
                        />
                      </div>
                      <p className="text-xs text-gray-500">
                        Combined pool: {currentPreviewChars.join(' ')}
                      </p>
                      <SequenceEditorModal
                        open={showSequenceEditor}
                        onClose={() => setShowSequenceEditor(false)}
                        sequence={
                          Array.isArray(settings.customSequence) &&
                          settings.customSequence.length > 0
                            ? settings.customSequence
                            : LCWO_SEQUENCE
                        }
                        onChange={(newSequence) => {
                          setSettings({ ...settings, customSequence: newSequence });
                        }}
                      />
                    </div>
                  );
                })()}
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
          </div>
        </div>

        <div className="sm:col-span-2 p-4 border border-gray-200 rounded-lg bg-slate-50">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="text-sm font-semibold text-slate-700">
                Shared Morse speed &amp; Group session size
              </h4>
              <p className="mt-0.5 text-xs text-slate-500">
                WPM and group size are shared. The session count below is for Group/Echo sessions;
                Chase streams single letters and paces itself inside the effective WPM range.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowSpeedGroupsHelp((value) => !value)}
              className={`inline-flex items-center justify-center h-6 px-2 rounded-full text-xs font-semibold border transition-colors ${
                showSpeedGroupsHelp
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
              title="What are Speed &amp; groups?"
              aria-expanded={showSpeedGroupsHelp}
            >
              ?
            </button>
          </div>
          {showSpeedGroupsHelp && (
            <div className="mb-3 text-xs text-slate-700 bg-white border border-slate-200 rounded-lg p-3">
              <div className="font-semibold text-slate-800 mb-1">Speed &amp; groups</div>
              <ul className="list-disc ml-4 space-y-1">
                <li>
                  <span className="font-medium">Character speed (WPM)</span>: Speed of dots and
                  dashes within each letter.
                </li>
                <li>
                  <span className="font-medium">Effective speed (WPM)</span>: Controls gap between
                  letters (Farnsworth). Lower = longer gaps. Link to keep equal to character speed.
                </li>
                <li>
                  <span className="font-medium">{EXTRA_SPACING_LABEL}</span>:{' '}
                  {EXTRA_SPACING_SETTINGS_HELP}
                </li>
                <li>
                  <span className="font-medium">Number of groups</span>: How many groups per
                  Group/Echo session. Chase streams letters continuously until you finish.
                </li>
                <li>
                  <span className="font-medium">Group size</span>: Min/max characters per group
                  (random in range).
                </li>
                <li>
                  <span className="font-medium">Group timeout</span>: Seconds before a group is
                  skipped or session ends.
                </li>
              </ul>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Group/Echo: Number of Groups
              </label>
              <input
                {...numGroupsField.inputProps}
                className="w-full px-3 py-2 border border-gray-300 rounded"
              />
            </div>
            <div className="sm:col-span-2">
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
                    if (settings.linkCharWpm) {
                      setCharWpmMaxInput(String(settings.charWpmMin));
                    }
                  } else {
                    // Ensure min <= max (clamp min to max if needed)
                    const currentMax = settings.linkCharWpm ? num : settings.charWpmMax;
                    const validMin = Math.min(num, currentMax);
                    setCharWpmMinInput(String(validMin));

                    const updates: Partial<FormTrainingSettings> = { charWpmMin: validMin };
                    if (settings.linkCharWpm) {
                      updates.charWpmMax = validMin;
                      setCharWpmMaxInput(String(validMin));
                    }
                    // Propagate to effective WPM if char-to-effective link is enabled
                    if (settings.linkCharToEffective) {
                      updates.effectiveWpmMin = validMin;
                      setEffectiveWpmMinInput(String(validMin));
                      if (settings.linkCharWpm) {
                        updates.effectiveWpmMax = validMin;
                        setEffectiveWpmMaxInput(String(validMin));
                      }
                    }
                    setSettings({ ...settings, ...updates });
                    if (onSaveSettings) {
                      setTimeout(() => onSaveSettings(), 50);
                    }
                  }
                }}
                onMaxBlur={() => {
                  const num = parseFloat(charWpmMaxInput);
                  if (isNaN(num) || num <= 0) {
                    setCharWpmMaxInput(String(settings.charWpmMax));
                  } else {
                    // Ensure max >= min (clamp max to min if needed)
                    const validMax = Math.max(num, settings.charWpmMin);
                    setCharWpmMaxInput(String(validMax));

                    const updates: Partial<FormTrainingSettings> = { charWpmMax: validMax };
                    // Propagate to effective WPM max if char-to-effective link is enabled
                    if (settings.linkCharToEffective) {
                      updates.effectiveWpmMax = validMax;
                      setEffectiveWpmMaxInput(String(validMax));
                    }
                    setSettings({ ...settings, ...updates });
                    if (onSaveSettings) {
                      setTimeout(() => onSaveSettings(), 50);
                    }
                  }
                }}
                onLinkToggle={(linked) => {
                  const updates: Partial<FormTrainingSettings> = { linkCharWpm: linked };
                  if (linked) {
                    updates.charWpmMax = settings.charWpmMin;
                    setCharWpmMaxInput(String(settings.charWpmMin));
                    if (settings.linkCharToEffective) {
                      updates.effectiveWpmMax = settings.charWpmMin;
                      setEffectiveWpmMaxInput(String(settings.charWpmMin));
                    }
                  }
                  setSettings({ ...settings, ...updates });
                }}
                min={1}
                unit="WPM"
              />
            </div>

            {/* Vertical link between Character Speed and Effective Speed */}
            <div className="sm:col-span-2 flex justify-center -my-1">
              <button
                type="button"
                onClick={() => {
                  const newLinked = !settings.linkCharToEffective;
                  const updates: Partial<FormTrainingSettings> = { linkCharToEffective: newLinked };
                  if (newLinked) {
                    // Sync effective WPM to character WPM when linking
                    updates.effectiveWpmMin = settings.charWpmMin;
                    updates.effectiveWpmMax = settings.charWpmMax;
                    updates.linkEffectiveWpm = settings.linkCharWpm;
                    setEffectiveWpmMinInput(String(settings.charWpmMin));
                    setEffectiveWpmMaxInput(String(settings.charWpmMax));
                  }
                  setSettings({ ...settings, ...updates });
                }}
                className={`
                  flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300
                  ${
                    settings.linkCharToEffective
                      ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md hover:shadow-lg hover:scale-105'
                      : 'bg-white border-2 border-dashed border-gray-300 text-gray-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50'
                  }
                `}
                title={
                  settings.linkCharToEffective
                    ? 'Unlink character and effective speeds'
                    : 'Link character and effective speeds'
                }
              >
                {settings.linkCharToEffective ? (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                      />
                    </svg>
                    <span>Char = Effective</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                      />
                    </svg>
                    <span>Char ≠ Effective</span>
                  </>
                )}
              </button>
            </div>

            <div className="sm:col-span-2">
              <LinkedRangeInput
                label="Effective Speed (WPM)"
                minValue={effectiveWpmMinInput}
                maxValue={effectiveWpmMaxInput}
                linked={settings.linkEffectiveWpm}
                disabled={settings.linkCharToEffective}
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
                    if (settings.linkEffectiveWpm) {
                      setEffectiveWpmMaxInput(String(settings.effectiveWpmMin));
                    }
                  } else {
                    // Ensure min <= max (clamp min to max if needed)
                    const currentMax = settings.linkEffectiveWpm ? num : settings.effectiveWpmMax;
                    const validMin = Math.min(num, currentMax);
                    setEffectiveWpmMinInput(String(validMin));

                    const updates: Partial<FormTrainingSettings> = { effectiveWpmMin: validMin };
                    if (settings.linkEffectiveWpm) {
                      updates.effectiveWpmMax = validMin;
                      setEffectiveWpmMaxInput(String(validMin));
                    }
                    setSettings({ ...settings, ...updates });
                    if (onSaveSettings) {
                      setTimeout(() => onSaveSettings(), 50);
                    }
                  }
                }}
                onMaxBlur={() => {
                  const num = parseFloat(effectiveWpmMaxInput);
                  if (isNaN(num) || num <= 0) {
                    setEffectiveWpmMaxInput(String(settings.effectiveWpmMax));
                  } else {
                    // Ensure max >= min (clamp max to min if needed)
                    const validMax = Math.max(num, settings.effectiveWpmMin);
                    setEffectiveWpmMaxInput(String(validMax));

                    setSettings({ ...settings, effectiveWpmMax: validMax });
                    if (onSaveSettings) {
                      setTimeout(() => onSaveSettings(), 50);
                    }
                  }
                }}
                onLinkToggle={(linked) => {
                  const updates: Partial<FormTrainingSettings> = { linkEffectiveWpm: linked };
                  if (linked) {
                    updates.effectiveWpmMax = settings.effectiveWpmMin;
                    setEffectiveWpmMaxInput(String(settings.effectiveWpmMin));
                  }
                  setSettings({ ...settings, ...updates });
                }}
                min={1}
                unit="WPM"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {EXTRA_SPACING_LABEL}
              </label>
              <input
                {...extraWordSpaceField.inputProps}
                className="w-full px-3 py-2 border border-gray-300 rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Group Timeout</label>
              <input
                {...groupTimeoutField.inputProps}
                className="w-full px-3 py-2 border border-gray-300 rounded"
              />
            </div>
            <div className="sm:col-span-2">
              <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                <input
                  id="lockInputDuringGroupPlayback"
                  type="checkbox"
                  checked={settings.lockInputDuringGroupPlayback ?? true}
                  onChange={(event) =>
                    setSettings({
                      ...settings,
                      lockInputDuringGroupPlayback: event.target.checked,
                    })
                  }
                  className="mt-0.5 w-4 h-4"
                />
                <label htmlFor="lockInputDuringGroupPlayback" className="text-sm text-gray-700">
                  <span className="font-medium">Lock input while group plays</span>
                  <span className="mt-0.5 block text-xs text-slate-600">
                    Group training only. Keeps the active answer field locked until the whole group
                    has finished sending, so you copy the full word from memory instead of typing
                    letter by letter.
                  </span>
                </label>
              </div>
            </div>
            <div className="sm:col-span-2">
              <LinkedRangeInput
                label="Group Size"
                minValue={minGroupSizeInput}
                maxValue={maxGroupSizeInput}
                linked={settings.linkGroupSize}
                onMinChange={(value) => {
                  setMinGroupSizeInput(value);
                  if (settings.linkGroupSize) {
                    setMaxGroupSizeInput(value);
                  }
                }}
                onMaxChange={(value) => {
                  setMaxGroupSizeInput(value);
                }}
                onMinBlur={() => {
                  const num = parseFloat(minGroupSizeInput);
                  if (isNaN(num) || num <= 0) {
                    setMinGroupSizeInput(String(settings.minGroupSize));
                    if (settings.linkGroupSize) {
                      setMaxGroupSizeInput(String(settings.minGroupSize));
                    }
                  } else {
                    // Ensure min <= max (clamp min to max if needed)
                    const currentMax = settings.linkGroupSize
                      ? Math.floor(num)
                      : settings.maxGroupSize;
                    const validMin = Math.max(1, Math.min(Math.floor(num), currentMax));
                    setMinGroupSizeInput(String(validMin));

                    const updates: Partial<FormTrainingSettings> = { minGroupSize: validMin };
                    if (settings.linkGroupSize) {
                      updates.maxGroupSize = validMin;
                      setMaxGroupSizeInput(String(validMin));
                    }
                    setSettings({ ...settings, ...updates });
                    if (onSaveSettings) {
                      setTimeout(() => onSaveSettings(), 50);
                    }
                  }
                }}
                onMaxBlur={() => {
                  const num = parseFloat(maxGroupSizeInput);
                  if (isNaN(num) || num <= 0) {
                    setMaxGroupSizeInput(String(settings.maxGroupSize));
                  } else {
                    // Ensure max >= min (clamp max to min if needed)
                    const validMax = Math.max(1, Math.max(Math.floor(num), settings.minGroupSize));
                    setMaxGroupSizeInput(String(validMax));

                    setSettings({ ...settings, maxGroupSize: validMax });
                    if (onSaveSettings) {
                      setTimeout(() => onSaveSettings(), 50);
                    }
                  }
                }}
                onLinkToggle={(linked) => {
                  const updates: Partial<FormTrainingSettings> = { linkGroupSize: linked };
                  if (linked) {
                    updates.maxGroupSize = settings.minGroupSize;
                    setMaxGroupSizeInput(String(settings.minGroupSize));
                  }
                  setSettings({ ...settings, ...updates });
                }}
                min={1}
                minLabel="Min"
                maxLabel="Max"
              />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0">
                <h5 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <AutoAdjustProfileIcon profile={autoAdjustProfile} />
                  <span>
                    Auto Sequence Level Adjustment
                    <span className="sr-only">
                      {autoAdjustProfile === 'echo' ? ' (Echo mode)' : ' (Group mode)'}
                    </span>
                  </span>
                </h5>
              </div>
              <button
                type="button"
                onClick={() => setShowAutoAdjustHelp((v) => !v)}
                className={`inline-flex items-center justify-center h-6 px-2 rounded-full text-xs font-semibold border transition-colors shrink-0 ${
                  showAutoAdjustHelp
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
                title="What do these settings do?"
                aria-expanded={showAutoAdjustHelp}
              >
                ?
              </button>
            </div>
            <AutoLevelAdjustProfiles
              settings={settings}
              setSettings={setSettings}
              charMode={charMode}
              profileMode={autoAdjustProfile}
              {...(onSaveSettings ? { onSaveSettings } : {})}
              showHelp={showAutoAdjustHelp}
            />
            <div className="mt-4 pt-4 border-t border-slate-100">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Error weight ({settings.errorWeightStrength ?? 0})
              </label>
              <input
                type="range"
                min={0}
                max={5}
                step={0.5}
                value={settings.errorWeightStrength ?? 0}
                onChange={(event) => {
                  const numValue = parseFloat(event.target.value);
                  if (!isNaN(numValue)) {
                    setSettings({
                      ...settings,
                      errorWeightStrength: numValue,
                    });
                  }
                }}
                className="w-full accent-emerald-600"
              />
              <p className="mt-1 text-xs text-slate-500">
                Scales how much posterior P(error) boosts each character&apos;s sampling weight.
              </p>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Coverage balance ({settings.charSamplingCoverageStrength ?? 1})
              </label>
              <input
                type="range"
                min={0}
                max={3}
                step={0.5}
                value={settings.charSamplingCoverageStrength ?? 1}
                onChange={(event) => {
                  const numValue = parseFloat(event.target.value);
                  if (!isNaN(numValue)) {
                    setSettings({
                      ...settings,
                      charSamplingCoverageStrength: numValue,
                    });
                  }
                }}
                className="w-full accent-sky-600"
              />
              <p className="mt-1 text-xs text-slate-500">
                Gives under-sampled characters extra weight within a session (0 = off).
              </p>
            </div>
            <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={settings.charSamplingThompson ?? false}
                onChange={(event) => {
                  setSettings({
                    ...settings,
                    charSamplingThompson: event.target.checked,
                  });
                }}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              Thompson sampling (draw P(error) from Beta before each group)
            </label>
            <p className="mt-2 text-xs text-slate-500">
              Charts: Group Training → Stats → Sampling tab.
            </p>
          </div>
        </div>

        <ToneEnvelopeSection
          settings={settings}
          setSettings={setSettings}
          {...(onSaveSettings ? { onSaveSettings } : {})}
        />
        <BandConditionsSection
          settings={settings}
          setSettings={setSettings}
          {...(onSaveSettings ? { onSaveSettings } : {})}
        />
      </div>
    </>
  );
}
