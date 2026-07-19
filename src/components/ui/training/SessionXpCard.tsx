'use client';

import React, { useEffect, useMemo, useState } from 'react';

import { MorseInsignia } from '@/components/ui/training/MorseInsignia';
import { operatorProgressForXp, sessionXpBreakdown, totalXp } from '@/lib/progression';
import type { SessionResult } from '@/types';

const formatXp = (xp: number): string => xp.toLocaleString('en-US');

export interface SessionXpCardProps {
  /** Full session history across all modes, including the just-finished session. */
  readonly allSessions: readonly SessionResult[];
  /** The session whose XP receipt is being shown. */
  readonly latestSession: SessionResult;
}

/**
 * Results-screen XP receipt: how much this session earned, why, and how it
 * moved the rank bar — with a celebration when a new rank was reached.
 */
export function SessionXpCard({
  allSessions,
  latestSession,
}: SessionXpCardProps): JSX.Element | null {
  const view = useMemo(() => {
    const breakdown = sessionXpBreakdown(latestSession);
    if (breakdown.totalXp <= 0) return null;
    const historyXp = totalXp(allSessions);
    // History normally already contains the finished session; be defensive in
    // case persistence lags behind the results screen.
    const included = allSessions.some((s) => s.timestamp === latestSession.timestamp);
    const afterXp = included ? historyXp : historyXp + breakdown.totalXp;
    const beforeXp = Math.max(0, afterXp - breakdown.totalXp);
    const before = operatorProgressForXp(beforeXp);
    const after = operatorProgressForXp(afterXp);
    return {
      breakdown,
      after,
      rankUp: after.rank.index > before.rank.index,
      // Bar animates within the (possibly new) rank band: start from the old
      // position, or from empty when the session crossed into a new rank.
      fromPercent: after.rank.index > before.rank.index ? 0 : before.percentToNextRank,
    };
  }, [allSessions, latestSession]);

  const [barPercent, setBarPercent] = useState(view?.fromPercent ?? 0);
  useEffect(() => {
    if (!view) return;
    setBarPercent(view.fromPercent);
    const id = window.setTimeout(() => setBarPercent(view.after.percentToNextRank), 250);
    return (): void => window.clearTimeout(id);
  }, [view]);

  if (!view) return null;
  const { breakdown, after, rankUp } = view;
  const accuracyBonusPercent = Math.round((breakdown.accuracyMultiplier - 1) * 100);
  const speedBonusPercent = Math.round(breakdown.speedBonus * 100);

  return (
    <section
      aria-label="Experience earned"
      className="relative overflow-hidden rounded-2xl border border-slate-700/70 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 p-5 text-white shadow-lg"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-amber-400/20 blur-3xl"
      />

      {rankUp && (
        <div className="relative mb-4 flex items-center gap-3 rounded-xl border border-amber-300/40 bg-gradient-to-r from-amber-400/20 via-yellow-300/20 to-amber-400/20 px-4 py-3 animate-xp-pop">
          <span className="text-2xl" aria-hidden>
            ⬆️
          </span>
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-amber-300">
              Rank up
            </p>
            <p className="text-lg font-extrabold text-amber-100">
              You are now <span className="text-white">{after.rank.title}</span>{' '}
              <MorseInsignia pattern={after.rank.insignia} />
            </p>
          </div>
        </div>
      )}

      <div className="relative flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-4xl font-black tracking-tight text-amber-300 animate-xp-pop">
          +{formatXp(breakdown.totalXp)} <span className="text-xl font-extrabold">XP</span>
        </p>
        <div className="flex flex-wrap gap-1.5 text-xs">
          <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 font-semibold text-slate-200">
            {breakdown.correctChars} chars copied
          </span>
          {accuracyBonusPercent > 0 && (
            <span className="rounded-full border border-emerald-300/30 bg-emerald-400/15 px-2.5 py-1 font-semibold text-emerald-200">
              +{accuracyBonusPercent}% accuracy
            </span>
          )}
          {speedBonusPercent > 0 && (
            <span className="rounded-full border border-sky-300/30 bg-sky-400/15 px-2.5 py-1 font-semibold text-sky-200">
              +{speedBonusPercent}% speed
            </span>
          )}
        </div>
      </div>

      <div className="relative mt-4">
        <div
          role="progressbar"
          aria-label={
            after.nextRank ? `Progress to ${after.nextRank.title}` : 'Highest rank achieved'
          }
          aria-valuenow={after.percentToNextRank}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-3 w-full overflow-hidden rounded-full bg-slate-700/70 shadow-inner"
        >
          <div
            className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 transition-all duration-1000 ease-out"
            style={{ width: `${Math.max(barPercent, 2)}%` }}
          >
            <div
              aria-hidden
              className="absolute inset-y-0 w-1/3 -skew-x-12 bg-white/40 animate-shimmer"
            />
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 text-xs">
          <span className="text-slate-400">
            {after.rank.title} · {formatXp(after.totalXp)} XP total
          </span>
          {after.nextRank ? (
            <span className="text-slate-300">
              <span className="font-bold text-amber-200">{formatXp(after.xpToNextRank)} XP</span> to{' '}
              <span className="font-semibold text-white">{after.nextRank.title}</span>
            </span>
          ) : (
            <span className="font-semibold text-amber-300">Highest rank achieved 🏆</span>
          )}
        </div>
      </div>
    </section>
  );
}
