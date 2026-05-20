'use client';

import React from 'react';

import type { AutoLevelAdjustProgressView } from '@/lib/kochAutoAdjust';

function ProgressRow({
  label,
  detail,
  count,
  target,
  tone,
}: {
  readonly label: string;
  readonly detail: string;
  readonly count: number;
  readonly target: number;
  readonly tone: 'up' | 'down';
}): JSX.Element {
  const ratio = target > 0 ? Math.min(1, count / target) : 0;
  const barClass =
    tone === 'up'
      ? 'bg-gradient-to-r from-emerald-400 to-emerald-600'
      : 'bg-gradient-to-r from-rose-400 to-rose-600';
  const trackClass = tone === 'up' ? 'bg-emerald-100' : 'bg-rose-100';
  const textClass = tone === 'up' ? 'text-emerald-800' : 'text-rose-800';
  const mutedClass = tone === 'up' ? 'text-emerald-700/80' : 'text-rose-700/80';

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className={`text-sm font-semibold ${textClass}`}>{label}</span>
        <span className={`text-sm font-bold tabular-nums ${textClass}`}>
          {count} / {target}
        </span>
      </div>
      <p className={`text-xs mt-0.5 ${mutedClass}`}>{detail}</p>
      <div
        className={`mt-2 h-2.5 w-full rounded-full overflow-hidden ${trackClass}`}
        role="progressbar"
        aria-valuenow={count}
        aria-valuemin={0}
        aria-valuemax={target}
        aria-label={label}
      >
        <div
          className={`h-full rounded-full transition-all duration-300 ${barClass}`}
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
  const {
    adjustsBothLevels,
    threshold,
    aboveCount,
    belowCount,
    aboveTarget,
    belowTarget,
    aboveImmediate,
    belowImmediate,
  } = progress;

  const bothNote = adjustsBothLevels ? ' — both levels move together' : '';

  const increaseDetail = aboveImmediate
    ? `Next session at or above ${threshold}% raises level${bothNote} (setting: 0 = first success)`
    : `Sessions at or above ${threshold}% accuracy${bothNote}`;
  const decreaseDetail = belowImmediate
    ? `Next session below ${threshold}% lowers level${bothNote} (setting: 0 = first miss)`
    : `Sessions below ${threshold}% accuracy${bothNote}`;

  return (
    <section
      className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 to-white p-4 sm:p-5"
      aria-labelledby="auto-level-progress-heading"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
        <div>
          <h3
            id="auto-level-progress-heading"
            className="text-sm font-semibold uppercase tracking-wide text-indigo-800"
          >
            Level change progress
            {profileLabel ? ` · ${profileLabel}` : ''}
          </h3>
          <p className="text-sm text-slate-600 mt-1">Counts reset when levels change</p>
        </div>
      </div>

      <div className="space-y-4">
        <ProgressRow
          label="Toward level up"
          detail={increaseDetail}
          count={aboveCount}
          target={aboveTarget}
          tone="up"
        />
        <ProgressRow
          label="Toward level down"
          detail={decreaseDetail}
          count={belowCount}
          target={belowTarget}
          tone="down"
        />
      </div>
    </section>
  );
}
