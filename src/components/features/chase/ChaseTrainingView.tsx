'use client';

import React, { useEffect, useRef } from 'react';

import type { ChaseResolvedTarget, ChaseTarget } from '@/hooks/useChaseTrainingSession';

interface ChaseTrainingViewProps {
  readonly target: ChaseTarget | null;
  readonly lastResolvedTarget: ChaseResolvedTarget | null;
  readonly userInput: string;
  readonly lives: number;
  readonly level: number;
  readonly score: number;
  readonly streak: number;
  readonly bestStreak: number;
  readonly levelProgress: number;
  readonly groupsCompleted: number;
  readonly onChange: (value: string) => void;
  readonly onSubmit: () => void;
  readonly onStop: () => void;
}

const renderLives = (lives: number): string =>
  Array.from({ length: 3 }, (_, index) => (index < lives ? '●' : '○')).join(' ');

export function ChaseTrainingView({
  target,
  lastResolvedTarget,
  userInput,
  lives,
  level,
  score,
  streak,
  bestStreak,
  levelProgress,
  groupsCompleted,
  onChange,
  onSubmit,
  onStop,
}: ChaseTrainingViewProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [target?.id]);

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-900 bg-slate-950 text-white shadow-2xl">
      <div className="grid gap-3 border-b border-white/10 bg-slate-900/80 p-4 sm:grid-cols-5">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Score</p>
          <p className="text-2xl font-black text-amber-300">{score}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Level</p>
          <p className="text-2xl font-black text-cyan-300">{level}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Lives</p>
          <p className="text-2xl font-black text-rose-300">{renderLives(lives)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Streak</p>
          <p className="text-2xl font-black text-emerald-300">{streak}</p>
        </div>
        <button
          type="button"
          onClick={onStop}
          className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-bold text-slate-100 transition hover:bg-white/20"
        >
          Stop
        </button>
      </div>

      <div className="relative h-[30rem] overflow-hidden bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.18),transparent_34%),linear-gradient(180deg,#020617,#0f172a_55%,#450a0a)]">
        <div className="absolute inset-0 opacity-25 bg-[linear-gradient(rgba(125,211,252,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(125,211,252,0.18)_1px,transparent_1px)] bg-[size:34px_34px]" />
        <div className="absolute inset-x-0 bottom-0 h-24 border-t border-rose-400/60 bg-rose-500/15 shadow-[0_-24px_80px_rgba(244,63,94,0.35)]">
          <p className="mt-3 text-center text-xs font-black uppercase tracking-[0.45em] text-rose-200">
            Danger Zone
          </p>
        </div>

        {target ? (
          <div
            key={target.id}
            className="absolute top-4 w-32 -translate-x-1/2 animate-[chase-fall_linear_forwards] rounded-2xl border border-cyan-300/70 bg-slate-950/90 p-3 text-center shadow-[0_0_32px_rgba(34,211,238,0.45)]"
            style={{
              left: `${target.lanePercent}%`,
              animationDuration: `${target.fallMs}ms`,
            }}
          >
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.24em] text-cyan-200">
              Group {target.group.length}
            </p>
            <p className="mt-2 text-3xl font-black tracking-[0.2em] text-white">
              {'?'.repeat(target.group.length)}
            </p>
            <div className="mt-3 h-1 rounded-full bg-cyan-300/30">
              <div className="h-full rounded-full bg-cyan-300" />
            </div>
          </div>
        ) : null}

        <div className="absolute inset-x-4 bottom-28 rounded-2xl border border-white/10 bg-slate-950/80 p-4 backdrop-blur">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
            <span>Groups copied: {groupsCompleted}</span>
            <span>Best streak: {bestStreak}</span>
            {lastResolvedTarget ? (
              <span
                className={
                  lastResolvedTarget.outcome === 'correct'
                    ? 'font-bold text-emerald-300'
                    : 'font-bold text-rose-300'
                }
              >
                Last: {lastResolvedTarget.sent} / {lastResolvedTarget.received || 'MISS'}
              </span>
            ) : null}
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              onSubmit();
            }}
            className="flex gap-2"
          >
            <input
              ref={inputRef}
              value={userInput}
              onChange={(event) => onChange(event.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-cyan-300/40 bg-slate-950 px-4 py-3 text-2xl font-black uppercase tracking-[0.25em] text-cyan-100 outline-none ring-cyan-300/30 transition focus:ring-4"
              placeholder="COPY"
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="submit"
              className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-black uppercase tracking-wide text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.45)] transition hover:bg-cyan-300"
            >
              Fire
            </button>
          </form>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-300 transition-all"
              style={{ width: `${Math.round(levelProgress * 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
