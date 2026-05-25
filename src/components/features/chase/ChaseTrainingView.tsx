'use client';

import React, { useEffect, useRef } from 'react';

import type { ChaseResolvedTarget, ChaseTarget } from '@/hooks/useChaseTrainingSession';
import { alignGroup } from '@/lib/groupAlignment';

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
  Array.from({ length: 6 }, (_, index) => (index < lives ? '●' : '○')).join(' ');

function getThreatClasses(groupLength: number): {
  readonly card: string;
  readonly label: string;
  readonly meter: string;
  readonly name: string;
} {
  if (groupLength >= 5) {
    return {
      card: 'border-rose-300/80 bg-rose-950/90 shadow-[0_0_38px_rgba(244,63,94,0.58)]',
      label: 'text-rose-100',
      meter: 'bg-rose-300',
      name: 'High threat',
    };
  }
  if (groupLength >= 4) {
    return {
      card: 'border-orange-300/80 bg-orange-950/90 shadow-[0_0_34px_rgba(251,146,60,0.5)]',
      label: 'text-orange-100',
      meter: 'bg-orange-300',
      name: 'Danger',
    };
  }
  if (groupLength >= 3) {
    return {
      card: 'border-amber-300/80 bg-amber-950/90 shadow-[0_0_30px_rgba(252,211,77,0.42)]',
      label: 'text-amber-100',
      meter: 'bg-amber-300',
      name: 'Medium',
    };
  }
  return {
    card: 'border-cyan-300/70 bg-slate-950/90 shadow-[0_0_32px_rgba(34,211,238,0.45)]',
    label: 'text-cyan-100',
    meter: 'bg-cyan-300',
    name: 'Light',
  };
}

