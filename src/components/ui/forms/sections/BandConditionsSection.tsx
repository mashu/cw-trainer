import React, { useCallback, useEffect, useRef, useState } from 'react';

import {
  createBandConditionsAudio,
  type BandConditionsAudio,
  type BandConditionsSettings,
} from '@/lib/audio/bandConditions';
import { clampExtraSpacingMultiplier } from '@/lib/extraSpacing';
import {
  playMorseCodeControlled,
  resumeAudioContextFromUserGesture,
} from '@/lib/morseAudio';

import type { FormTrainingSettings } from '../TrainingSettingsForm';

interface BandConditionsSectionProps {
  readonly settings: FormTrainingSettings;
  readonly setSettings: (s: FormTrainingSettings | ((prev: FormTrainingSettings) => FormTrainingSettings)) => void;
  readonly onSaveSettings?: () => void;
}

type ToggleRowProps = {
  readonly label: string;
  readonly description: string;
  readonly enabled: boolean;
  readonly onEnabledChange: (enabled: boolean) => void;
};

const qrmProfileOptions = [
  { value: 'whistle', label: 'Passband hiss' },
  { value: 'ringing', label: 'Filter ringing' },
  { value: 'mixed', label: 'Receiver mix' },
] as const;

const formatPercent = (value: number): string => `${Math.round(value * 100)}%`;
const formatMultiplier = (value: number): string => `${value.toFixed(1)}x`;

function ToggleRow({
  label,
  description,
  enabled,
  onEnabledChange,
}: ToggleRowProps): JSX.Element {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-sm font-medium text-slate-700">{label}</div>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
      <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => onEnabledChange(event.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
        />
        {enabled ? 'On' : 'Off'}
      </label>
    </div>
  );
}

