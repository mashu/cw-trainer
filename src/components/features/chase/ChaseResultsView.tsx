'use client';

import React from 'react';

import { CharacterComparison } from '@/components/ui/training/CharacterComparison';
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

export function ChaseResultsView({
  result,
  onTrainAgain,
  onBack,
}: ChaseResultsViewProps): JSX.Element {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-900 bg-slate-950 text-white shadow-2xl">
      <div className="relative px-5 py-7 sm:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(244,63,94,0.28),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.24),transparent_34%)]" />
        <div className="relative space-y-6">
          <div className="text-center">
            <p className="text-xs font-black uppercase tracking-[0.35em] text-rose-300">
              Chase Over
            </p>
            <h2 className="mt-2 text-4xl font-black">
              You survived {formatDuration(result.survivedMs)}
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              Final score {Math.round(result.score)} with {Math.round(result.accuracy * 100)}% copy.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4">
              <p className="text-xs uppercase tracking-wide text-amber-200">Score</p>
              <p className="mt-1 text-3xl font-black">{Math.round(result.score)}</p>
            </div>
            <div className="rounded-2xl border border-cyan-300/30 bg-cyan-300/10 p-4">
              <p className="text-xs uppercase tracking-wide text-cyan-200">Max level</p>
              <p className="mt-1 text-3xl font-black">{result.maxLevel}</p>
            </div>
            <div className="rounded-2xl border border-emerald-300/30 bg-emerald-300/10 p-4">
              <p className="text-xs uppercase tracking-wide text-emerald-200">Best streak</p>
              <p className="mt-1 text-3xl font-black">{result.bestStreak}</p>
            </div>
            <div className="rounded-2xl border border-rose-300/30 bg-rose-300/10 p-4">
              <p className="text-xs uppercase tracking-wide text-rose-200">Groups</p>
              <p className="mt-1 text-3xl font-black">{result.groups.length}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-200">
              Final wave log
            </h3>
            <div className="mt-3 max-h-[48vh] space-y-2 overflow-y-auto pr-1">
              {result.groups.map((group, index) => (
                <div
                  key={`${group.sent}-${index}`}
                  className="rounded-xl border border-white/10 bg-slate-900/80 p-3"
                >
                  <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
                    <span>Target {index + 1}</span>
                    <span className={group.correct ? 'text-emerald-300' : 'text-rose-300'}>
                      {group.correct ? 'Copied' : 'Lost'}
                    </span>
                  </div>
                  <CharacterComparison
                    sent={group.sent}
                    received={group.received}
                    showBoxes
                    size="sm"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={onTrainAgain}
              className="rounded-xl bg-gradient-to-r from-rose-500 to-amber-400 px-7 py-3 text-lg font-black text-white shadow-lg transition hover:scale-105"
            >
              Chase Again
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
