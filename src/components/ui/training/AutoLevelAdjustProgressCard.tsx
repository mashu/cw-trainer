'use client';

import React from 'react';

import type { AutoLevelAdjustProgressView } from '@/lib/kochAutoAdjust';

function CompactBar({
  label,
  count,
  target,
  threshold,
  tone,
}: {
  readonly label: string;
  readonly count: number;
  readonly target: number;
  readonly threshold: number;
  readonly tone: 'up' | 'down';
}): JSX.Element {
  const ratio = target > 0 ? Math.min(1, count / target) : 0;
  const fill =
    tone === 'up'
      ? 'bg-emerald-500'
      : 'bg-rose-500';
  const track = tone === 'up' ? 'bg-emerald-100' : 'bg-rose-100';
  const hint =
    tone === 'up'
      ? `Sessions ≥ ${threshold}% toward level up`
      : `Sessions < ${threshold}% toward level down`;

  return (
    <div className="min-w-0 flex-1" title={hint}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-xs font-medium text-slate-600">{label}</span>
        <span className="text-xs font-semibold tabular-nums text-slate-700">
          {count}/{target}
        </span>
      </div>
      <div
        className={`h-1.5 w-full rounded-full overflow-hidden ${track}`}
        role="progressbar"
        aria-valuenow={count}
        aria-valuemin={0}
        aria-valuemax={target}
        aria-label={label}
      >
        <div
          className={`h-full rounded-full transition-all duration-300 ${fill}`}
          style={{ width: `${Math.round(ratio * 100)}%` }}
        />
      </div>
    </div>
  );
}

export interface AutoLevelAdjustProgressCardProps {
  readonly progress: AutoLevelAdjustProgressView;
  readonly profileLabel?: string;
}

export function AutoLevelAdjustProgressCard({
  progress,
  profileLabel,
}: AutoLevelAdjustProgressCardProps): JSX.Element {
  const { threshold, aboveCount, belowCount, aboveTarget, belowTarget, adjustsBothLevels } =
    progress;

  return (
    <section
      className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2.5 w-full min-w-0"
      aria-label="Automatic level adjustment progress"
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold text-slate-700">Auto level</span>
        {profileLabel ? (
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
            {profileLabel}
          </span>
        ) : null}
      </div>
      <div className="flex gap-3">
        <CompactBar
          label="Up"
          count={aboveCount}
          target={aboveTarget}
          threshold={threshold}
          tone="up"
        />
        <CompactBar
          label="Down"
          count={belowCount}
          target={belowTarget}
          threshold={threshold}
          tone="down"
        />
      </div>
      <p className="mt-1.5 text-[10px] text-slate-400 leading-snug">
        {adjustsBothLevels ? 'Letters & digits' : 'Resets on level change'}
      </p>
    </section>
  );
}
