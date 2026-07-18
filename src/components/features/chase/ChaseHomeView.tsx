'use client';

import React from 'react';

import {
  KARAOKE_TONE_MAX_HZ,
  KARAOKE_TONE_MIN_HZ,
  KARAOKE_TONE_STEP_HZ,
} from '@/lib/chase';
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
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.28),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.26),transparent_35%)]" />
        <div className="absolute inset-0 opacity-20 bg-[linear-gradient(rgba(148,163,184,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.18)_1px,transparent_1px)] bg-[size:28px_28px]" />
        <div className="relative space-y-7">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-cyan-300">
              Karaoke Copy
            </p>
            <h2 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">Chase Mode</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              Letters stream across the timeline like karaoke notes, each sung at its own tone
              between {KARAOKE_TONE_MIN_HZ} and {KARAOKE_TONE_MAX_HZ} Hz. Type what you hear
              before the note drifts away. The pace wanders like a real conversation — clean copy
              speeds it up, mistakes ease it off, and breather phases give you room to reset.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 p-4">
              <p className="text-xs uppercase tracking-wide text-cyan-200">Pace range</p>
              <p className="mt-1 text-3xl font-black">
                {settings.effectiveWpmMin}–{settings.effectiveWpmMax}
                <span className="ml-1 text-sm font-bold text-cyan-200">wpm</span>
              </p>
            </div>
            <div className="rounded-2xl border border-violet-400/30 bg-violet-400/10 p-4">
              <p className="text-xs uppercase tracking-wide text-violet-200">Tone lanes</p>
              <p className="mt-1 text-3xl font-black">
                {KARAOKE_TONE_MIN_HZ}–{KARAOKE_TONE_MAX_HZ}
                <span className="ml-1 text-sm font-bold text-violet-200">Hz</span>
              </p>
              <p className="mt-1 text-xs text-violet-200/80">{KARAOKE_TONE_STEP_HZ} Hz steps</p>
            </div>
            <div className="rounded-2xl border border-fuchsia-400/30 bg-fuchsia-400/10 p-4">
              <p className="text-xs uppercase tracking-wide text-fuchsia-200">Koch start</p>
              <p className="mt-1 text-3xl font-black">{settings.kochLevel}</p>
            </div>
            <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4">
              <p className="text-xs uppercase tracking-wide text-amber-200">Last copy</p>
              <p className="mt-1 text-3xl font-black">
                {sessionCount > 0 ? `${lastAccuracyPercent}%` : 'New'}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
            <p className="font-semibold text-white">How to flow</p>
            <p className="mt-2">
              Type each letter as it crosses the line. If one slips past, let it go — typing a
              later letter drops the ones before it, just like real conversations move on. There
              are no lives: play as long as it feels good, then press Finish to see how well you
              copied the whole exchange.
            </p>
          </div>

          <div className="flex justify-center">
            <button
              type="button"
              onClick={onStart}
              className="rounded-2xl bg-gradient-to-r from-cyan-500 via-violet-500 to-fuchsia-500 px-10 py-4 text-xl font-black text-white shadow-[0_0_40px_rgba(34,211,238,0.35)] transition hover:scale-105 hover:shadow-[0_0_55px_rgba(168,85,247,0.5)]"
            >
              Start the Stream
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
