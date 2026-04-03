'use client';

import React from 'react';

import type { FormTrainingSettings } from './TrainingSettingsForm';

interface EchoSettingsFormProps {
  readonly settings: FormTrainingSettings;
  readonly setSettings: React.Dispatch<React.SetStateAction<FormTrainingSettings>>;
}

export function EchoSettingsForm({
  settings,
  setSettings,
}: EchoSettingsFormProps): JSX.Element {
  const echoKeyerMode = settings.echoKeyerMode ?? 'manual';

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h5 className="text-sm font-semibold text-slate-800">Echo Keyer</h5>
          <p className="text-xs text-slate-600 mt-1">
            Uses your current character speed as keyer WPM.
          </p>
        </div>
        <select
          value={echoKeyerMode}
          onChange={(event) => {
            const nextMode = event.target.value === 'iambic-b' ? 'iambic-b' : 'manual';
            setSettings((previous) => ({
              ...previous,
              echoKeyerMode: nextMode,
            }));
          }}
          className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="manual">Manual</option>
          <option value="iambic-b">Iambic B</option>
        </select>
      </div>
      <p className="text-[11px] text-slate-500 mt-3">
        Manual and Iambic B use timed element spacing from your character speed; Iambic B alternates
        when both paddles are squeezed.
      </p>
    </div>
  );
}
