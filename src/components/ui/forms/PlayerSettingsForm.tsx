'use client';

import React from 'react';

import { useSpeechSynthesisVoices } from '@/hooks/useSpeechSynthesisVoices';

import type { FormTrainingSettings } from './TrainingSettingsForm';

interface PlayerSettingsFormProps {
  readonly settings: FormTrainingSettings;
  readonly setSettings: React.Dispatch<React.SetStateAction<FormTrainingSettings>>;
}

export function PlayerSettingsForm({
  settings,
  setSettings,
}: PlayerSettingsFormProps): JSX.Element {
  const { supported: speechSupported, voices: speechVoices } = useSpeechSynthesisVoices();
  const repeatCount = settings.playerLetterRepeatCount ?? 1;
  const delaySeconds = settings.playerDelaySeconds ?? 2;
  const randomizeLetters = settings.playerRandomizeLetters ?? false;
  const announceLetters = settings.playerAnnounceLetters ?? false;
  const selectedVoiceURI = settings.playerSpeechVoiceURI ?? '';

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-indigo-100 bg-gradient-to-br from-white via-indigo-50/40 to-slate-50 shadow-sm">
      <div className="border-b border-indigo-100/80 px-3 py-2.5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h5 className="text-sm font-semibold text-slate-900">Player Listening Practice</h5>
            <p className="text-xs text-slate-600 mt-1">
              Uses current alphabet, speed, spacing and tone.
            </p>
          </div>
          <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
            Player
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="rounded-full border border-indigo-100 bg-white/80 px-2 py-0.5 text-[10px] font-medium text-indigo-700">
            {randomizeLetters ? 'Random alphabet' : 'Typed text'}
          </span>
          <span className="rounded-full border border-emerald-100 bg-white/80 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
            {repeatCount}x Morse
          </span>
          <span className="rounded-full border border-slate-200 bg-white/80 px-2 py-0.5 text-[10px] font-medium text-slate-600">
            {delaySeconds}s pause
          </span>
        </div>
      </div>

      <div className="space-y-3 p-3">
        <div className="grid grid-cols-1 gap-2">
          <label
            className={`group flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 transition-colors ${
              randomizeLetters
                ? 'border-indigo-300 bg-indigo-50 shadow-sm'
                : 'border-slate-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/40'
            }`}
          >
            <span
              className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border ${
                randomizeLetters
                  ? 'border-indigo-600 bg-indigo-600 text-white'
                  : 'border-slate-300 bg-white text-transparent group-hover:border-indigo-300'
              }`}
              aria-hidden
            >
              <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.25 7.32a1 1 0 0 1-1.42 0l-3.25-3.28a1 1 0 1 1 1.42-1.408l2.54 2.563 6.54-6.603a1 1 0 0 1 1.414-.006Z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
            <input
              type="checkbox"
              checked={randomizeLetters}
              onChange={(event) =>
                setSettings((previous) => ({
                  ...previous,
                  playerRandomizeLetters: event.target.checked,
                }))
              }
              className="sr-only"
            />
            <span className="min-w-0">
              <span className="block text-xs font-semibold text-slate-800">
                Random letters from current alphabet
              </span>
            </span>
          </label>

          <label
            className={`group flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 transition-colors ${
              announceLetters
                ? 'border-emerald-300 bg-emerald-50 shadow-sm'
                : 'border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/40'
            } ${speechSupported ? '' : 'opacity-70'}`}
          >
            <span
              className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border ${
                announceLetters
                  ? 'border-emerald-600 bg-emerald-600 text-white'
                  : 'border-slate-300 bg-white text-transparent group-hover:border-emerald-300'
              }`}
              aria-hidden
            >
              <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.25 7.32a1 1 0 0 1-1.42 0l-3.25-3.28a1 1 0 1 1 1.42-1.408l2.54 2.563 6.54-6.603a1 1 0 0 1 1.414-.006Z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
            <input
              type="checkbox"
              checked={announceLetters}
              onChange={(event) =>
                setSettings((previous) => ({
                  ...previous,
                  playerAnnounceLetters: event.target.checked,
                }))
              }
              disabled={!speechSupported}
              className="sr-only"
            />
            <span className="min-w-0">
              <span className="block text-xs font-semibold text-slate-800">
                Speak letter after Morse
              </span>
              {!speechSupported && (
                <span className="block text-[11px] text-slate-500">Speech unavailable</span>
              )}
            </span>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm">
            <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Repeats
            </span>
            <input
              type="number"
              min="1"
              max="10"
              step="1"
              value={repeatCount}
              aria-label="Morse repeats before speech"
              onChange={(event) =>
                setSettings((previous) => ({
                  ...previous,
                  playerLetterRepeatCount: Math.max(
                    1,
                    Math.min(10, Math.trunc(Number(event.target.value) || 1)),
                  ),
                }))
              }
              className="mt-1.5 w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </label>

          <label className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm">
            <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Pause
            </span>
            <input
              type="number"
              min="0"
              max="60"
              step="0.1"
              value={delaySeconds}
              aria-label="Delay after each letter"
              onChange={(event) =>
                setSettings((previous) => ({
                  ...previous,
                  playerDelaySeconds: Math.max(0, Math.min(60, Number(event.target.value) || 0)),
                }))
              }
              className="mt-1.5 w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </label>
        </div>

        <label className="block rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm">
          <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Speech actor
          </span>
          <select
            value={selectedVoiceURI}
            onChange={(event) =>
              setSettings((previous) => ({
                ...previous,
                playerSpeechVoiceURI: event.target.value,
              }))
            }
            disabled={!speechSupported}
            className="mt-1.5 w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
          >
            <option value="">Default actor</option>
            {speechVoices.map((voice) => (
              <option key={voice.voiceURI} value={voice.voiceURI}>
                {voice.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
