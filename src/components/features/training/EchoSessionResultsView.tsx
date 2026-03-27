'use client';

import React from 'react';

import { CharacterComparison } from '@/components/ui/training/CharacterComparison';
import type { EchoSessionResultSummary } from '@/hooks/useEchoTrainingSession';

interface EchoSessionResultsViewProps {
  readonly result: EchoSessionResultSummary;
  readonly onTrainAgain: () => void;
  readonly onViewStats: () => void;
  readonly onBack: () => void;
}

export function EchoSessionResultsView({
  result,
  onTrainAgain,
  onViewStats,
  onBack,
}: EchoSessionResultsViewProps): JSX.Element {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">
          Echo Session Complete
        </h2>
        <p className="text-slate-600 mt-1">
          Sending accuracy and character recall from your latest run
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div
          className={`p-4 rounded-2xl border ${
            result.accuracy >= 0.9
              ? 'bg-emerald-50 border-emerald-200'
              : result.accuracy >= 0.7
                ? 'bg-amber-50 border-amber-200'
                : 'bg-rose-50 border-rose-200'
          }`}
        >
          <p className="text-xs uppercase tracking-wide text-slate-600 font-semibold">
            Accuracy
          </p>
          <p className="text-3xl font-extrabold mt-1">
            {Math.round(result.accuracy * 100)}%
          </p>
        </div>
        <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200">
          <p className="text-xs uppercase tracking-wide text-slate-600 font-semibold">
            Characters
          </p>
          <p className="text-3xl font-extrabold text-blue-700 mt-1">
            {result.correctCharacters}/
            {result.correctCharacters + result.incorrectCharacters}
          </p>
        </div>
        <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200">
          <p className="text-xs uppercase tracking-wide text-slate-600 font-semibold">
            Avg Time
          </p>
          <p className="text-3xl font-extrabold text-purple-700 mt-1">
            {Math.round(result.avgResponseMs)}
            <span className="text-base font-normal">ms</span>
          </p>
        </div>
        <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200">
          <p className="text-xs uppercase tracking-wide text-slate-600 font-semibold">
            Sending Score
          </p>
          <p
            className={`text-3xl font-extrabold mt-1 ${
              result.sendingScore >= 0 ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {result.sendingScore >= 0 ? '+' : ''}
            {result.sendingScore}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">
          Group Results
        </h3>
        <div className="max-h-[60vh] overflow-y-auto space-y-2">
          {result.groups.map((group, index) => (
            <div
              key={index}
              className="p-3 rounded-lg border bg-slate-50/50 border-slate-200"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Group {index + 1}
                </span>
                <span
                  className={`text-sm ${
                    group.correct ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {group.correct ? '✓' : '✗'}
                </span>
              </div>
              <div className="mt-1">
                <CharacterComparison
                  sent={group.sent}
                  received={group.received}
                  showBoxes={true}
                  size="sm"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-center gap-3 flex-wrap">
        <button
          onClick={onTrainAgain}
          className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white text-lg font-bold rounded-xl hover:from-emerald-600 hover:to-green-700 transform hover:scale-105 transition-all duration-200 shadow-lg"
        >
          Train Again
        </button>
        <button
          onClick={onViewStats}
          className="px-8 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-lg font-bold rounded-xl hover:from-blue-600 hover:to-indigo-700 transform hover:scale-105 transition-all duration-200 shadow-lg"
        >
          View All Stats
        </button>
        <button
          onClick={onBack}
          className="px-8 py-3 bg-white text-slate-700 text-lg font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 transition-all duration-200 shadow-sm"
        >
          Back to Menu
        </button>
      </div>
    </div>
  );
}
