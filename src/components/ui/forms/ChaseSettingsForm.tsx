'use client';

import React, { type Dispatch, type SetStateAction } from 'react';

import { useNumberField } from '@/hooks/useNumberField';

import type { FormTrainingSettings } from './TrainingSettingsForm';

interface ChaseSettingsFormProps {
  readonly settings: FormTrainingSettings;
  readonly setSettings: Dispatch<SetStateAction<FormTrainingSettings>>;
  readonly onSaveSettings?: () => void;
}

function SectionBadge(): JSX.Element {
  return (
    <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-cyan-700">
      Chase only
    </span>
  );
}

export function ChaseSettingsForm({
  settings,
  setSettings,
  onSaveSettings,
}: ChaseSettingsFormProps): JSX.Element {
  const lettersPerLevelField = useNumberField(settings.chaseGroupsPerLevel ?? 5, {
    min: 1,
    max: 50,
    step: 1,
    fieldName: 'chaseGroupsPerLevel',
    onChange: (n) => setSettings((prev) => ({ ...prev, chaseGroupsPerLevel: n })),
    ...(onSaveSettings !== undefined ? { onSave: onSaveSettings } : {}),
  });

  return (
    <div className="mt-4 rounded-xl border border-cyan-100 bg-gradient-to-br from-cyan-50 to-violet-50 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-800">Chase karaoke stream</h4>
          <p className="mt-1 text-xs text-slate-600">
            The stream&apos;s pace wanders inside your shared <strong>effective WPM</strong> range
            above: clean copy pushes it toward the top, mistakes ease it back down. Notes play at
            tones from 300 to 800 Hz regardless of the shared side-tone setting.
          </p>
        </div>
        <SectionBadge />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Clean copies per level-up</span>
          <input
            {...lettersPerLevelField.inputProps}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          />
          <span className="mt-1 block text-xs text-slate-500">
            Correct letters needed before the run levels up. Higher = slower character unlocks.
          </span>
        </label>

        <label className="flex items-start gap-3 rounded-lg border border-white/70 bg-white/60 p-3">
          <input
            type="checkbox"
            checked={settings.chaseAutoLevelEnabled ?? true}
            onChange={(event) =>
              setSettings((prev) => ({
                ...prev,
                chaseAutoLevelEnabled: event.target.checked,
              }))
            }
            className="mt-1 h-4 w-4"
          />
          <span>
            <span className="block text-sm font-medium text-slate-700">
              Add characters as levels advance
            </span>
            <span className="mt-1 block text-xs text-slate-500">
              Separate from Group/Echo auto-adjust. Turn off to keep the starting alphabet while
              the pace still adapts.
            </span>
          </span>
        </label>
      </div>
    </div>
  );
}
