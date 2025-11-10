'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Scatter,
  ScatterChart,
  Legend,
  Cell,
  Line,
} from 'recharts';

import { useIcrAnalytics } from '@/hooks/useIcrAnalytics';
import { useIcrSessionsActions, useIcrSessionsState } from '@/hooks/useIcrSessions';
import { KOCH_SEQUENCE } from '@/lib/morseConstants';
import type { IcrSessionResult } from '@/types';

interface ICRStatsProps {
  onBack: () => void;
  embedded?: boolean; // when true, render compact UI without page chrome
}

type LetterBarPoint = {
  readonly letter: string;
  readonly index: number;
  readonly adjAvg: number;
  readonly avg: number;
  readonly acc: number;
  readonly total: number;
};

type ReactionScatterPoint = {
  readonly letter: string;
  readonly reaction: number;
};

export function ICRStats({ onBack, embedded }: ICRStatsProps): JSX.Element {
  const [selectedSessionIndex, setSelectedSessionIndex] = useState<number>(0);

  const {
    icrSessions,
    icrSessionsStatus,
    icrSessionsError,
    icrSessionsSaving,
  } = useIcrSessionsState();
  const { clearIcrSessions, deleteIcrSession } = useIcrSessionsActions();
  const icrSummary = useIcrAnalytics();

  const isIcrLoading = icrSessionsStatus === 'loading';
  const hasIcrSessions = icrSessions.length > 0;

  // Reverse sessions for display (newest first) - default to showing the last (most recent) session
  const sessionsReversed = useMemo(() => {
    return icrSessions.slice().reverse();
  }, [icrSessions]);

  // Set default to last session when sessions load
  useEffect(() => {
    if (sessionsReversed.length > 0 && selectedSessionIndex >= sessionsReversed.length) {
      setSelectedSessionIndex(0); // Most recent (first in reversed array)
    }
  }, [sessionsReversed.length, selectedSessionIndex]);

  const selectedSession = useMemo(() => {
    if (!hasIcrSessions || selectedSessionIndex >= sessionsReversed.length) return null;
    return sessionsReversed[selectedSessionIndex] || null;
  }, [selectedSessionIndex, sessionsReversed, hasIcrSessions]);

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

  const handleDeleteSession = useCallback(
    (timestamp: number) => {
      const confirmed = window.confirm('Delete this session? This cannot be undone.');
      if (!confirmed) {
        return;
      }
      void deleteIcrSession(timestamp)
        .then(() => {
          // Adjust selected index if needed
          if (selectedSessionIndex >= sessionsReversed.length - 1 && selectedSessionIndex > 0) {
            setSelectedSessionIndex(selectedSessionIndex - 1);
          }
        })
        .catch((error) => {
          console.error('[ICRStats] Failed to delete ICR session', error);
        });
    },
    [deleteIcrSession, selectedSessionIndex, sessionsReversed.length],
  );

  const handlePrevSession = useCallback(() => {
    if (selectedSessionIndex < sessionsReversed.length - 1) {
      setSelectedSessionIndex(selectedSessionIndex + 1);
    }
  }, [selectedSessionIndex, sessionsReversed.length]);

  const handleNextSession = useCallback(() => {
    if (selectedSessionIndex > 0) {
      setSelectedSessionIndex(selectedSessionIndex - 1);
    }
  }, [selectedSessionIndex]);

  // Generate chart data from session
  const chartData = useMemo(() => {
    if (!selectedSession) {
      return { bars: [], dotsCorrectCat: [], dotsWrongCat: [] };
    }

    const penaltyFactor = 1.0;
    const agg: Record<
      string,
      {
        samples: Array<{ reaction: number; correct: boolean }>;
        total: number;
        correct: number;
        avg: number;
        adjAvg: number;
        acc: number;
      }
    > = {};

    selectedSession.trials.forEach((trial) => {
      if (!trial.typed) return;
      const l = trial.target?.toUpperCase();
      if (!l) return;
      if (!agg[l]) agg[l] = { samples: [], total: 0, correct: 0, avg: 0, adjAvg: 0, acc: 0 };
      if (trial.reactionMs && trial.reactionMs > 0) {
        agg[l].samples.push({ reaction: trial.reactionMs, correct: !!trial.correct });
      }
      agg[l].total += 1;
      if (trial.correct) agg[l].correct += 1;
    });

    const letters = Object.keys(agg).sort(
      (a, b) => KOCH_SEQUENCE.indexOf(a) - KOCH_SEQUENCE.indexOf(b),
    );

    letters.forEach((l) => {
      const stat = agg[l];
      if (!stat) return;
      const s = stat.samples.map((s) => s.reaction);
      const base = s.length ? s.reduce((a, b) => a + b, 0) / s.length : 0;
      const acc = stat.total > 0 ? stat.correct / stat.total : 0;
      const adjusted = base * (1 + penaltyFactor * (1 - acc));
      stat.avg = base;
      stat.acc = acc;
      stat.adjAvg = adjusted;
    });

    const bars: LetterBarPoint[] = letters.map((l, i) => {
      const stat = agg[l];
      if (!stat) return { letter: l, index: i, adjAvg: 0, avg: 0, acc: 0, total: 0 };
      return {
        letter: l,
        index: i,
        adjAvg: Math.round(stat.adjAvg),
        avg: Math.round(stat.avg),
        acc: stat.acc,
        total: stat.total,
      };
    });

    const dotsCorrectCat: ReactionScatterPoint[] = [];
    const dotsWrongCat: ReactionScatterPoint[] = [];
    letters.forEach((l) => {
      const stat = agg[l];
      if (!stat) return;
      const samples = stat.samples;
      for (let j = 0; j < samples.length; j++) {
        const sample = samples[j];
        if (!sample) continue;
        const targetArr = sample.correct ? dotsCorrectCat : dotsWrongCat;
        targetArr.push({ letter: l, reaction: sample.reaction });
      }
    });

    return { bars, dotsCorrectCat, dotsWrongCat };
  }, [selectedSession]);

  const getBarFill = (ms: number, greenMax: number, yellowMax: number): string => {
    if (ms === undefined || ms === null) return '#60a5fa';
    if (ms <= greenMax) return '#10b981';
    if (ms <= yellowMax) return '#f59e0b';
    return '#ef4444';
  };

  const formatLetterTooltipLabel = (label: string | number, payload: unknown): string => {
    if (Array.isArray(payload) && payload[0]?.payload) {
      const entry = payload[0].payload as LetterBarPoint;
      if (entry?.letter) {
        const accPct = Math.round((entry.acc ?? 0) * 100);
        return `${entry.letter} • acc ${accPct}%`;
      }
    }
    return typeof label === 'string' ? label : String(label);
  };

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
        </div>

        {/* Overview KPIs */}
        {hasIcrSessions && (
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

        {/* Session Carousel */}
        {hasIcrSessions && selectedSession && (
          <div className="space-y-4">
            {/* Navigation Header */}
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center gap-3">
                <button
                  onClick={handlePrevSession}
                  disabled={selectedSessionIndex >= sessionsReversed.length - 1}
                  className="px-4 py-2 rounded-lg bg-white border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <span>←</span> Previous
                </button>
                <div className="text-sm text-slate-600 font-medium">
                  Session {sessionsReversed.length - selectedSessionIndex} of {sessionsReversed.length}
                  <span className="text-xs text-slate-500 ml-2">
                    ({new Date(selectedSession.timestamp).toLocaleString()})
                  </span>
                </div>
                <button
                  onClick={handleNextSession}
                  disabled={selectedSessionIndex === 0}
                  className="px-4 py-2 rounded-lg bg-white border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  Next <span>→</span>
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDeleteSession(selectedSession.timestamp)}
                  className="px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 hover:bg-red-100"
                  title="Delete this session"
                >
                  🗑️ Delete
                </button>
                <button
                  onClick={handleClearIcrSessions}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
                  disabled={icrSessionsSaving}
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Session Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border border-slate-200 bg-white">
                <div className="text-xs text-slate-500">Average Reaction</div>
                <div className="mt-1 text-lg font-semibold text-slate-800">
                  {selectedSession.averageReactionMs} ms
                </div>
              </div>
              <div className="p-4 rounded-xl border border-slate-200 bg-white">
                <div className="text-xs text-slate-500">Accuracy</div>
                <div className="mt-1 text-lg font-semibold text-slate-800">
                  {selectedSession.accuracyPercent}%
                </div>
                <div className="mt-1 text-xs text-slate-600">
                  {selectedSession.trials.filter((t) => t.correct).length} correct /{' '}
                  {selectedSession.trials.length} total
                </div>
              </div>
              <div className="p-4 rounded-xl border border-slate-200 bg-white">
                <div className="text-xs text-slate-500">Trials</div>
                <div className="mt-1 text-lg font-semibold text-slate-800">
                  {selectedSession.trials.length}
                </div>
              </div>
            </div>

            {/* Charts */}
            {chartData.bars.length > 0 && (
              <>
                {/* Bar Chart */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white">
                  <h3 className="text-lg font-semibold text-slate-800 mb-4">
                    Per-Letter Performance
                  </h3>
                  <div className="h-96 w-full">
                    <ResponsiveContainer>
                      <ComposedChart
                        data={chartData.bars}
                        margin={{ top: 10, right: 20, bottom: 10, left: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="letter"
                          xAxisId={0}
                          type="category"
                          allowDuplicatedCategory={false}
                        />
                        <YAxis
                          yAxisId={0}
                          label={{ value: 'ms', angle: -90, position: 'insideLeft' }}
                        />
                        <Tooltip labelFormatter={formatLetterTooltipLabel} />
                        <Legend />
                        <Bar
                          yAxisId={0}
                          xAxisId={0}
                          dataKey="adjAvg"
                          name="Weighted Avg (ms)"
                        >
                          {chartData.bars.map((entry, idx) => {
                            const greenMax =
                              selectedSession.settingsSnapshot.icr.bucketGreenMaxMs ?? 300;
                            const yellowMax =
                              selectedSession.settingsSnapshot.icr.bucketYellowMaxMs ?? 800;
                            return (
                              <Cell
                                key={`cell-${idx}`}
                                fill={getBarFill(entry.adjAvg, greenMax, yellowMax)}
                              />
                            );
                          })}
                        </Bar>
                        <Line
                          yAxisId={0}
                          xAxisId={0}
                          dataKey="avg"
                          name="Unweighted Avg (ms)"
                          stroke="#3b82f6"
                          strokeWidth={2}
                          dot={{ r: 2, fill: '#3b82f6' }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Scatter Chart */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white">
                  <h3 className="text-lg font-semibold text-slate-800 mb-4">
                    Reaction Times by Letter
                  </h3>
                  <div className="h-72 w-full">
                    <ResponsiveContainer>
                      <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="letter" type="category" allowDuplicatedCategory={false} />
                        <YAxis
                          dataKey="reaction"
                          type="number"
                          name="Reaction (ms)"
                          label={{ value: 'ms', angle: -90, position: 'insideLeft' }}
                        />
                        <Tooltip />
                        <Legend />
                        <Scatter
                          name="Correct"
                          data={chartData.dotsCorrectCat}
                          fill="#3b82f6"
                        />
                        <Scatter name="Wrong" data={chartData.dotsWrongCat} fill="#ef4444" />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            )}

            {/* All Trials Table */}
            <div className="p-4 rounded-xl border border-slate-200 bg-white">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">
                All Trials ({selectedSession.trials.length})
              </h3>
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2 px-3 text-slate-700">#</th>
                      <th className="text-left py-2 px-3 text-slate-700">Target</th>
                      <th className="text-left py-2 px-3 text-slate-700">Typed</th>
                      <th className="text-right py-2 px-3 text-slate-700">Reaction (ms)</th>
                      <th className="text-center py-2 px-3 text-slate-700">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedSession.trials.map((trial, index) => (
                      <tr
                        key={index}
                        className={`border-b border-slate-100 ${
                          trial.correct ? 'bg-emerald-50/30' : 'bg-red-50/30'
                        }`}
                      >
                        <td className="py-2 px-3 text-slate-600">{index + 1}</td>
                        <td className="py-2 px-3 font-mono font-semibold text-slate-800">
                          {trial.target}
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-700">
                          {trial.typed || '—'}
                        </td>
                        <td className="py-2 px-3 text-right text-slate-600">
                          {trial.reactionMs ? `${trial.reactionMs} ms` : '—'}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {trial.correct === true ? (
                            <span className="text-emerald-600 font-semibold">✓</span>
                          ) : trial.correct === false ? (
                            <span className="text-red-600 font-semibold">✗</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