function ChaseAnswerComparison({
  sent,
  received,
}: {
  readonly sent: string;
  readonly received: string;
}): JSX.Element {
  const alignment = alignGroup(sent, received);
  const boxClass =
    'inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-2 font-mono text-lg font-black';

  return (
    <div className="mt-3 overflow-x-auto">
      <div className="grid grid-cols-[4.5rem_1fr] items-center gap-x-2 gap-y-1">
        <p className="text-xs font-bold uppercase tracking-wide text-cyan-200/80">Answer</p>
        <div className="flex gap-1">
          {alignment.map((pair, index) => (
            <span
              key={`sent-${index}`}
              className={`${boxClass} border-cyan-300/35 bg-cyan-950/50 text-cyan-50`}
            >
              {pair.sentChar ?? ' '}
            </span>
          ))}
        </div>
        <p className="text-xs font-bold uppercase tracking-wide text-slate-300/80">Typed</p>
        <div className="flex gap-1">
          {alignment.map((pair, index) => {
            const isExtra = pair.sentChar === null;
            const typed = pair.receivedChar ?? '_';
            return (
              <span
                key={`received-${index}`}
                className={`${boxClass} ${
                  pair.match
                    ? 'border-slate-500/50 bg-slate-900/70 text-slate-100'
                    : isExtra
                      ? 'border-rose-300 bg-rose-900/80 text-rose-100 line-through'
                      : 'border-rose-300 bg-rose-900/80 text-rose-100'
                }`}
              >
                {typed}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

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
  const threat = target ? getThreatClasses(target.group.length) : null;
  const dangerFlash =
    lastResolvedTarget?.outcome === 'missed' || lastResolvedTarget?.outcome === 'wrong';

  useEffect(() => {
    inputRef.current?.focus();
  }, [target?.id]);

  useEffect(() => {
    const id = window.setInterval(() => {
      inputRef.current?.focus();
    }, 750);
    return (): void => window.clearInterval(id);
  }, []);

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

      <div
        className={`relative h-[28rem] overflow-hidden bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.18),transparent_34%),linear-gradient(180deg,#020617,#0f172a_55%,#450a0a)] ${
          dangerFlash ? 'animate-[chase-danger-flash_520ms_ease-out]' : ''
        }`}
        key={`field-${lastResolvedTarget?.sent ?? 'none'}-${lastResolvedTarget?.outcome ?? 'idle'}-${groupsCompleted}`}
        onMouseDown={() => inputRef.current?.focus()}
      >
        <div className="absolute inset-0 opacity-25 bg-[linear-gradient(rgba(125,211,252,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(125,211,252,0.18)_1px,transparent_1px)] bg-[size:34px_34px]" />
        <div className="absolute inset-x-0 bottom-0 h-24 border-t border-rose-400/60 bg-rose-500/15 shadow-[0_-24px_80px_rgba(244,63,94,0.35)]">
          <p className="mt-3 text-center text-xs font-black uppercase tracking-[0.45em] text-rose-200">
            Danger Zone
          </p>
        </div>

        {target ? (
          <div
            key={target.id}
            className={`absolute top-4 w-36 -translate-x-1/2 animate-[chase-fall_linear_forwards] rounded-2xl border p-3 text-center ${threat?.card ?? ''}`}
            style={{
              left: `${target.lanePercent}%`,
              animationDuration: `${target.fallMs}ms`,
            }}
          >
            <p
              className={`text-[0.65rem] font-bold uppercase tracking-[0.24em] ${threat?.label ?? 'text-cyan-100'}`}
            >
              {threat?.name ?? 'Threat'} · {target.group.length} chars
            </p>
            <p className="mt-2 text-3xl font-black tracking-[0.2em] text-white">
              {'?'.repeat(target.group.length)}
            </p>
            <div className="mt-3 h-1 rounded-full bg-white/20">
              <div className={`h-full rounded-full ${threat?.meter ?? 'bg-cyan-300'}`} />
            </div>
          </div>
        ) : null}

        {lastResolvedTarget && dangerFlash ? (
          <div
            key={`miss-${groupsCompleted}-${lastResolvedTarget.sent}`}
            className="pointer-events-none absolute inset-x-8 bottom-24 animate-[chase-target-missed_760ms_ease-out_forwards] rounded-2xl border border-rose-300/70 bg-rose-950/90 px-5 py-4 text-center shadow-[0_0_42px_rgba(244,63,94,0.6)]"
          >
            <p className="text-xs font-black uppercase tracking-[0.38em] text-rose-200">
              {lastResolvedTarget.outcome === 'missed' ? 'Missed target' : 'Wrong copy'}
            </p>
            <p className="mt-1 text-2xl font-black tracking-[0.22em] text-white">
              {lastResolvedTarget.sent}
            </p>
          </div>
        ) : null}
      </div>

      <div className="border-t border-cyan-300/10 bg-slate-950/95 p-4">
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
        {lastResolvedTarget && dangerFlash ? (
          <div className="mb-3 rounded-2xl border border-rose-300/50 bg-rose-950/70 p-3 shadow-[0_0_30px_rgba(244,63,94,0.25)]">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-rose-200">
              {lastResolvedTarget.outcome === 'missed' ? 'Missed group' : 'Wrong group'}
            </p>
            <ChaseAnswerComparison
              sent={lastResolvedTarget.sent}
              received={lastResolvedTarget.received}
            />
          </div>
        ) : null}
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
            placeholder={target ? `COPY ${target.group.length}` : 'COPY'}
            autoComplete="off"
            autoFocus
            spellCheck={false}
          />
          <button
            type="submit"
            className="rounded-xl border border-cyan-300/40 bg-cyan-400/15 px-4 py-3 text-xs font-black uppercase tracking-wide text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.25)] transition hover:bg-cyan-400/25"
          >
            Auto-fire
          </button>
        </form>
        <p className="mt-2 text-xs text-slate-400">
          Auto-fires as soon as {target ? target.group.length : 'the final'} characters are typed.
        </p>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-300 transition-all"
            style={{ width: `${Math.round(levelProgress * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
