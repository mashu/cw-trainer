'use client';

import React, { useCallback, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Line,
  BarChart,
  Bar,
  Brush,
  ReferenceLine,
  ComposedChart,
  Scatter,
} from 'recharts';

import { ActivityHeatmap } from '@/components/ui/charts/ActivityHeatmap';
import { useIcrAnalytics } from '@/hooks/useIcrAnalytics';
import { useIcrSessionsActions, useIcrSessionsState } from '@/hooks/useIcrSessions';
import { useSessionsActions, useSessionsState } from '@/hooks/useSessions';
import {
  useStatsAnalytics,
  type AccuracyChartPoint,
  type LetterStatsPoint,
} from '@/hooks/useStatsAnalytics';
import { createGroupDisplayAlignment } from '@/lib/groupAlignment';
import { KOCH_SEQUENCE } from '@/lib/morseConstants';

import { Leaderboard } from './Leaderboard';

type BrushRange = {
  readonly startIndex?: number;
  readonly endIndex?: number;
};

const isBrushRange = (value: unknown): value is BrushRange => {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return 'startIndex' in candidate || 'endIndex' in candidate;
};

const extractChartPoint = (event: unknown): AccuracyChartPoint | null => {
  if (event === null || typeof event !== 'object') {
    return null;
  }
  const activePayload = (event as { activePayload?: Array<{ payload?: AccuracyChartPoint }> })
    .activePayload;
  const payload = activePayload?.[0]?.payload;
  return payload ?? null;
};

interface StatsViewProps {
  onBack: () => void;
  thresholdPercent?: number; // reference line threshold (0..100)
  embedded?: boolean; // when true, render compact UI without page chrome
}

