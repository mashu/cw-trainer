'use client';

import React from 'react';

export type TextPlayerMode = 'playText' | 'listeningPractice';

type HelpChipProps = {
  readonly expanded: boolean;
  readonly onToggle: () => void;
  readonly title: string;
  readonly children: React.ReactNode;
};

export function HelpChip({ expanded, onToggle, title, children }: HelpChipProps): JSX.Element {
  return (
    <div className="rounded-xl border border-slate-200 bg-white/90">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <span className="text-xs font-semibold text-slate-700">{title}</span>
        <button
          type="button"
          onClick={onToggle}
          className={`inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-full border px-2 text-xs font-bold transition-colors ${
            expanded
              ? 'border-indigo-600 bg-indigo-600 text-white'
              : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
          }`}
          aria-expanded={expanded}
          aria-label="Show help"
        >
          ?
        </button>
      </div>
      {expanded && (
        <div className="border-t border-slate-100 px-3 py-3 text-sm leading-relaxed text-slate-700">
          {children}
        </div>
      )}
    </div>
  );
}

type ModeTabButtonProps = {
  readonly mode: TextPlayerMode;
  readonly active: boolean;
  readonly disabled: boolean;
  readonly title: string;
  readonly subtitle: string;
  readonly onSelect: () => void;
};

export function ModeTabButton({
  mode,
  active,
  disabled,
  title,
  subtitle,
  onSelect,
}: ModeTabButtonProps): JSX.Element {
  return (
    <button
      type="button"
      role="tab"
      id={`text-player-tab-${mode}`}
      aria-selected={active}
      aria-controls={`text-player-panel-${mode}`}
      disabled={disabled}
      onClick={onSelect}
      className={`flex min-h-[4.5rem] flex-col items-start justify-center rounded-xl border px-3 py-3 text-left transition-all sm:min-h-[5rem] sm:px-4 ${
        active
          ? 'border-indigo-300 bg-gradient-to-br from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-200/60'
          : 'border-transparent bg-white text-slate-700 hover:border-indigo-200 hover:bg-indigo-50/50 disabled:opacity-60'
      }`}
    >
      <span className="text-sm font-bold sm:text-base">{title}</span>
      <span
        className={`mt-1 text-xs leading-snug ${active ? 'text-indigo-100' : 'text-slate-500'}`}
      >
        {subtitle}
      </span>
    </button>
  );
}

type ListeningSourcePanelProps = {
  readonly randomizeLetters: boolean;
  readonly repeatCount: number;
  readonly delaySeconds: number;
  readonly announceLetters: boolean;
  readonly wakeLockSupported: boolean;
  readonly wakeLockActive: boolean;
};

export function ListeningSourcePanel({
  randomizeLetters,
  repeatCount,
  delaySeconds,
  announceLetters,
  wakeLockSupported,
  wakeLockActive,
}: ListeningSourcePanelProps): JSX.Element {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 via-white to-emerald-50/40 p-4 sm:p-5">
        <p className="text-sm font-semibold text-indigo-950 sm:text-base">
          {randomizeLetters
            ? 'Random letters from your training alphabet'
            : 'Letters from the text you enter below'}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          {randomizeLetters
            ? 'Each round sends a new letter from the same alphabet you use in group training. Press Start listening when you are ready — nothing to type here.'
            : 'Letters play in the order you typed them, then start again from the beginning. Spaces are ignored.'}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full border border-indigo-200 bg-white px-3 py-1 text-xs font-semibold text-indigo-800">
            {randomizeLetters ? 'Random alphabet' : 'Your text'}
          </span>
          <span className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold text-emerald-800">
            {repeatCount}× Morse per letter
          </span>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
            {delaySeconds}s pause between letters
          </span>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
            {announceLetters ? 'Spoken after Morse' : 'Morse only'}
          </span>
          {wakeLockSupported && (
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                wakeLockActive
                  ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border border-slate-200 bg-white text-slate-600'
              }`}
            >
              {wakeLockActive ? 'Screen stays awake' : 'Screen wake lock available'}
            </span>
          )}
        </div>
      </div>
      <p className="text-xs text-slate-500 px-1">
        Change repeats, pause, speech, or random vs. your own letters in Settings →{' '}
        <span className="font-semibold text-slate-700">Player Listening Practice</span>.
      </p>
    </div>
  );
}

type PlaybackMetaProps = {
  readonly charWpmLabel: string;
  readonly effWpmLabel: string;
  readonly toneHz: number;
  readonly extraWordSpace: number;
  readonly durationSec: number;
  readonly statusLine?: string | undefined;
};

export function PlaybackMeta({
  charWpmLabel,
  effWpmLabel,
  toneHz,
  extraWordSpace,
  durationSec,
  statusLine,
}: PlaybackMetaProps): JSX.Element {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-700 sm:text-base">
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Character WPM
          </span>
          <p className="mt-0.5 font-semibold text-slate-900">{charWpmLabel}</p>
        </div>
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Effective WPM
          </span>
          <p className="mt-0.5 font-semibold text-slate-900">{effWpmLabel}</p>
        </div>
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Side tone
          </span>
          <p className="mt-0.5 font-semibold text-slate-900">{toneHz} Hz</p>
        </div>
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Word spacing
          </span>
          <p className="mt-0.5 font-semibold text-slate-900">×{extraWordSpace}</p>
        </div>
      </div>
      {durationSec > 0 && (
        <p className="mt-3 text-xs text-slate-500">
          Last segment: ~{Math.round(durationSec)}s
        </p>
      )}
      {statusLine && (
        <p className="mt-2 text-sm font-medium text-indigo-700">{statusLine}</p>
      )}
    </div>
  );
}
