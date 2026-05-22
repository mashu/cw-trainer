'use client';

import React from 'react';

import { useAchievementsState } from '@/hooks/useAchievements';
import { ACHIEVEMENT_BADGES } from '@/lib/achievements';
import type { SessionResult } from '@/types';

const tierClasses = {
  bronze: 'border-amber-200 bg-amber-50 text-amber-800',
  silver: 'border-slate-200 bg-slate-50 text-slate-800',
  gold: 'border-yellow-200 bg-yellow-50 text-yellow-800',
  platinum: 'border-indigo-200 bg-indigo-50 text-indigo-800',
} as const;

const tierIconClasses = {
  bronze: 'bg-amber-100 text-amber-700 ring-amber-200',
  silver: 'bg-slate-100 text-slate-700 ring-slate-200',
  gold: 'bg-yellow-100 text-yellow-700 ring-yellow-200',
  platinum: 'bg-indigo-100 text-indigo-700 ring-indigo-200',
} as const;

const categoryInitial = {
  mastery: 'M',
  performance: 'P',
  consistency: 'C',
  score: 'S',
} as const;

function BadgeMedallion({
  tier,
  category,
  unlocked,
}: {
  readonly tier: keyof typeof tierIconClasses;
  readonly category: keyof typeof categoryInitial;
  readonly unlocked: boolean;
}): JSX.Element {
  return (
    <div
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ring-1 ${
        unlocked ? tierIconClasses[tier] : 'bg-slate-100 text-slate-400 ring-slate-200'
      }`}
      aria-hidden="true"
    >
      <svg className="h-7 w-7" viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="13" r="8" stroke="currentColor" strokeWidth="2" />
        <path
          d="M11 20L8 29L16 25L24 29L21 20"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <text x="16" y="16" textAnchor="middle" className="fill-current text-[9px] font-bold">
          {categoryInitial[category]}
        </text>
      </svg>
    </div>
  );
}

export function AchievementTrophyCase({
  sessions,
}: {
  readonly sessions: readonly SessionResult[];
}): JSX.Element {
  const { achievements, progress, achievementsSyncing } = useAchievementsState(sessions);
  const unlockedById = new Map(achievements.map((achievement) => [achievement.id, achievement] as const));
  const unlockedCount = achievements.length;
  const totalCount = ACHIEVEMENT_BADGES.length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
            Trophies
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-900">
            {unlockedCount}/{totalCount}
          </div>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Letters mastered
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-900">
            {progress.masteredLetterCount}/{progress.totalLetterCount}
          </div>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">
            Best score
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-900">
            {Math.round(progress.bestScore)}
          </div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">
            Best streak
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-900">
            {progress.longestStreakDays}d
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Trophy Case</h3>
            <p className="mt-1 text-sm text-slate-600">
              Trophies unlock and stay visible locally on this device. Sign in only if you want
              sync and public profile sharing.
            </p>
          </div>
          {achievementsSyncing && <span className="text-xs text-slate-500">Syncing...</span>}
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {ACHIEVEMENT_BADGES.map((badge) => {
            const unlocked = unlockedById.get(badge.id);
            return (
              <div
                key={badge.id}
                className={`rounded-xl border p-4 transition ${
                  unlocked
                    ? tierClasses[badge.tier]
                    : 'border-slate-200 bg-slate-50 text-slate-500 opacity-75'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3">
                    <BadgeMedallion
                      tier={badge.tier}
                      category={badge.category}
                      unlocked={Boolean(unlocked)}
                    />
                    <div>
                      <div className="text-sm font-bold">{badge.title}</div>
                      <div className="mt-1 text-xs">{badge.description}</div>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-white/70 px-2 py-1 text-xs font-semibold">
                    {unlocked ? 'Earned' : 'Locked'}
                  </span>
                </div>
                <div className="mt-3 pl-14 text-xs opacity-80">{badge.criteria}</div>
                {unlocked && (
                  <div className="mt-2 pl-14 text-xs opacity-80">
                    Earned {new Date(unlocked.unlockedAt).toLocaleDateString()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