export function StatsView({
  onBack,
  thresholdPercent,
  embedded,
}: StatsViewProps): JSX.Element {
  const [selectedSessionTs, setSelectedSessionTs] = useState<number | null>(null);
  const [range, setRange] = useState<{ startIndex: number; endIndex: number } | null>(null);
  const [tab, setTab] = useState<
    'overview' | 'leaderboard' | 'sessions' | 'letters' | 'icr' | 'heatmap' | 'details'
  >('overview');
  const [threshold, setThreshold] = useState<number>(
    Math.max(0, Math.min(100, thresholdPercent ?? 90)),
  );

  const {
    sessions,
    sessionsStatus,
    sessionsError,
    sessionsSyncing,
  } = useSessionsState();
  const { removeSessionByTimestamp } = useSessionsActions();
  const {
    icrSessions,
    icrSessionsStatus,
    icrSessionsError,
    icrSessionsSaving,
  } = useIcrSessionsState();
  const { clearIcrSessions } = useIcrSessionsActions();
  const icrSummary = useIcrAnalytics();

  const sessionResults = sessions;
  const isLoading = sessionsStatus === 'loading';
  const isIcrLoading = icrSessionsStatus === 'loading';
  const hasTrainingSessions = sessionResults.length > 0;
  const hasIcrSessions = icrSessions.length > 0;

  const {
    sessionsSorted,
    chartData,
    activitySessions,
    timingDailyAgg,
    dayIndexToLabel,
    timingSamplesPoints,
  } = useStatsAnalytics(sessionResults);

  const handleDelete = useCallback(
    async (timestamp: number): Promise<void> => {
      try {
        await removeSessionByTimestamp(timestamp);
        setSelectedSessionTs((current) => (current === timestamp ? null : current));
      } catch (error) {
        console.error('[StatsView] Failed to delete session', error);
      }
    },
    [removeSessionByTimestamp],
  );

  const handleClearIcrSessions = useCallback((): void => {
    if (!icrSessions.length) {
      return;
    }

    const confirmed = window.confirm('Clear all ICR session history? This cannot be undone.');
    if (!confirmed) {
      return;
    }

    void clearIcrSessions().catch((error) => {
      console.error('[StatsView] Failed to clear ICR sessions', error);
    });
  }, [clearIcrSessions, icrSessions.length]);

  const aggregateLetterStats = useCallback((sessionsToAggregate: typeof sessionsSorted): LetterStatsPoint[] => {
    const letterStats: Record<string, { correct: number; total: number }> = {};
    sessionsToAggregate.forEach((result) => {
      Object.entries(result.letterAccuracy).forEach(([letter, stats]) => {
        if (!letterStats[letter]) letterStats[letter] = { correct: 0, total: 0 };
        letterStats[letter].correct += stats.correct;
        letterStats[letter].total += stats.total;
      });
    });
    return Object.keys(letterStats)
      .map((letter) => ({
        letter,
        accuracy: letterStats[letter].total
          ? (letterStats[letter].correct / letterStats[letter].total) * 100
          : 0,
        total: letterStats[letter].total,
        correct: letterStats[letter].correct,
      }))
      .sort((a, b) => b.accuracy - a.accuracy);
  }, []);

  const rangeFilteredSessions = useMemo<typeof sessionsSorted>(() => {
    if (!range) return sessionsSorted;
    const start = Math.max(0, range.startIndex || 0);
    const end = Math.min(chartData.length - 1, range.endIndex || chartData.length - 1);
    return sessionsSorted.slice(start, end + 1);
  }, [range, sessionsSorted, chartData.length]);

  const rangeLetterStats = useMemo<LetterStatsPoint[]>(
    () => aggregateLetterStats(rangeFilteredSessions),
    [aggregateLetterStats, rangeFilteredSessions],
  );

  const selectedSession = useMemo<typeof sessionsSorted[number] | null>(
    () => sessionsSorted.find((s) => s.timestamp === selectedSessionTs) || null,
    [sessionsSorted, selectedSessionTs],
  );
  const selectedSessionLetterStats = useMemo<LetterStatsPoint[]>(
    () => (selectedSession ? aggregateLetterStats([selectedSession]) : []),
    [aggregateLetterStats, selectedSession],
  );
  const selectedSessionDetails = useMemo<
    Array<{
      readonly idx: number;
      readonly sent: string;
      readonly received: string;
      readonly correct: boolean;
      readonly timeMs: number;
      readonly alignment: Array<{ ch: string; ok: boolean }>;
    }>
  >(() => {
    if (!selectedSession) {
      return [];
    }
    const timings = selectedSession.groupTimings || [];
    const rows = (selectedSession.groups || []).map((g, idx) => {
      const timeMs = Math.max(0, Math.round(timings[idx]?.timeToCompleteMs || 0));
      // Use group alignment for accurate visualization of letter matches
      const alignment = createGroupDisplayAlignment(g.sent, g.received);
      return { idx, sent: g.sent, received: g.received, correct: g.correct, timeMs, alignment };
    });
    return rows;
  }, [selectedSession]);

  const bigramHeatmap = useMemo<{
    readonly letters: string[];
    readonly matrix: Array<Array<{ row: string; col: string; rate: number; total: number }>>;
  }>(() => {
    const lettersSet = new Set<string>();
    const counts: Record<string, Record<string, { wrong: number; total: number }>> = {};
    rangeFilteredSessions.forEach((s) => {
      (s.groups || []).forEach((g) => {
        const sent = (g?.sent || '').toUpperCase();
        const rec = (g?.received || '').toUpperCase();
        for (let i = 1; i < sent.length; i++) {
          const prev = sent[i - 1];
          const curr = sent[i];
          if (!prev || !curr) continue;
          lettersSet.add(prev);
          lettersSet.add(curr);
          if (!counts[prev]) counts[prev] = {};
          if (!counts[prev][curr]) counts[prev][curr] = { wrong: 0, total: 0 };
          counts[prev][curr].total += 1;
          const typed = rec[i];
          if (typed !== curr) counts[prev][curr].wrong += 1;
        }
      });
    });
    const letters = Array.from(lettersSet);
    letters.sort((a, b) => KOCH_SEQUENCE.indexOf(a) - KOCH_SEQUENCE.indexOf(b));
    const matrix = letters.map((row) =>
      letters.map((col) => {
        const c = counts[row]?.[col];
        const total = c?.total || 0;
        const wrong = c?.wrong || 0;
        const rate = total > 0 ? wrong / total : 0;
        return { row, col, rate, total };
      }),
    );
    return { letters, matrix };
  }, [rangeFilteredSessions]);

  // KPIs derived from range
  const { kpiAvgAccuracy, kpiSessions, kpiAvgMs, kpiUniqueDays, bestLetter, worstLetter } =
    useMemo<{
      readonly kpiAvgAccuracy: number;
      readonly kpiSessions: number;
      readonly kpiAvgMs: number;
      readonly kpiUniqueDays: number;
      readonly bestLetter: LetterStatsPoint | null;
      readonly worstLetter: LetterStatsPoint | null;
    }>(() => {
      const totalSessions = rangeFilteredSessions.length;
      const avgAcc = totalSessions
        ? rangeFilteredSessions.reduce((a, s) => a + s.accuracy * 100, 0) / totalSessions
        : 0;
      let sumMs = 0;
      let nMs = 0;
      rangeFilteredSessions.forEach((s) => {
        (s.groupTimings || []).forEach((t) => {
          const v = typeof t?.timeToCompleteMs === 'number' ? t.timeToCompleteMs : 0;
          if (v > 0 && isFinite(v)) {
            sumMs += v;
            nMs += 1;
          }
        });
      });
      const avgMs = nMs ? sumMs / nMs : 0;
      const days = new Set(rangeFilteredSessions.map((s) => s.date)).size;
      const best = rangeLetterStats.length > 0 ? rangeLetterStats[0] : null;
      const worst = rangeLetterStats.length > 0
        ? rangeLetterStats[rangeLetterStats.length - 1]
        : null;
      return {
        kpiAvgAccuracy: avgAcc,
        kpiSessions: totalSessions,
        kpiAvgMs: avgMs,
        kpiUniqueDays: days,
        bestLetter: best,
        worstLetter: worst,
      };
    }, [rangeFilteredSessions, rangeLetterStats]);

  // Date range presets
  const applyRangePreset = (days: number | 'all'): void => {
    if (sessionsSorted.length === 0) {
      setRange(null);
      return;
    }
    if (days === 'all') {
      setRange(null);
      return;
    }
    const now = Date.now();
    const earliest = now - days * 24 * 60 * 60 * 1000;
    const firstIdx = sessionsSorted.findIndex((s) => s.timestamp >= earliest);
    if (firstIdx < 0) {
      setRange(null);
      return;
    }
    setRange({ startIndex: firstIdx, endIndex: chartData.length - 1 });
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
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">Training Statistics</h2>
            {!embedded && (
              <div className="flex items-center gap-2">
                <button
                  onClick={onBack}
                  className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm sm:text-base hover:bg-blue-700"
                >
                  Back to Training
                </button>
              </div>
            )}
          </div>

          {(isLoading || isIcrLoading) && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              Loading sessions…
            </div>
          )}

          {sessionsError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {sessionsError}
            </div>
          )}

          {icrSessionsError && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              {icrSessionsError}
            </div>
          )}

          {!isLoading && !hasTrainingSessions && (
            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-800">No sessions yet</h3>
              <p className="mt-2 text-sm text-slate-600">
                Start a training run to populate charts and accuracy insights. Your sessions are
                saved locally, so feel free to experiment and come back later.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onBack}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700"
                >
                  Go to Trainer
                </button>
                <span className="text-xs text-slate-500 self-center">
                  Tip: sessions sync automatically after each run.
                </span>
              </div>
            </div>
          )}

          {/* Tabs + Controls */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 text-sm">
              {(
                ['overview', 'leaderboard', 'sessions', 'letters', 'icr', 'heatmap', 'details'] as const
              ).map((t) => (
                <button
                  key={t}
                  className={`px-3 py-1.5 rounded-lg capitalize transition-colors ${tab === t ? 'bg-white shadow-sm text-slate-900' : 'text-slate-600 hover:text-slate-800'}`}
                  onClick={() => setTab(t)}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden">
                {(
                  [
                    { label: 'All', v: 'all' },
                    { label: '7d', v: 7 },
                    { label: '30d', v: 30 },
                    { label: '90d', v: 90 },
                  ] as const
                ).map((opt) => (
                  <button
                    key={String(opt.v)}
                    onClick={() => applyRangePreset(opt.v)}
                    className="px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
                    disabled={isLoading || sessionResults.length === 0}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <span>Threshold</span>
                <input
                  type="range"
                  min={50}
                  max={100}
                  step={1}
                  value={threshold}
                  onChange={(e) => setThreshold(parseInt(e.target.value || '90', 10))}
                />
                <span className="w-10 text-right font-medium text-slate-700">{threshold}%</span>
              </div>
              {range && (
                <button
                  onClick={() => setRange(null)}
                  className="px-2.5 py-1.5 text-xs rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200"
                >
                  Clear Range
                </button>
              )}
            </div>
          </div>
        </div>

        {/* KPIs */}
        {tab === 'overview' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
            <div className="p-4 rounded-xl border border-slate-200 bg-gradient-to-br from-emerald-50 to-white">
              <div className="text-xs text-slate-500">Avg Accuracy</div>
              <div className="mt-1 text-2xl font-semibold text-slate-800">{kpiAvgAccuracy.toFixed(1)}%</div>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 bg-gradient-to-br from-blue-50 to-white">
              <div className="text-xs text-slate-500">Sessions</div>
              <div className="mt-1 text-2xl font-semibold text-slate-800">{kpiSessions}</div>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 bg-gradient-to-br from-amber-50 to-white">
              <div className="text-xs text-slate-500">Avg Response</div>
              <div className="mt-1 text-2xl font-semibold text-slate-800">{kpiAvgMs ? Math.round(kpiAvgMs) : '—'}<span className="text-base text-slate-500 ml-1">ms</span></div>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 bg-gradient-to-br from-violet-50 to-white">
              <div className="text-xs text-slate-500">Active Days</div>
              <div className="mt-1 text-2xl font-semibold text-slate-800">{kpiUniqueDays}</div>
            </div>
            {icrSummary.totalSessions > 0 && (
              <div className="p-4 rounded-xl border border-slate-200 bg-gradient-to-br from-emerald-100/50 to-white">
                <div className="text-xs text-slate-500">ICR Avg Reaction</div>
                <div className="mt-1 text-2xl font-semibold text-slate-800">
                  {icrSummary.averageReactionMs}
                  <span className="text-base text-slate-500 ml-1">ms</span>
                </div>
                <div className="mt-1 text-xs text-slate-600">
                  Accuracy {icrSummary.averageAccuracyPercent}% • {icrSummary.totalTrials} trials
                </div>
              </div>
            )}
          </div>
        )}

        {/* Content Panels */}
        {tab === 'overview' && (
          <div className="space-y-6">
            <ActivityHeatmap sessions={activitySessions} />

            {/* Response Time at full width, above Accuracy */}
            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700">Response Time (ms) by Day</h3>
              </div>
              <div className="w-full h-[320px] sm:h-[380px] md:h-[420px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={timingDailyAgg}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      dataKey="dayIndex"
                      ticks={timingDailyAgg.map((d) => d.dayIndex)}
                      domain={[
                        Math.min(0, (timingDailyAgg[0]?.dayIndex ?? 0) - 0.5),
                        (timingDailyAgg[timingDailyAgg.length - 1]?.dayIndex ?? 0) + 0.5,
                      ]}
                      tickFormatter={(v: number) => dayIndexToLabel[v] || ''}
                    />
                    <YAxis yAxisId="ms" />
                    <Tooltip
                      labelFormatter={(label: string | number) => {
                        const numericLabel = typeof label === 'number' ? label : Number(label);
                        return dayIndexToLabel[Math.round(numericLabel)] || '';
                      }}
                      formatter={(value: number | string, name: string): [string, string] => {
                        const numericValue = typeof value === 'number' ? value : Number(value);
                        const formatted = Number.isFinite(numericValue)
                          ? Math.round(numericValue)
                          : 0;
                        return [`${formatted} ms`, name];
                      }}
                    />
                    <Legend />
                    <Line
                      yAxisId="ms"
                      type="monotone"
                      dataKey="averageMs"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      name="Avg ms"
                    />
                    <Scatter
                      yAxisId="ms"
                      data={timingSamplesPoints}
                      dataKey="ms"
                      name="Sample ms"
                      fill="#fb923c"
                      fillOpacity={0.55}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Accuracy Over Time full width, below Response Time */}
            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700">Accuracy Over Time</h3>
              </div>
              <div className="w-full h-[260px] sm:h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    onClick={(event) => {
                      const payload = extractChartPoint(event);
                      if (payload?.timestamp) {
                        setSelectedSessionTs(payload.timestamp);
                      }
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="x" />
                    <YAxis domain={[0, 100]} />
                    <ReferenceLine
                      y={Math.max(0, Math.min(100, threshold))}
                      stroke="#ef4444"
                      strokeDasharray="4 4"
                    />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="accuracy"
                      stroke="#2563eb"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      name="Session"
                    />
                    <Brush
                      dataKey="x"
                      travellerWidth={8}
                      height={24}
                      onChange={(value) => {
                        if (!value || !isBrushRange(value)) {
                          return;
                        }
                        const { startIndex, endIndex } = value;
                        if (typeof startIndex === 'number' && typeof endIndex === 'number') {
                          setRange({ startIndex, endIndex });
                        }
                      }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {tab === 'leaderboard' && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-slate-700">Leaderboard</h3>
            <Leaderboard limitCount={20} />
          </div>
        )}

        {tab === 'sessions' && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-slate-700">Sessions</h3>
            <div className="max-h-[560px] overflow-auto pr-1 grid grid-cols-1 gap-2">
              {sessionResults.length === 0 && (
                <p className="text-sm text-slate-500">No sessions yet.</p>
              )}
              {sessionsSorted
                .slice()
                .sort((a, b) => b.timestamp - a.timestamp)
                .map((s) => (
                  <div
                    key={s.timestamp}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${selectedSessionTs === s.timestamp ? 'border-blue-300 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}
                  >
                    <div
                      onClick={() => {
                        setSelectedSessionTs(s.timestamp);
                        setTab('details');
                      }}
                      className="cursor-pointer"
                    >
                      <p className="text-sm font-medium text-slate-800">
                        {new Date(s.timestamp).toLocaleString()}
                      </p>
                      <p className="text-xs text-slate-500">
                        Accuracy: {(s.accuracy * 100).toFixed(1)}%
                        {Array.isArray(s.groupTimings) && s.groupTimings.length
                          ? ` • Avg time: ${Math.round(s.groupTimings.filter((t) => (t?.timeToCompleteMs || 0) > 0).reduce((a, b) => a + (b.timeToCompleteMs || 0), 0) / Math.max(1, s.groupTimings.filter((t) => (t?.timeToCompleteMs || 0) > 0).length))} ms`
                          : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        void handleDelete(s.timestamp);
                      }}
                      className="px-2 py-1 text-xs rounded-md bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-60 disabled:cursor-not-allowed"
                      disabled={sessionsSyncing}
                    >
                      Delete
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}

        {tab === 'letters' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-slate-700">
                  Letter Accuracy {range ? '(Selected Range)' : '(All Sessions)'}
                </h3>
              </div>
              <div className="w-full h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rangeLetterStats}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="letter" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Bar dataKey="accuracy" fill="#8b5cf6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
                <div className="p-2 rounded-lg bg-violet-50">
                  <div>Best letter</div>
                  <div className="font-semibold text-slate-800">
                    {bestLetter ? `${bestLetter.letter} — ${bestLetter.accuracy.toFixed(1)}%` : '—'}
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-rose-50">
                  <div>Needs work</div>
                  <div className="font-semibold text-slate-800">
                    {worstLetter
                      ? `${worstLetter.letter} — ${worstLetter.accuracy.toFixed(1)}%`
                      : '—'}
                  </div>
                </div>
              </div>
              {icrSummary.totalSessions > 0 && (
                <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-600">
                  <div className="p-2 rounded-lg border border-emerald-100 bg-emerald-50/60">
                    <div className="font-medium text-emerald-700">ICR Highlights</div>
                    <p className="mt-1 text-slate-700">
                      Avg reaction {icrSummary.averageReactionMs} ms • Accuracy {icrSummary.averageAccuracyPercent}%
                    </p>
                    <div className="mt-1 flex flex-wrap gap-3">
                      {icrSummary.bestLetter && (
                        <span>
                          Best letter {icrSummary.bestLetter.letter} ·
                          {` ${icrSummary.bestLetter.accuracyPercent.toFixed(1)}%`}
                        </span>
                      )}
                      {icrSummary.needsWorkLetter && (
                        <span>
                          Needs work {icrSummary.needsWorkLetter.letter} ·
                          {` ${icrSummary.needsWorkLetter.accuracyPercent.toFixed(1)}%`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-slate-700">
                  Per-Session Letter Accuracy
                </h3>
                {selectedSessionTs && (
                  <button
                    onClick={() => setSelectedSessionTs(null)}
                    className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700"
                  >
                    Clear Selection
                  </button>
                )}
              </div>
              {selectedSession ? (
                <div className="w-full h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={selectedSessionLetterStats}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="letter" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Bar dataKey="accuracy" fill="#10b981" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  Click a point on the chart or a session to view per-character stats.
                </p>
              )}
            </div>
          </div>
        )}

        {tab === 'icr' && (
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

        {tab === 'details' && (
          <div className="space-y-2">
            {!selectedSession && (
              <p className="text-sm text-slate-500">
                Select a session from the Sessions tab or the chart to view details.
              </p>
            )}
            {selectedSession && (
              <>
                <h3 className="text-lg font-semibold text-slate-700 mb-1">
                  Session Details — {new Date(selectedSession.timestamp).toLocaleString()}
                </h3>
                {selectedSessionDetails.map((row) => (
                  <div
                    key={row.idx}
                    className={`p-3 rounded-lg border ${row.correct ? 'border-emerald-200 bg-emerald-50/40' : 'border-rose-200 bg-rose-50/40'}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-mono">
                        <span className="text-slate-500">Group {row.idx + 1}:</span> {row.sent}
                      </div>
                      <div className="text-xs text-slate-600">
                        {row.timeMs ? `${row.timeMs} ms` : '—'}
                      </div>
                    </div>
                    <div className="mt-1 font-mono text-sm">
                      {row.alignment.map((a, i) => (
                        <span key={i} className={a.ok ? 'text-emerald-700' : 'text-rose-700'}>
                          {a.ch || '·'}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {tab === 'heatmap' && (
          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">
              Error Heatmap by Previous and Current Letter{' '}
              {range ? '(Selected Range)' : '(All Sessions)'}
            </h3>
            {bigramHeatmap.letters.length === 0 ? (
              <p className="text-sm text-slate-500">No data yet.</p>
            ) : (
              <div className="overflow-auto border rounded-xl">
                <table className="min-w-max text-xs">
                  <thead>
                    <tr>
                      <th className="p-2 text-left sticky left-0 bg-white">Prev \\ Curr</th>
                      {bigramHeatmap.letters.map((l) => (
                        <th key={l} className="p-2 text-center">
                          {l}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bigramHeatmap.letters.map((rowL, rIdx) => (
                      <tr key={rowL}>
                        <td className="p-2 font-semibold sticky left-0 bg-white">{rowL}</td>
                        {bigramHeatmap.matrix[rIdx].map((cell) => {
                          const color =
                            cell.total === 0
                              ? '#f1f5f9'
                              : `rgba(239,68,68,${Math.min(1, cell.rate)})`;
                          const title = `${rowL}→${cell.col}: ${(cell.rate * 100).toFixed(1)}% errors (${cell.total} samples)`;
                          return (
                            <td key={rowL + '_' + cell.col} className="p-0">
                              <div
                                title={title}
                                style={{ backgroundColor: color, width: 24, height: 24 }}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
