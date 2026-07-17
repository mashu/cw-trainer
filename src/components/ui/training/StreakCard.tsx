'use client';

import React, { useMemo } from 'react';

import { computeStreakStatus } from '@/lib/streak';

export interface StreakCardProps {
  readonly practiceDates: readonly string[];
}

/**
 * Home-screen streak banner: the daily reason to press Start.
 * safe → celebrate; at-risk → urgency; lost → soft restart invitation.
 */
export function StreakCard({ practiceDates }: StreakCardProps): JSX.Element | null {
  const status = useMemo(() => computeStreakStatus(practiceDates), [practiceDates]);

  if (status.state === 'none') {
    return null;
  }

  const freezeChip =
    status.freezesAvailable > 0 ? (
      <span
        className="ml-auto shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold bg-sky-50 border border-sky-200 text-sky-700"
        title="A streak freeze covers one missed day automatically. Earn one for every 7 practiced days."
      >
        🧊 ×{status.freezesAvailable}
      </span>
    ) : null;

  if (status.state === 'safe') {
    return (
      <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white px-4 py-3 flex items-center gap-3">
        <span className="text-xl" aria-hidden>🔥</span>
        <p className="text-sm text-emerald-800">
          <span className="font-bold">{status.days}-day streak</span> — today is in the bag.
          {status.freezesUsed > 0 ? ` (${status.freezesUsed} freeze${status.freezesUsed > 1 ? 's' : ''} used)` : ''}
        </p>
        {freezeChip}
      </div>
    );
  }

  if (status.state === 'at-risk') {
    return (
      <div className="rounded-xl border border-amber-300 bg-gradient-to-br from-amber-50 to-white px-4 py-3 flex items-center gap-3">
        <span className="text-xl" aria-hidden>⚠️</span>
        <p className="text-sm text-amber-800">
          <span className="font-bold">{status.days}-day streak at risk</span> — practice today to
          keep it alive.
        </p>
        {freezeChip}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 flex items-center gap-3">
      <span className="text-xl" aria-hidden>💔</span>
      <p className="text-sm text-slate-700">
        Your <span className="font-bold">{status.lostStreakDays}-day streak</span> ended — one
        session today starts the next one.
      </p>
    </div>
  );
}
