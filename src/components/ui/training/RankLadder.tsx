'use client';

import React, { useMemo } from 'react';

import { MorseInsignia } from '@/components/ui/training/MorseInsignia';
import { computeOperatorProgress, OPERATOR_RANKS } from '@/lib/progression';
import type { SessionResult } from '@/types';

const formatXp = (xp: number): string => xp.toLocaleString('en-US');

export interface RankLadderProps {
  /** Full session history across all modes — lifetime XP drives the ladder. */
  readonly sessions: readonly SessionResult[];
}

/**
 * The full operator-rank ladder: all tiers, their XP thresholds, and where the
 * operator currently stands. Lives in the Trophy Case so the ranks are
 * browsable — a visible goal to climb toward, not just the current + next tier.
 */
export function RankLadder({ sessions }: RankLadderProps): JSX.Element {
  const progress = useMemo(() => computeOperatorProgress(sessions), [sessions]);
  const currentIndex = progress.rank.index;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">Operator Ranks</h3>
          <p className="mt-1 text-sm text-slate-600">
            Every session adds XP to your lifetime total — earn XP to climb the ladder. XP never
            resets.
          </p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-right">
          <p className="text-lg font-extrabold leading-none text-amber-800">
            {formatXp(progress.totalXp)}
          </p>
          <p className="mt-1 text-[0.65rem] font-semibold uppercase tracking-wide text-amber-700">
            Total XP
          </p>
        </div>
      </div>

      {/* Progress to next rank */}
      {progress.nextRank ? (
        <div className="mt-3">
          <div
            role="progressbar"
            aria-label={`Progress to ${progress.nextRank.title}`}
            aria-valuenow={progress.percentToNextRank}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-2 w-full overflow-hidden rounded-full bg-amber-100"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-700"
              style={{ width: `${Math.max(progress.percentToNextRank, 2)}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-slate-500">
            <span className="font-semibold text-slate-700">
              {formatXp(progress.xpToNextRank)} XP
            </span>{' '}
            to reach <span className="font-semibold text-slate-700">{progress.nextRank.title}</span>
          </p>
        </div>
      ) : (
        <p className="mt-3 text-sm font-semibold text-amber-700">
          Highest rank achieved — you&apos;ve topped the ladder. 🏆
        </p>
      )}

      <ol className="mt-4 space-y-1.5">
        {OPERATOR_RANKS.map((rank) => {
          const achieved = rank.index < currentIndex;
          const current = rank.index === currentIndex;
          return (
            <li
              key={rank.index}
              aria-current={current ? 'true' : undefined}
              className={`flex items-center gap-3 rounded-xl border p-2.5 transition ${
                current
                  ? 'border-amber-300 bg-amber-50 ring-1 ring-amber-300'
                  : achieved
                    ? 'border-amber-100 bg-amber-50/40'
                    : 'border-slate-200 bg-slate-50/60'
              }`}
            >
              {/* Medallion */}
              <div
                className={`flex h-11 w-11 shrink-0 flex-col items-center justify-center gap-1 rounded-full ${
                  achieved || current
                    ? 'bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-500 text-amber-950'
                    : 'bg-slate-200 text-slate-400'
                }`}
              >
                <span className="text-sm font-black leading-none">{rank.index + 1}</span>
                <MorseInsignia
                  pattern={rank.insignia}
                  className={achieved || current ? 'bg-amber-950/80' : 'bg-slate-400'}
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`truncate font-bold ${current ? 'text-amber-900' : achieved ? 'text-slate-800' : 'text-slate-500'}`}
                  >
                    {rank.title}
                  </span>
                  {current && (
                    <span className="shrink-0 rounded-full bg-amber-500 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-white">
                      You
                    </span>
                  )}
                  {achieved && (
                    <span className="shrink-0 text-amber-600" aria-label="achieved">
                      ✓
                    </span>
                  )}
                </div>
                <p
                  className={`truncate text-xs ${current || achieved ? 'text-slate-500' : 'text-slate-400'}`}
                >
                  {rank.motto}
                </p>
              </div>

              <div className="shrink-0 text-right">
                <p
                  className={`text-sm font-bold ${current ? 'text-amber-800' : achieved ? 'text-slate-600' : 'text-slate-500'}`}
                >
                  {formatXp(rank.minXp)}
                </p>
                <p className="text-[0.65rem] uppercase tracking-wide text-slate-400">XP</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
