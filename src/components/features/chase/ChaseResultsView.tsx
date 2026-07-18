'use client';

import React from 'react';

import type { ChaseSessionResultSummary } from '@/hooks/useChaseTrainingSession';

interface ChaseResultsViewProps {
  readonly result: ChaseSessionResultSummary;
  readonly onTrainAgain: () => void;
  readonly onBack: () => void;
}

function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes > 0 ? `${minutes}m ${rest}s` : `${rest}s`;
}

const OUTCOME_SEGMENT: Record<string, string> = {
  correct: 'bg-emerald-400',
  wrong: 'bg-rose-400',
  missed: 'bg-slate-600',
};

const OUTCOME_TILE: Record<string, string> = {
  correct: 'border-emerald-400/50 bg-emerald-400/10 text-emerald-200',
  wrong: 'border-rose-400/50 bg-rose-400/10 text-rose-200',
  missed: 'border-slate-500/50 bg-slate-500/10 text-slate-400',
};

export function ChaseResultsView({
  result,
  onTrainAgain,
  onBack,
}: ChaseResultsViewProps): JSX.Element {
  const copyPercent = Math.round(result.accuracy * 100);
  const headline =
    copyPercent >= 90
      ? 'Beautiful copy — you rode the whole conversation.'
      : copyPercent >= 70
        ? 'Solid copy — you stayed with the flow.'
        : copyPercent >= 50
          ? 'Good fight — letting go is half the skill.'
          : 'Rough band conditions — every pass makes the next one easier.';

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-900 bg-slate-950 text-white shadow-2xl">
      <div className="relative px-5 py-7 sm:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.24),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.24),transparent_34%)]" />
        <div className="relative space-y-6">
          <div className="text-center">
            <p className="text-xs font-black uppercase tracking-[0.35em] text-cyan-300">
              Conversation Over
            </p>
            <h2 className="mt-2 text-4xl font-black">{copyPercent}% copied</h2>
            <p className="mt-2 text-sm text-slate-300">
              {headline} {result.lettersTotal} letters over {formatDuration(result.durationMs)}.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4">
              <p className="text-xs uppercase tracking-wide text-amber-200">Score</p>
              <p className="mt-1 text-3xl font-black">{Math.round(result.score)}</p>
            </div>
            <div className="rounded-2xl border border-emerald-300/30 bg-emerald-300/10 p-4">
              <p className="text-xs uppercase tracking-wide text-emerald-200">Best combo</p>
              <p className="mt-1 text-3xl font-black">×{result.bestCombo}</p>
            </div>
            <div className="rounded-2xl border border-cyan-300/30 bg-cyan-300/10 p-4">
              <p className="text-xs uppercase tracking-wide text-cyan-200">Peak pace</p>
              <p className="mt-1 text-3xl font-black">
                {result.peakWpm}
                <span className="ml-1 text-sm font-bold text-cyan-200">wpm</span>
              </p>
            </div>
            <div className="rounded-2xl border border-fuchsia-300/30 bg-fuchsia-300/10 p-4">
              <p className="text-xs uppercase tracking-wide text-fuchsia-200">Max level</p>
              <p className="mt-1 text-3xl font-black">{result.maxLevel}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-200">
                Conversation heat-line
              </h3>
              <p className="text-xs text-slate-400">
                <span className="text-emerald-300">{result.correctCount} copied</span>
                {' · '}
                <span className="text-rose-300">{result.wrongCount} wrong</span>
                {' · '}
                <span className="text-slate-400">{result.missedCount} let go</span>
              </p>
            </div>
            <div className="mt-3 flex h-3 w-full gap-px overflow-hidden rounded-full">
              {result.letters.map((letter, index) => (
                <span
                  key={index}
                  className={`h-full flex-1 ${OUTCOME_SEGMENT[letter.outcome] ?? 'bg-slate-600'}`}
                  title={`${letter.char} → ${letter.typed || '·'}`}
                />
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-200">
              Letter log
            </h3>
            <div className="mt-3 flex max-h-[38vh] flex-wrap gap-1.5 overflow-y-auto pr-1">
              {result.letters.map((letter, index) => (
                <span
                  key={index}
                  className={`inline-flex h-9 min-w-9 flex-col items-center justify-center rounded-lg border px-1 font-mono text-sm font-bold leading-none ${OUTCOME_TILE[letter.outcome] ?? ''}`}
                >
                  {letter.char}
                  {letter.outcome === 'wrong' ? (
                    <span className="mt-0.5 text-[0.55rem] text-rose-300 line-through">
                      {letter.typed}
                    </span>
                  ) : null}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={onTrainAgain}
              className="rounded-xl bg-gradient-to-r from-cyan-500 to-fuchsia-500 px-7 py-3 text-lg font-black text-white shadow-lg transition hover:scale-105"
            >
              Sing It Again
            </button>
            <button
              type="button"
              onClick={onBack}
              className="rounded-xl border border-white/15 bg-white/10 px-7 py-3 text-lg font-bold text-slate-100 transition hover:bg-white/20"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