export function BandConditionsSection({
  settings,
  setSettings,
  onSaveSettings,
}: BandConditionsSectionProps): JSX.Element {
  const [showHelp, setShowHelp] = useState(false);
  const [showAdvancedReceiver, setShowAdvancedReceiver] = useState(false);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const previewContextRef = useRef<AudioContext | null>(null);
  const previewBandConditionsRef = useRef<BandConditionsAudio | null>(null);
  const previewStopRef = useRef<(() => void) | null>(null);
  const previewTimeoutRef = useRef<number | undefined>(undefined);
  const previewLoopTokenRef = useRef(0);
  const latestSettingsRef = useRef(settings);

  useEffect(() => {
    latestSettingsRef.current = settings;
  }, [settings]);

  const qsbEnabled = settings.qsbEnabled ?? false;
  const qsbDepth = settings.qsbDepth ?? 0.35;
  const qsbRateHz = settings.qsbRateHz ?? 0.12;
  const qrnEnabled = settings.qrnEnabled ?? false;
  const qrnLevel = settings.qrnLevel ?? 0.25;
  const qrmEnabled = settings.qrmEnabled ?? false;
  const qrmLevel = settings.qrmLevel ?? 0.2;
  const qrmProfile = settings.qrmProfile ?? 'mixed';
  const receiverBackgroundGain = settings.receiverBackgroundGain ?? 20;
  const receiverBackgroundExcitationRate = settings.receiverBackgroundExcitationRate ?? 62;
  const receiverBackgroundResonance = settings.receiverBackgroundResonance ?? 66;
  const receiverBackgroundDecay = settings.receiverBackgroundDecay ?? 0.984;
  const receiverBackgroundOffsetHz = settings.receiverBackgroundOffsetHz ?? 140;
  const receiverBackgroundOffsetModDepthHz = settings.receiverBackgroundOffsetModDepthHz ?? 45;
  const receiverBackgroundOffsetModRateHz = settings.receiverBackgroundOffsetModRateHz ?? 0.32;

  const saveOnBlur = (): void => {
    onSaveSettings?.();
  };

  const patchSettings = useCallback(
    (patch: Partial<FormTrainingSettings>): void => {
      setSettings((previous) => ({
        ...previous,
        ...patch,
      }));
    },
    [setSettings],
  );

  const stopPreview = useCallback((): void => {
    previewLoopTokenRef.current += 1;
    if (previewTimeoutRef.current !== undefined) {
      window.clearTimeout(previewTimeoutRef.current);
      previewTimeoutRef.current = undefined;
    }
    try {
      previewStopRef.current?.();
    } catch {
      // Preview may already have stopped.
    }
    previewStopRef.current = null;
    try {
      previewBandConditionsRef.current?.stop();
    } catch {
      // Preview graph may already be disconnected.
    }
    previewBandConditionsRef.current = null;
    try {
      previewContextRef.current?.close().catch(() => {});
    } catch {
      // Context may already be closed.
    }
    previewContextRef.current = null;
    setIsPlayingPreview(false);
  }, []);

  useEffect(() => stopPreview, [stopPreview]);

  const buildPreviewBandSettings = useCallback(
    (): BandConditionsSettings => ({
      sideToneMin: settings.sideToneMin,
      sideToneMax: settings.sideToneMax,
      qsbEnabled,
      qsbDepth,
      qsbRateHz,
      qrnEnabled,
      qrnLevel,
      qrmEnabled,
      qrmLevel,
      qrmProfile,
      receiverBackgroundGain,
      receiverBackgroundExcitationRate,
      receiverBackgroundResonance,
      receiverBackgroundDecay,
      receiverBackgroundOffsetHz,
      receiverBackgroundOffsetModDepthHz,
      receiverBackgroundOffsetModRateHz,
    }),
    [
      receiverBackgroundDecay,
      receiverBackgroundExcitationRate,
      receiverBackgroundGain,
      receiverBackgroundOffsetModDepthHz,
      receiverBackgroundOffsetModRateHz,
      receiverBackgroundOffsetHz,
      receiverBackgroundResonance,
      qrmEnabled,
      qrmLevel,
      qrmProfile,
      qrnEnabled,
      qrnLevel,
      qsbDepth,
      qsbEnabled,
      qsbRateHz,
      settings.sideToneMax,
      settings.sideToneMin,
    ],
  );

  useEffect(() => {
    if (!isPlayingPreview || !previewBandConditionsRef.current) {
      return;
    }
    previewBandConditionsRef.current.update(buildPreviewBandSettings());
  }, [buildPreviewBandSettings, isPlayingPreview]);

  const playPreviewLoop = useCallback(
    async (loopToken: number): Promise<void> => {
      const ctx = previewContextRef.current;
      const bandConditions = previewBandConditionsRef.current;
      if (!ctx || !bandConditions || previewLoopTokenRef.current !== loopToken) {
        return;
      }

      try {
        const currentSettings = latestSettingsRef.current;
        const minTone = Math.max(100, currentSettings.sideToneMin);
        const maxTone = Math.max(minTone, currentSettings.sideToneMax);
        const sideTone = Math.round(minTone + (maxTone - minTone) / 2);
        const { durationSec, stop } = await playMorseCodeControlled(
          ctx,
          'V V V TEST',
          {
            charWpmMin: Math.max(1, currentSettings.charWpmMin),
            charWpmMax: Math.max(1, currentSettings.charWpmMax),
            effectiveWpmMin: Math.max(1, currentSettings.effectiveWpmMin),
            effectiveWpmMax: Math.max(1, currentSettings.effectiveWpmMax),
            extraWordSpaceMultiplier: clampExtraSpacingMultiplier(
              currentSettings.extraWordSpaceMultiplier,
            ),
            sideTone,
            steepness: currentSettings.steepness,
            envelopeSmoothing: currentSettings.envelopeSmoothing ?? 0,
            volumeMin: currentSettings.volumeMin ?? 1,
            volumeMax: currentSettings.volumeMax ?? 1,
            linkVolume: currentSettings.linkVolume ?? true,
          },
          () => previewLoopTokenRef.current !== loopToken,
          bandConditions.morseOutput,
        );

        if (previewLoopTokenRef.current !== loopToken) {
          stop();
          return;
        }

        previewStopRef.current = stop;
        previewTimeoutRef.current = window.setTimeout(() => {
          previewTimeoutRef.current = undefined;
          previewStopRef.current = null;
          void playPreviewLoop(loopToken);
        }, Math.ceil((durationSec + 0.75) * 1000));
      } catch {
        stopPreview();
      }
    },
    [stopPreview],
  );

  const handlePreview = useCallback(async (): Promise<void> => {
    if (isPlayingPreview) {
      stopPreview();
      return;
    }

    try {
      const ctx = new AudioContext();
      previewContextRef.current = ctx;
      resumeAudioContextFromUserGesture(ctx);

      const bandConditions = createBandConditionsAudio(ctx, buildPreviewBandSettings());
      previewBandConditionsRef.current = bandConditions;
      previewLoopTokenRef.current += 1;
      const loopToken = previewLoopTokenRef.current;
      setIsPlayingPreview(true);
      void playPreviewLoop(loopToken);
    } catch {
      stopPreview();
    }
  }, [
    buildPreviewBandSettings,
    isPlayingPreview,
    playPreviewLoop,
    stopPreview,
  ]);

  return (
    <div className="sm:col-span-2 p-4 border border-gray-200 rounded-lg bg-slate-50">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-slate-700">Band conditions</h4>
        <button
          type="button"
          onClick={() => setShowHelp((value) => !value)}
          className={`inline-flex items-center justify-center h-6 px-2 rounded-full text-xs font-semibold border transition-colors ${
            showHelp
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
          }`}
          title="What are band conditions?"
          aria-expanded={showHelp}
        >
          ?
        </button>
      </div>

      {showHelp && (
        <div className="mb-3 text-xs text-slate-700 bg-white border border-slate-200 rounded-lg p-3">
          <div className="font-semibold text-slate-800 mb-1">Realistic CW reception</div>
          <ul className="list-disc ml-4 space-y-1">
            <li><span className="font-medium">QSB</span>: slow fading of the wanted Morse signal.</li>
            <li><span className="font-medium">QRN</span>: atmospheric static filtered by the receiver passband.</li>
            <li><span className="font-medium">Receiver background</span>: narrow CW filter hiss and resonant passband ringing.</li>
          </ul>
        </div>
      )}

      <div className="space-y-5">
        <div className="space-y-2">
          <ToggleRow
            label="QSB fading"
            description="Slow gain changes on the Morse signal only."
            enabled={qsbEnabled}
            onEnabledChange={(enabled) => patchSettings({ qsbEnabled: enabled })}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Depth ({formatPercent(qsbDepth)})
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={qsbDepth}
                disabled={!qsbEnabled}
                onBlur={saveOnBlur}
                onChange={(event) => {
                  patchSettings({ qsbDepth: parseFloat(event.target.value) });
                }}
                className="w-full accent-indigo-600 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Rate ({qsbRateHz.toFixed(2)} Hz)
              </label>
              <input
                type="range"
                min={0.03}
                max={1.5}
                step={0.01}
                value={qsbRateHz}
                disabled={!qsbEnabled}
                onBlur={saveOnBlur}
                onChange={(event) => {
                  patchSettings({ qsbRateHz: parseFloat(event.target.value) });
                }}
                className="w-full accent-indigo-600 disabled:opacity-50"
              />
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>Slow</span>
                <span>Fast</span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2 pt-4 border-t border-slate-200">
          <ToggleRow
            label="QRN static"
            description="Atmospheric noise inside the CW passband."
            enabled={qrnEnabled}
            onEnabledChange={(enabled) => patchSettings({ qrnEnabled: enabled })}
          />
          <label className="block text-xs font-medium text-slate-600">
            Intensity ({formatPercent(qrnLevel)})
          </label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={qrnLevel}
            disabled={!qrnEnabled}
            onBlur={saveOnBlur}
            onChange={(event) => {
              patchSettings({ qrnLevel: parseFloat(event.target.value) });
            }}
            className="w-full accent-indigo-600 disabled:opacity-50"
          />
        </div>

        <div className="space-y-2 pt-4 border-t border-slate-200">
          <ToggleRow
            label="Receiver background"
            description="Narrow-filter hiss, ringing, and passband breathing."
            enabled={qrmEnabled}
            onEnabledChange={(enabled) => patchSettings({ qrmEnabled: enabled })}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Intensity ({formatPercent(qrmLevel)})
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={qrmLevel}
                disabled={!qrmEnabled}
                onBlur={saveOnBlur}
                onChange={(event) => {
                  patchSettings({ qrmLevel: parseFloat(event.target.value) });
                }}
                className="w-full accent-indigo-600 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Profile
              </label>
              <select
                value={qrmProfile}
                disabled={!qrmEnabled}
                onBlur={saveOnBlur}
                onChange={(event) => {
                  const profile = event.target.value;
                  if (profile !== 'whistle' && profile !== 'ringing' && profile !== 'mixed') {
                    return;
                  }
                  patchSettings({ qrmProfile: profile });
                }}
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-500"
              >
                {qrmProfileOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-3 rounded-lg border border-slate-200 bg-white">
            <button
              type="button"
              onClick={() => setShowAdvancedReceiver((value) => !value)}
              className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left"
              aria-expanded={showAdvancedReceiver}
            >
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Advanced receiver tuning
                </div>
                <div className="text-[11px] text-slate-500">
                  Gain {formatMultiplier(receiverBackgroundGain)} · Q{' '}
                  {receiverBackgroundResonance.toFixed(0)} · offset{' '}
                  {Math.round(receiverBackgroundOffsetHz)} Hz · wobble{' '}
                  {Math.round(receiverBackgroundOffsetModDepthHz)} Hz @{' '}
                  {receiverBackgroundOffsetModRateHz.toFixed(2)} Hz
                </div>
              </div>
              <span className={`text-xs text-slate-500 transition-transform ${showAdvancedReceiver ? 'rotate-90' : ''}`}>
                ▶
              </span>
            </button>
            {showAdvancedReceiver && (
            <div className="px-3 pb-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Model gain ({formatMultiplier(receiverBackgroundGain)})
                </label>
                <input
                  type="range"
                  min={0}
                  max={20}
                  step={0.1}
                  value={receiverBackgroundGain}
                  disabled={!qrmEnabled}
                  onBlur={saveOnBlur}
                  onChange={(event) => {
                    patchSettings({ receiverBackgroundGain: parseFloat(event.target.value) });
                  }}
                  className="w-full accent-indigo-600 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Excitation rate ({Math.round(receiverBackgroundExcitationRate)}/s)
                </label>
                <input
                  type="range"
                  min={0.1}
                  max={500}
                  step={0.1}
                  value={receiverBackgroundExcitationRate}
                  disabled={!qrmEnabled}
                  onBlur={saveOnBlur}
                  onChange={(event) => {
                    patchSettings({
                      receiverBackgroundExcitationRate: parseFloat(event.target.value),
                    });
                  }}
                  className="w-full accent-indigo-600 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Resonance Q ({receiverBackgroundResonance.toFixed(0)})
                </label>
                <input
                  type="range"
                  min={0.5}
                  max={240}
                  step={0.5}
                  value={receiverBackgroundResonance}
                  disabled={!qrmEnabled}
                  onBlur={saveOnBlur}
                  onChange={(event) => {
                    patchSettings({ receiverBackgroundResonance: parseFloat(event.target.value) });
                  }}
                  className="w-full accent-indigo-600 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Decay ({receiverBackgroundDecay.toFixed(3)})
                </label>
                <input
                  type="range"
                  min={0.5}
                  max={0.9999}
                  step={0.0001}
                  value={receiverBackgroundDecay}
                  disabled={!qrmEnabled}
                  onBlur={saveOnBlur}
                  onChange={(event) => {
                    patchSettings({ receiverBackgroundDecay: parseFloat(event.target.value) });
                  }}
                  className="w-full accent-indigo-600 disabled:opacity-50"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Filter offset ({Math.round(receiverBackgroundOffsetHz)} Hz)
                </label>
                <input
                  type="range"
                  min={-1000}
                  max={1000}
                  step={5}
                  value={receiverBackgroundOffsetHz}
                  disabled={!qrmEnabled}
                  onBlur={saveOnBlur}
                  onChange={(event) => {
                    patchSettings({ receiverBackgroundOffsetHz: parseFloat(event.target.value) });
                  }}
                  className="w-full accent-indigo-600 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Offset wobble depth ({Math.round(receiverBackgroundOffsetModDepthHz)} Hz)
                </label>
                <input
                  type="range"
                  min={0}
                  max={1000}
                  step={5}
                  value={receiverBackgroundOffsetModDepthHz}
                  disabled={!qrmEnabled}
                  onBlur={saveOnBlur}
                  onChange={(event) => {
                    patchSettings({
                      receiverBackgroundOffsetModDepthHz: parseFloat(event.target.value),
                    });
                  }}
                  className="w-full accent-indigo-600 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Offset wobble rate ({receiverBackgroundOffsetModRateHz.toFixed(2)} Hz)
                </label>
                <input
                  type="range"
                  min={0}
                  max={20}
                  step={0.01}
                  value={receiverBackgroundOffsetModRateHz}
                  disabled={!qrmEnabled}
                  onBlur={saveOnBlur}
                  onChange={(event) => {
                    patchSettings({
                      receiverBackgroundOffsetModRateHz: parseFloat(event.target.value),
                    });
                  }}
                  className="w-full accent-indigo-600 disabled:opacity-50"
                />
              </div>
            </div>
            </div>
            )}
          </div>
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          Preview loops a CW sample and applies band-condition changes live.
        </p>
        <button
          type="button"
          onClick={() => {
            void handlePreview();
          }}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            isPlayingPreview
              ? 'bg-red-500 text-white hover:bg-red-600'
              : 'bg-blue-500 text-white hover:bg-blue-600'
          }`}
        >
          {isPlayingPreview ? 'Stop preview' : 'Preview'}
        </button>
      </div>
    </div>
  );
}
