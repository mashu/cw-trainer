'use client';

import React from 'react';

import { useNumberField } from '@/hooks/useNumberField';

import type { FormTrainingSettings } from './TrainingSettingsForm';

type CharMode = 'koch' | 'digits' | 'custom' | 'mixed';

interface AutoLevelAdjustProfilesProps {
  readonly settings: FormTrainingSettings;
  readonly setSettings: (
    settings: FormTrainingSettings | ((prev: FormTrainingSettings) => FormTrainingSettings),
  ) => void;
  readonly charMode: CharMode;
  readonly onSaveSettings?: () => void;
  readonly showHelp: boolean;
}

type ProfileVariant = 'group' | 'echo';

function AutoAdjustProfileBlock({
  variant,
  settings,
  setSettings,
  charMode,
  onSaveSettings,
}: {
  readonly variant: ProfileVariant;
  readonly settings: FormTrainingSettings;
  readonly setSettings: (
    settings: FormTrainingSettings | ((prev: FormTrainingSettings) => FormTrainingSettings),
  ) => void;
  readonly charMode: CharMode;
  readonly onSaveSettings?: () => void;
}): JSX.Element {
  const isEcho = variant === 'echo';

  const enabled = isEcho ? Boolean(settings.echoAutoAdjustKoch) : Boolean(settings.autoAdjustKoch);
  const threshold = isEcho
    ? (settings.echoAutoAdjustThreshold ?? 90)
    : (settings.autoAdjustThreshold ?? 90);
  const belowCount = isEcho
    ? (settings.echoAutoAdjustBelowThresholdCount ?? 0)
    : (settings.autoAdjustBelowThresholdCount ?? 0);
  const aboveCount = isEcho
    ? (settings.echoAutoAdjustAboveThresholdCount ?? 0)
    : (settings.autoAdjustAboveThresholdCount ?? 0);

  const thresholdField = isEcho ? 'echoAutoAdjustThreshold' : 'autoAdjustThreshold';
  const belowField = isEcho
    ? 'echoAutoAdjustBelowThresholdCount'
    : 'autoAdjustBelowThresholdCount';
  const aboveField = isEcho
    ? 'echoAutoAdjustAboveThresholdCount'
    : 'autoAdjustAboveThresholdCount';

  const checkboxId = isEcho ? 'echoAutoAdjustKoch' : 'autoAdjustKoch';

  const thresholdInput = useNumberField(threshold, {
    min: 0,
    max: 100,
    step: 1,
    fieldName: thresholdField,
    onChange: (n) =>
      setSettings((prev) =>
        isEcho ? { ...prev, echoAutoAdjustThreshold: n } : { ...prev, autoAdjustThreshold: n },
      ),
    ...(onSaveSettings !== undefined ? { onSave: onSaveSettings } : {}),
  });

  const belowInput = useNumberField(belowCount, {
    min: 0,
    max: 20,
    step: 1,
    fieldName: belowField,
    onChange: (n) =>
      setSettings((prev) =>
        isEcho
          ? { ...prev, echoAutoAdjustBelowThresholdCount: n }
          : { ...prev, autoAdjustBelowThresholdCount: n },
      ),
    ...(onSaveSettings !== undefined ? { onSave: onSaveSettings } : {}),
  });

  const aboveInput = useNumberField(aboveCount, {
    min: 0,
    max: 20,
    step: 1,
    fieldName: aboveField,
    onChange: (n) =>
      setSettings((prev) =>
        isEcho
          ? { ...prev, echoAutoAdjustAboveThresholdCount: n }
          : { ...prev, autoAdjustAboveThresholdCount: n },
      ),
    ...(onSaveSettings !== undefined ? { onSave: onSaveSettings } : {}),
  });

  return (
    <div
      className={`rounded-lg border p-3 ${
        isEcho ? 'border-violet-200 bg-violet-50/40' : 'border-slate-200 bg-slate-50/50'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide border shrink-0 ${
            isEcho
              ? 'border-violet-200 bg-violet-100 text-violet-800'
              : 'border-slate-200 bg-slate-100 text-slate-700'
          }`}
        >
          {isEcho ? 'Echo' : 'Group'}
        </span>
        <span className="text-xs text-slate-600">
          {isEcho
            ? 'Runs after echo sessions; counters are separate from group training.'
            : 'Runs after group sessions; counters are separate from echo.'}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <input
          id={checkboxId}
          type="checkbox"
          checked={enabled}
          onChange={(event) =>
            setSettings(
              isEcho
                ? { ...settings, echoAutoAdjustKoch: event.target.checked }
                : { ...settings, autoAdjustKoch: event.target.checked },
            )
          }
          className="w-4 h-4"
        />
        <label htmlFor={checkboxId} className="text-sm font-medium text-gray-700">
          Automatically adjust level from session accuracy
        </label>
      </div>
      {enabled && charMode === 'digits' && (
        <p className="mt-1.5 text-xs text-slate-600">
          In Digits mode, the digits level is adjusted automatically; alphabet level stays fixed.
        </p>
      )}
      {enabled && charMode === 'mixed' && (
        <p className="mt-1.5 text-xs text-slate-600">
          In Mixed mode, the alphabet level is adjusted automatically; digits level stays fixed.
        </p>
      )}
      {enabled && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Threshold (%)</label>
            <input {...thresholdInput.inputProps} className="w-full px-3 py-2 border border-gray-300 rounded" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To decrease</label>
            <input {...belowInput.inputProps} className="w-full px-3 py-2 border border-gray-300 rounded" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To increase</label>
            <input {...aboveInput.inputProps} className="w-full px-3 py-2 border border-gray-300 rounded" />
          </div>
        </div>
      )}
    </div>
  );
}

export function AutoLevelAdjustProfiles({
  settings,
  setSettings,
  charMode,
  onSaveSettings,
  showHelp,
}: AutoLevelAdjustProfilesProps): JSX.Element {
  return (
    <>
      {showHelp && (
        <div className="mb-3 text-xs text-slate-700 bg-white border border-slate-200 rounded-lg p-3">
          <div className="font-semibold text-slate-800 mb-1">Auto level adjustment</div>
          <ul className="list-disc ml-4 space-y-1">
            <li>
              <span className="font-medium">Two profiles</span>: Group (copy sessions) and Echo (key
              practice) each have their own enable switch, thresholds, and session counters in
              storage.
            </li>
            <li>
              <span className="font-medium">Accuracy threshold</span>: Minimum session accuracy (%) to
              count toward a level increase.
            </li>
            <li>
              <span className="font-medium">To decrease</span>: Sessions below threshold before the
              level drops (0 = first miss drops).
            </li>
            <li>
              <span className="font-medium">To increase</span>: Sessions at or above threshold before
              the level rises (0 = first success rises).
            </li>
            <li>
              <span className="font-medium">Error weight</span> (below): Shared — biases random
              practice toward letters you miss.
            </li>
          </ul>
        </div>
      )}
      <div className="space-y-3">
        <AutoAdjustProfileBlock
          variant="group"
          settings={settings}
          setSettings={setSettings}
          charMode={charMode}
          {...(onSaveSettings !== undefined ? { onSaveSettings } : {})}
        />
        <AutoAdjustProfileBlock
          variant="echo"
          settings={settings}
          setSettings={setSettings}
          charMode={charMode}
          {...(onSaveSettings !== undefined ? { onSaveSettings } : {})}
        />
      </div>
    </>
  );
}
