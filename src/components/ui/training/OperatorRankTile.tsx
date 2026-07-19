'use client';

import React from 'react';

import { MorseInsignia } from '@/components/ui/training/MorseInsignia';
import type { OperatorProgress } from '@/lib/progression';

const formatXp = (xp: number): string => xp.toLocaleString('en-US');

export interface OperatorRankTileProps {
  readonly progress: OperatorProgress;
}

/**
 * Home-screen KPI tile for the operator rank ladder. Styled to sit alongside
 * the Last accuracy / Sessions / Level tiles — light gradient, same footprint —
 * with a slim always-moving bar so progression stays visible without competing
 * with the practice heatmap for attention.
 */
export function OperatorRankTile({ progress }: OperatorRankTileProps): JSX.Element {
  const { rank, nextRank, percentToNextRank, xpToNextRank, totalXp } = progress;

  return (
    <div className="p-3 rounded-xl bg-gradient-to-br from-amber-50 to-white border border-amber-100">
      <p className="text-xs uppercase tracking-wide text-amber-700 font-semibold flex items-center gap-1.5">
        Rank
        <MorseInsignia pattern={rank.insignia} className="bg-amber-500" />
      </p>
      <p className="text-2xl font-extrabold text-amber-800 mt-0.5 leading-tight truncate">
        {rank.title}
      </p>
      <div className="mt-1.5">
        <div
          role="progressbar"
          aria-label={nextRank ? `Progress to ${nextRank.title}` : 'Highest rank achieved'}
          aria-valuenow={percentToNextRank}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-1.5 w-full overflow-hidden rounded-full bg-amber-100"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-700"
            style={{ width: `${Math.max(percentToNextRank, 2)}%` }}
          />
        </div>
        <p className="mt-1 text-[0.7rem] text-amber-700/90">
          {nextRank ? (
            <>
              <span className="font-semibold">{formatXp(totalXp)} XP</span> ·{' '}
              {formatXp(xpToNextRank)} to {nextRank.title}
            </>
          ) : (
            <>
              <span className="font-semibold">{formatXp(totalXp)} XP</span> · Max rank 🏆
            </>
          )}
        </p>
      </div>
    </div>
  );
}
