'use client';

import React from 'react';

import { useNumberField } from '@/hooks/useNumberField';
import { applyAutoAdjustDirectionCountChange } from '@/lib/autoAdjustCountSettings';

import type { FormTrainingSettings } from './TrainingSettingsForm';

type CharMode = 'koch' | 'digits' | 'custom' | 'mixed';

export type AutoLevelAdjustProfileMode = 'group' | 'echo';

type ProfileVariant = AutoLevelAdjustProfileMode;

interface AutoLevelAdjustProfilesProps {
  readonly settings: FormTrainingSettings;
  readonly setSettings: (
    settings: FormTrainingSettings | ((prev: FormTrainingSettings) => FormTrainingSettings),
  ) => void;
  readonly charMode: CharMode;
  /** Which session type these controls apply to (matches the active training mode in the sidebar). */
  readonly profileMode: ProfileVariant;
  readonly onSaveSettings?: () => void;
  readonly showHelp: boolean;
}

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
    spinStep: 10,
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
      setSettings((prev) => {
        const currentAbove = isEcho
          ? (prev.echoAutoAdjustAboveThresholdCount ?? 0)
          : (prev.autoAdjustAboveThresholdCount ?? 0);
        const currentBelow = isEcho
          ? (prev.echoAutoAdjustBelowThresholdCount ?? 0)
          : (prev.autoAdjustBelowThresholdCount ?? 0);
        const next = applyAutoAdjustDirectionCountChange(currentAbove, currentBelow, 'below', n);
        return isEcho
          ? {
              ...prev,
              echoAutoAdjustBelowThresholdCount: next.below,
              echoAutoAdjustAboveThresholdCount: next.above,
            }
          : {
              ...prev,
              autoAdjustBelowThresholdCount: next.below,
              autoAdjustAboveThresholdCount: next.above,
            };
      }),
    ...(onSaveSettings !== undefined ? { onSave: onSaveSettings } : {}),
  });

  const aboveInput = useNumberField(aboveCount, {
    min: 0,
    max: 20,
    step: 1,
    fieldName: aboveField,
    onChange: (n) =>
      setSettings((prev) => {
        const currentAbove = isEcho
          ? (prev.echoAutoAdjustAboveThresholdCount ?? 0)
          : (prev.autoAdjustAboveThresholdCount ?? 0);
        const currentBelow = isEcho
          ? (prev.echoAutoAdjustBelowThresholdCount ?? 0)
          : (prev.autoAdjustBelowThresholdCount ?? 0);
        const next = applyAutoAdjustDirectionCountChange(currentAbove, currentBelow, 'above', n);
        return isEcho
          ? {
              ...prev,
              echoAutoAdjustAboveThresholdCount: next.above,
              echoAutoAdjustBelowThresholdCount: next.below,
            }
          : {
              ...prev,
              autoAdjustAboveThresholdCount: next.above,
              autoAdjustBelowThresholdCount: next.below,
            };
      }),
    ...(onSaveSettings !== undefined ? { onSave: onSaveSettings } : {}),
  });

  const decreaseDisabled = belowCount === 0;
  const increaseDisabled = aboveCount === 0;

  return (
    <div
      className={`rounded-lg border p-3 ${
        isEcho ? 'border-violet-200 bg-violet-50/40' : 'border-slate-200 bg-slate-50/50'
      }`}
    >
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
          In Mixed mode, alphabet and digits levels are adjusted together from session accuracy.
        </p>
      )}
      {enabled && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Threshold (%)</label>
            <input {...thresholdInput.inputProps} className="w-full px-3 py-2 border border-gray-300 rounded" />
          </div>
          <div>
            <label
              className={`block text-sm font-medium mb-1 ${
                decreaseDisabled ? 'text-slate-400' : 'text-gray-700'
              }`}
              title={decreaseDisabled ? 'Disabled — level will not decrease' : undefined}
            >
              To decrease
            </label>
            <input
              {...belowInput.inputProps}
              className={`w-full px-3 py-2 border rounded ${
                decreaseDisabled
                  ? 'border-slate-200 bg-slate-100 text-slate-400'
                  : 'border-gray-300'
              }`}
              aria-disabled={decreaseDisabled}
            />
          </div>
          <div>
            <label
              className={`block text-sm font-medium mb-1 ${
                increaseDisabled ? 'text-slate-400' : 'text-gray-700'
              }`}
              title={increaseDisabled ? 'Disabled — level will not increase' : undefined}
            >
              To increase
            </label>
            <input
              {...aboveInput.inputProps}
              className={`w-full px-3 py-2 border rounded ${
                increaseDisabled
                  ? 'border-slate-200 bg-slate-100 text-slate-400'
                  : 'border-gray-300'
              }`}
              aria-disabled={increaseDisabled}
            />
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
  profileMode,
  onSaveSettings,
  showHelp,
}: AutoLevelAdjustProfilesProps): JSX.Element {
  const modeLabel = profileMode === 'echo' ? 'Echo' : 'Group';
  return (
    <>
      {showHelp && (
        <div className="mb-3 text-xs text-slate-700 bg-white border border-slate-200 rounded-lg p-3">
          <div className="font-semibold text-slate-800 mb-1">Auto level adjustment</div>
          <ul className="list-disc ml-4 space-y-1">
            <li>
              <span className="font-medium">{modeLabel} sessions</span>: These options apply only to{' '}
              {profileMode === 'echo' ? 'echo (send-back)' : 'group copy'} practice. They use the
              alphabet / digits level from the character set section above.
            </li>
            <li>
              <span className="font-medium">Accuracy threshold</span>: Minimum session accuracy (%) to
              count toward a level increase.
            </li>
            <li>
              <span className="font-medium">To decrease</span>: How many sessions below threshold are
              needed before the level drops by 1 (1 = after the first bad session). Set to 0 to
              disable decreases.
            </li>
            <li>
              <span className="font-medium">To increase</span>: How many sessions at or above
              threshold are needed before the level rises by 1 (1 = after the first good session). Set
              to 0 to disable increases.
            </li>
            <li>At least one direction must stay enabled (0 cannot be set on both).</li>
            <li>
              <span className="font-medium">Error weight</span> (below): Shared — biases random
              practice toward letters you miss.
            </li>
          </ul>
        </div>
      )}
      <AutoAdjustProfileBlock
        variant={profileMode}
        settings={settings}
        setSettings={setSettings}
        charMode={charMode}
        {...(onSaveSettings !== undefined ? { onSaveSettings } : {})}
      />
    </>
  );
}
