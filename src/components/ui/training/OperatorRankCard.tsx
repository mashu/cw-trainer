'use client';

import React, { useMemo } from 'react';

import { computeOperatorProgress, OPERATOR_RANKS } from '@/lib/progression';
import type { SessionResult } from '@/types';

const formatXp = (xp: number): string => xp.toLocaleString('en-US');

/** Morse insignia pips: '·' renders as a dot, '−' as a short dash bar. */
export function MorseInsignia({
  pattern,
  className = 'bg-amber-300',
}: {
  readonly pattern: string;
  readonly className?: string;
}): JSX.Element {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden>
      {Array.from(pattern).map((symbol, i) =>
        symbol === '−' ? (
          <span key={i} className={`inline-block h-1.5 w-4 rounded-full ${className}`} />
        ) : (
          <span key={i} className={`inline-block h-1.5 w-1.5 rounded-full ${className}`} />
        ),
      )}
    </span>
  );
}

export interface OperatorRankCardProps {
  /** Full session history across all training modes — every session earns XP. */
  readonly sessions: readonly SessionResult[];
}

/**
 * Home-screen rank hero: lifetime XP, current operator rank and an animated
 * bar to the next rank. The one card that always shows forward motion, even
 * between trophy unlocks and teaching-plan stages.
 */
export function OperatorRankCard({ sessions }: OperatorRankCardProps): JSX.Element {
  const progress = useMemo(() => computeOperatorProgress(sessions), [sessions]);
  const { rank, nextRank, percentToNextRank, xpToNextRank } = progress;
  const atTop = nextRank === null;

  return (
    <section
      aria-label="Operator rank"
      className="relative overflow-hidden rounded-2xl border border-slate-700/70 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 p-5 text-white shadow-lg"
    >
      {/* Ambient glow behind the medallion */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-10 -top-14 h-44 w-44 rounded-full bg-amber-400/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-16 -right-8 h-40 w-40 rounded-full bg-indigo-500/20 blur-3xl"
      />

      <div className="relative flex items-center gap-4">
        {/* Medallion */}
        <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center gap-1.5 rounded-full bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-600 shadow-md ring-2 ring-amber-200/60">
          <span className="text-lg font-black leading-none text-amber-950">{rank.index + 1}</span>
          <MorseInsignia pattern={rank.insignia} className="bg-amber-950/80" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-amber-300/90">
            Operator rank
          </p>
          <h3 className="truncate text-xl font-extrabold leading-tight">{rank.title}</h3>
          <p className="truncate text-xs text-slate-300/90 italic">{rank.motto}</p>
        </div>

        <div className="shrink-0 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-right backdrop-blur-sm">
          <p className="text-lg font-extrabold leading-none text-amber-200">
            {formatXp(progress.totalXp)}
          </p>
          <p className="mt-1 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-300">
            Total XP
          </p>
        </div>
      </div>

      {/* Progress to next rank */}
      <div className="relative mt-4">
        <div
          role="progressbar"
          aria-label={atTop ? 'Highest rank achieved' : `Progress to ${nextRank.title}`}
          aria-valuenow={percentToNextRank}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-3 w-full overflow-hidden rounded-full bg-slate-700/70 shadow-inner"
        >
          <div
            className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 transition-all duration-700"
            style={{ width: `${Math.max(percentToNextRank, 2)}%` }}
          >
            <div
              aria-hidden
              className="absolute inset-y-0 w-1/3 -skew-x-12 bg-white/40 animate-shimmer"
            />
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 text-xs">
          <span className="text-slate-400">
            Rank {rank.index + 1} of {OPERATOR_RANKS.length}
          </span>
          {atTop ? (
            <span className="font-semibold text-amber-300">Highest rank achieved 🏆</span>
          ) : (
            <span className="text-slate-300">
              <span className="font-bold text-amber-200">{formatXp(xpToNextRank)} XP</span> to{' '}
              <span className="font-semibold text-white">{nextRank.title}</span>{' '}
              <MorseInsignia pattern={nextRank.insignia} className="bg-amber-300/80" />
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
