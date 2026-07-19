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
      className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-4 sm:p-5"
    >
      {rankUp && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-100/70 px-4 py-3 animate-xp-pop">
          <span className="text-2xl" aria-hidden>
            ⬆️
          </span>
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-amber-700">
              Rank up
            </p>
            <p className="text-lg font-extrabold text-amber-900">
              You are now <span className="text-slate-900">{after.rank.title}</span>{' '}
              <MorseInsignia pattern={after.rank.insignia} />
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-amber-700">
            Earned this session
          </p>
          <p className="text-4xl font-black leading-none tracking-tight text-amber-700 animate-xp-pop">
            +{formatXp(breakdown.totalXp)} <span className="text-xl font-extrabold">XP</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs">
          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-600">
            {breakdown.correctChars} chars copied
          </span>
          {accuracyBonusPercent > 0 && (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">
              +{accuracyBonusPercent}% accuracy
            </span>
          )}
          {speedBonusPercent > 0 && (
            <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 font-semibold text-sky-700">
              +{speedBonusPercent}% speed
            </span>
          )}
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-slate-700">
            {after.rank.title} <MorseInsignia pattern={after.rank.insignia} />
          </span>
          <span className="text-slate-500">
            <span className="font-bold text-amber-700">{formatXp(after.totalXp)} XP</span> lifetime
          </span>
        </div>
        <div
          role="progressbar"
          aria-label={
            after.nextRank ? `Progress to ${after.nextRank.title}` : 'Highest rank achieved'
          }
          aria-valuenow={after.percentToNextRank}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-2.5 w-full overflow-hidden rounded-full bg-amber-100"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-1000 ease-out"
            style={{ width: `${Math.max(barPercent, 2)}%` }}
          />
        </div>
        <p className="mt-1.5 text-xs text-slate-500">
          {after.nextRank ? (
            <>
              <span className="font-semibold text-slate-700">
                {formatXp(after.xpToNextRank)} XP
              </span>{' '}
              to reach <span className="font-semibold text-slate-700">{after.nextRank.title}</span>
            </>
          ) : (
            <span className="font-semibold text-amber-700">Highest rank achieved 🏆</span>
          )}
        </p>
      </div>
    </section>
  );
}
