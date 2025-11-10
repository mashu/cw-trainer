'use client';

import React, { useCallback, useMemo, useState } from 'react';

import { useIcrAnalytics } from '@/hooks/useIcrAnalytics';
import { useIcrSessionsActions, useIcrSessionsState } from '@/hooks/useIcrSessions';

interface ICRStatsProps {
  onBack: () => void;
  embedded?: boolean; // when true, render compact UI without page chrome
}

export function ICRStats({ onBack, embedded }: ICRStatsProps): JSX.Element {
  const [tab, setTab] = useState<'overview' | 'sessions'>('overview');

  const {
    icrSessions,
    icrSessionsStatus,
    icrSessionsError,
    icrSessionsSaving,
  } = useIcrSessionsState();
  const { clearIcrSessions } = useIcrSessionsActions();
  const icrSummary = useIcrAnalytics();

  const isIcrLoading = icrSessionsStatus === 'loading';
  const hasIcrSessions = icrSessions.length > 0;

  const handleClearIcrSessions = useCallback((): void => {
    if (!icrSessions.length) {
      return;
    }
    const confirmed = window.confirm('Clear all ICR session history? This cannot be undone.');
    if (!confirmed) {
      return;
    }
    void clearIcrSessions().catch((error) => {
      console.error('[ICRStats] Failed to clear ICR sessions', error);
    });
  }, [clearIcrSessions, icrSessions.length]);

  return (
    <div
      className={embedded ? '' : 'min-h-screen bg-gradient-to-b from-slate-50 to-white p-4 sm:p-6'}
    >
      <div
        className={
          embedded
            ? ''
            : 'max-w-6xl mx-auto bg-white rounded-2xl shadow-xl ring-1 ring-black/5 p-4 sm:p-8'
        }
      >
        {/* Header */}
        <div className="flex flex-col gap-3 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">ICR Statistics</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={onBack}
                className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm sm:text-base hover:bg-blue-700"
              >
                Back to ICR Training
              </button>
            </div>
          </div>

          {isIcrLoading && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              Loading ICR sessions…
            </div>
          )}

          {icrSessionsError && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              {icrSessionsError}
            </div>
          )}

          {!isIcrLoading && !hasIcrSessions && (
            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-800">No ICR sessions yet</h3>
              <p className="mt-2 text-sm text-slate-600">
                Start an ICR training session to see detailed reaction and accuracy analytics here.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onBack}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700"
                >
                  Go to ICR Trainer
                </button>
              </div>
            </div>
          )}

          {/* Tabs */}
          {hasIcrSessions && (
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 text-sm">
                {(['overview', 'sessions'] as const).map((t) => (
                  <button
                    key={t}
                    className={`px-3 py-1.5 rounded-lg capitalize transition-colors ${
                      tab === t ? 'bg-white shadow-sm text-slate-900' : 'text-slate-600 hover:text-slate-800'
                    }`}
                    onClick={() => setTab(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* KPIs */}
        {tab === 'overview' && hasIcrSessions && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
            <div className="p-4 rounded-xl border border-slate-200 bg-gradient-to-br from-emerald-50 to-white">
              <div className="text-xs text-slate-500">Avg Accuracy</div>
              <div className="mt-1 text-2xl font-semibold text-slate-800">
                {icrSummary.averageAccuracyPercent}%
              </div>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 bg-gradient-to-br from-blue-50 to-white">
              <div className="text-xs text-slate-500">Sessions</div>
              <div className="mt-1 text-2xl font-semibold text-slate-800">
                {icrSummary.totalSessions}
              </div>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 bg-gradient-to-br from-amber-50 to-white">
              <div className="text-xs text-slate-500">Avg Reaction</div>
              <div className="mt-1 text-2xl font-semibold text-slate-800">
                {icrSummary.averageReactionMs}
                <span className="text-base text-slate-500 ml-1">ms</span>
              </div>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 bg-gradient-to-br from-violet-50 to-white">
              <div className="text-xs text-slate-500">Total Trials</div>
              <div className="mt-1 text-2xl font-semibold text-slate-800">
                {icrSummary.totalTrials}
              </div>
            </div>
            {icrSummary.bestLetter && (
              <div className="p-4 rounded-xl border border-slate-200 bg-gradient-to-br from-emerald-100/50 to-white">
                <div className="text-xs text-slate-500">Best Letter</div>
                <div className="mt-1 text-2xl font-semibold text-slate-800">
                  {icrSummary.bestLetter.letter}
                </div>
                <div className="mt-1 text-xs text-slate-600">
                  {icrSummary.bestLetter.accuracyPercent.toFixed(1)}% accuracy
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sessions Tab */}
        {tab === 'sessions' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-sm text-slate-600">
                {icrSummary.totalSessions} ICR sessions • {icrSummary.totalTrials} trials
                {icrSummary.lastSessionAt
                  ? ` · Last session ${new Date(icrSummary.lastSessionAt).toLocaleString()}`
                  : ''}
              </div>
              <button
                onClick={handleClearIcrSessions}
                className="self-start sm:self-auto px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={icrSessionsSaving || !hasIcrSessions}
              >
                Clear history
              </button>
            </div>

            {icrSessionsStatus === 'loading' && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                Loading ICR sessions…
              </div>
            )}

            {icrSessionsStatus !== 'loading' && !hasIcrSessions && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
                No ICR sessions recorded yet. Run the ICR trainer to see detailed reaction and
                accuracy analytics here.
              </div>
            )}

            {hasIcrSessions && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {icrSessions
                  .slice()
                  .reverse()
                  .map((session) => {
                    const letterEntries = Object.entries(session.perLetter || {})
                      .map(([letter, stats]) => ({
                        letter,
                        accuracyPercent: stats.total
                          ? Math.round((stats.correct / stats.total) * 100)
                          : 0,
                        total: stats.total,
                        averageReactionMs: stats.averageReactionMs,
                      }))
                      .sort((a, b) => b.accuracyPercent - a.accuracyPercent);
                    const topLetters = letterEntries.slice(0, 3);

                    return (
                      <div
                        key={session.timestamp}
                        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-semibold text-slate-800">
                              {new Date(session.timestamp).toLocaleString()}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {session.trials.length} trials • Accuracy {session.accuracyPercent}%
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-slate-800">
                              {session.averageReactionMs} ms
                            </p>
                            <p className="text-xs text-slate-500">Avg reaction</p>
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600">
                          <div className="rounded-lg bg-slate-50 p-2">
                            <div className="font-medium text-slate-700">Audio snapshot</div>
                            <p className="mt-1">
                              {session.settingsSnapshot.audio.charWpm} WPM • tone
                              {` ${session.settingsSnapshot.audio.sideToneMin}–${session.settingsSnapshot.audio.sideToneMax}`} Hz
                            </p>
                          </div>
                          <div className="rounded-lg bg-slate-50 p-2">
                            <div className="font-medium text-slate-700">ICR settings</div>
                            <p className="mt-1">
                              {session.settingsSnapshot.icr.trialsPerSession} trials • delay{' '}
                              {session.settingsSnapshot.icr.trialDelayMs} ms
                            </p>
                          </div>
                        </div>

                        {topLetters.length > 0 && (
                          <div className="mt-3 text-xs text-slate-600">
                            <div className="font-medium text-slate-700">Top letters</div>
                            <div className="mt-1 flex flex-wrap gap-2">
                              {topLetters.map((entry) => (
                                <span
                                  key={entry.letter}
                                  className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 font-mono text-emerald-700"
                                >
                                  {entry.letter}{' '}
                                  <span className="text-emerald-600">
                                    {entry.accuracyPercent}%
                                  </span>
                                  <span className="text-slate-400">({entry.total})</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

