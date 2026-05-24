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
    <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-rose-700">
      Chase only
    </span>
  );
}

export function ChaseSettingsForm({
  settings,
  setSettings,
  onSaveSettings,
}: ChaseSettingsFormProps): JSX.Element {
  const livesField = useNumberField(settings.chaseLives ?? 3, {
    min: 1,
    max: 6,
    step: 1,
    fieldName: 'chaseLives',
    onChange: (n) => setSettings((prev) => ({ ...prev, chaseLives: n })),
    ...(onSaveSettings !== undefined ? { onSave: onSaveSettings } : {}),
  });

  const groupsPerLevelField = useNumberField(settings.chaseGroupsPerLevel ?? 5, {
    min: 1,
    max: 50,
    step: 1,
    fieldName: 'chaseGroupsPerLevel',
    onChange: (n) => setSettings((prev) => ({ ...prev, chaseGroupsPerLevel: n })),
    ...(onSaveSettings !== undefined ? { onSave: onSaveSettings } : {}),
  });

  const startFallField = useNumberField(settings.chaseStartFallMs ?? 7200, {
    min: Math.max(500, settings.chaseMinFallMs ?? 1800),
    max: 60000,
    step: 100,
    fieldName: 'chaseStartFallMs',
    onChange: (n) => setSettings((prev) => ({ ...prev, chaseStartFallMs: n })),
    ...(onSaveSettings !== undefined ? { onSave: onSaveSettings } : {}),
  });

  const minFallField = useNumberField(settings.chaseMinFallMs ?? 1800, {
    min: 500,
    max: Math.max(500, settings.chaseStartFallMs ?? 7200),
    step: 100,
    fieldName: 'chaseMinFallMs',
    onChange: (n) => setSettings((prev) => ({ ...prev, chaseMinFallMs: n })),
    ...(onSaveSettings !== undefined ? { onSave: onSaveSettings } : {}),
  });

  const levelSpeedupField = useNumberField(settings.chaseLevelSpeedupMs ?? 430, {
    min: 0,
    max: 5000,
    step: 10,
    fieldName: 'chaseLevelSpeedupMs',
    onChange: (n) => setSettings((prev) => ({ ...prev, chaseLevelSpeedupMs: n })),
    ...(onSaveSettings !== undefined ? { onSave: onSaveSettings } : {}),
  });

  const groupSpeedupField = useNumberField(settings.chaseGroupSpeedupMs ?? 28, {
    min: 0,
    max: 5000,
    step: 1,
    fieldName: 'chaseGroupSpeedupMs',
    onChange: (n) => setSettings((prev) => ({ ...prev, chaseGroupSpeedupMs: n })),
    ...(onSaveSettings !== undefined ? { onSave: onSaveSettings } : {}),
  });

  return (
    <div className="mt-4 rounded-xl border border-rose-100 bg-gradient-to-br from-rose-50 to-orange-50 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-800">Chase game progression</h4>
          <p className="mt-1 text-xs text-slate-600">
            These settings affect only Chase mode. Shared Morse audio, character set, and group size
            are above.
          </p>
        </div>
        <SectionBadge />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Lives</span>
          <input
            {...livesField.inputProps}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          />
          <span className="mt-1 block text-xs text-slate-500">1-6 lives, default 3.</span>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Groups before level-up</span>
          <input
            {...groupsPerLevelField.inputProps}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          />
          <span className="mt-1 block text-xs text-slate-500">
            This is Chase&apos;s group count setting: copied groups needed before new pressure or
            characters arrive.
          </span>
        </label>

        <label className="flex items-start gap-3 rounded-lg border border-white/70 bg-white/60 p-3 sm:col-span-2">
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
              Add characters as Chase levels advance
            </span>
            <span className="mt-1 block text-xs text-slate-500">
              Separate from Group/Echo auto-adjust. Turn off to keep the starting alphabet during
              the run while speed still ramps.
            </span>
          </span>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Starting fall time (ms)</span>
          <input
            {...startFallField.inputProps}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Minimum fall time (ms)</span>
          <input
            {...minFallField.inputProps}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Speed-up per level (ms)</span>
          <input
            {...levelSpeedupField.inputProps}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Speed-up per group (ms)</span>
          <input
            {...groupSpeedupField.inputProps}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          />
        </label>
      </div>
    </div>
  );
}
