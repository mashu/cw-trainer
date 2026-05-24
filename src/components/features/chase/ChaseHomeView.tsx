'use client';

import React from 'react';

import type { TrainingSettings } from '@/types';

interface ChaseHomeViewProps {
  readonly settings: TrainingSettings;
  readonly sessionCount: number;
  readonly lastAccuracyPercent: number;
  readonly onStart: () => void;
}

export function ChaseHomeView({
  settings,
  sessionCount,
  lastAccuracyPercent,
  onStart,
}: ChaseHomeViewProps): JSX.Element {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-900 bg-slate-950 text-white shadow-2xl">
      <div className="relative px-5 py-8 sm:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.32),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(244,63,94,0.28),transparent_35%)]" />
        <div className="absolute inset-0 opacity-20 bg-[linear-gradient(rgba(148,163,184,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.18)_1px,transparent_1px)] bg-[size:28px_28px]" />
        <div className="relative space-y-7">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-emerald-300">
              Arcade Copy
            </p>
            <h2 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">Chase Mode</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              Falling Morse groups are closing in. Copy the full group before it reaches the danger
              zone. Every level tightens the timer and unlocks another character from your current
              training sequence.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4">
              <p className="text-xs uppercase tracking-wide text-emerald-200">Lives</p>
              <p className="mt-1 text-3xl font-black">{settings.chaseLives}</p>
            </div>
            <div className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 p-4">
              <p className="text-xs uppercase tracking-wide text-cyan-200">Groups / level</p>
              <p className="mt-1 text-3xl font-black">{settings.chaseGroupsPerLevel}</p>
            </div>
            <div className="rounded-2xl border border-fuchsia-400/30 bg-fuchsia-400/10 p-4">
              <p className="text-xs uppercase tracking-wide text-fuchsia-200">Koch start</p>
              <p className="mt-1 text-3xl font-black">{settings.kochLevel}</p>
            </div>
            <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4">
              <p className="text-xs uppercase tracking-wide text-amber-200">Best latest</p>
              <p className="mt-1 text-3xl font-black">
                {sessionCount > 0 ? `${lastAccuracyPercent}%` : 'New'}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
            <p className="font-semibold text-white">How to survive</p>
            <p className="mt-2">
              Listen first, type the full group, then press Enter. Wrong answers and missed groups
              cost a life. Streaks and fast confirmations push your score up.
            </p>
          </div>

          <div className="flex justify-center">
            <button
              type="button"
              onClick={onStart}
              className="rounded-2xl bg-gradient-to-r from-rose-500 via-orange-500 to-amber-400 px-10 py-4 text-xl font-black text-white shadow-[0_0_40px_rgba(244,63,94,0.35)] transition hover:scale-105 hover:shadow-[0_0_55px_rgba(244,63,94,0.5)]"
            >
              Start Chase
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
