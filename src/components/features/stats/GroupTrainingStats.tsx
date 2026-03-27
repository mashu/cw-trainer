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
  ComposedChart,
  Scatter,
} from 'recharts';

import { ActivityHeatmap } from '@/components/ui/charts/ActivityHeatmap';
import { useHasMounted } from '@/hooks/useHasMounted';
import { useSessionsActions, useSessionsState } from '@/hooks/useSessions';
import {
  useStatsAnalytics,
  type AccuracyChartPoint,
  type LetterStatsPoint,
  type LetterTimingStats,
  type SessionFatiguePoint,
} from '@/hooks/useStatsAnalytics';
import { createGroupDisplayAlignment } from '@/lib/groupAlignment';
import { LCWO_SEQUENCE } from '@/lib/morseConstants';

import { BigramHeatmapView, START_TOKEN } from './BigramHeatmap';
import { Leaderboard } from './Leaderboard';

/** Token representing "start of group" in the bigram matrix.
 *  Lets us capture first-character errors as  ▸ → char  instead of dropping them. */

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

interface GroupTrainingStatsProps {
  onBack: () => void;
  embedded?: boolean; // when true, render compact UI without page chrome
}

export function GroupTrainingStats({
  onBack,
  embedded,
}: GroupTrainingStatsProps): JSX.Element {
  const [selectedSessionTs, setSelectedSessionTs] = useState<number | null>(null);
  const [range, setRange] = useState<{ startIndex: number; endIndex: number } | null>(null);
  const [tab, setTab] = useState<'overview' | 'progress' | 'letters' | 'mistakes' | 'sessions' | 'leaderboard'>('overview');

  const {
    sessions,
    sessionsStatus,
    sessionsError,
    sessionsSyncing,
  } = useSessionsState();
  const { removeSessionByTimestamp, replaceSessions } = useSessionsActions();

  const sessionResults = sessions;
  const isLoading = sessionsStatus === 'loading';
  const hasTrainingSessions = sessionResults.length > 0;
  const hasMounted = useHasMounted();
  const formatSessionDate = useCallback(
    (ts: number) => (hasMounted ? new Date(ts).toLocaleString() : new Date(ts).toISOString()),
    [hasMounted],
  );

  const {
    sessionsSorted,
    chartData,
    activitySessions,
    timingDailyAgg,
    timingSamplesPoints,
    letterTimingStats,
    letterPerformance,
    confusionMatrix,
    letterTrends,
    sessionFatigue,
  } = useStatsAnalytics(sessionResults, formatSessionDate);

  const handleDelete = useCallback(
    async (timestamp: number): Promise<void> => {
      try {
        await removeSessionByTimestamp(timestamp);
        setSelectedSessionTs((current) => (current === timestamp ? null : current));
      } catch (error) {
        console.error('[GroupTrainingStats] Failed to delete session', error);
      }
    },
    [removeSessionByTimestamp],
  );

  const handleClearAllSessions = useCallback(async (): Promise<void> => {
    const count = sessionResults.length;
    if (count === 0) return;
    const confirmed = window.confirm(
      `Clear all ${count} session${count === 1 ? '' : 's'}? This cannot be undone.`,
    );
    if (!confirmed) return;
    try {
      await replaceSessions([]);
      setSelectedSessionTs(null);
    } catch (error) {
      console.error('[GroupTrainingStats] Failed to clear sessions', error);
    }
  }, [sessionResults.length, replaceSessions]);

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
      .map((letter) => {
        const stat = letterStats[letter];
        if (!stat || stat.total === 0) {
          return { letter, accuracy: 0, total: 0, correct: 0 };
        }
        return {
          letter,
          accuracy: (stat.correct / stat.total) * 100,
          total: stat.total,
          correct: stat.correct,
        };
      })
      .sort((a, b) => b.accuracy - a.accuracy);
  }, []);

  const rangeFilteredSessions = useMemo<typeof sessionsSorted>(() => {
    if (!range) return sessionsSorted;
    const start = Math.max(0, range.startIndex || 0);
    const end = Math.min(sessionsSorted.length - 1, range.endIndex || sessionsSorted.length - 1);
    return sessionsSorted.slice(start, end + 1);
  }, [range, sessionsSorted]);

  // Get date range from filtered sessions for synchronizing timing charts
  const rangeFilteredDates = useMemo(() => {
    const dates = new Set(rangeFilteredSessions.map((s) => s.date));
    return dates;
  }, [rangeFilteredSessions]);

  // Filter timing daily aggregates by the selected range
  const rangeFilteredTimingDailyAgg = useMemo(() => {
    if (!range) return timingDailyAgg;
    return timingDailyAgg.filter((d) => rangeFilteredDates.has(d.date));
  }, [range, timingDailyAgg, rangeFilteredDates]);

  // Filter timing sample points by the selected range
  const rangeFilteredTimingSamples = useMemo(() => {
    if (!range) return timingSamplesPoints;
    return timingSamplesPoints.filter((p) => rangeFilteredDates.has(p.date));
  }, [range, timingSamplesPoints, rangeFilteredDates]);

  // Create a mapping from date to dayIndex for filtered data (re-indexed from 0)
  const filteredDayIndexToLabel = useMemo(() => {
    const map: Record<number, string> = {};
    rangeFilteredTimingDailyAgg.forEach((entry, idx) => {
      map[idx] = entry.date;
    });
    return map;
  }, [rangeFilteredTimingDailyAgg]);

  // Re-index timing samples for the filtered range
  const reindexedTimingSamples = useMemo(() => {
    const dateToNewIndex: Record<string, number> = {};
    rangeFilteredTimingDailyAgg.forEach((entry, idx) => {
      dateToNewIndex[entry.date] = idx;
    });
    return rangeFilteredTimingSamples.map((p) => ({
      ...p,
      dayIndex: (dateToNewIndex[p.date] ?? 0) + (p.dayIndex - Math.floor(p.dayIndex)), // Keep jitter
    }));
  }, [rangeFilteredTimingDailyAgg, rangeFilteredTimingSamples]);

  // Re-index daily aggregates for the filtered range
  const reindexedTimingDailyAgg = useMemo(() => {
    return rangeFilteredTimingDailyAgg.map((entry, idx) => ({
      ...entry,
      dayIndex: idx,
    }));
  }, [rangeFilteredTimingDailyAgg]);

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
    readonly matrix: Array<Array<{ row: string; col: string; rate: number; total: number; wrong: number }>>;
    readonly maxRate: number;
  }>(() => {
    const lettersSet = new Set<string>();
    const counts: Record<string, Record<string, { wrong: number; total: number }>> = {};
    rangeFilteredSessions.forEach((s) => {
      (s.groups || []).forEach((g) => {
        const sent = (g?.sent || '').toUpperCase();
        const rec = (g?.received || '').toUpperCase();
        // Start from i = 0: use START_TOKEN as "prev" for the first character
        for (let i = 0; i < sent.length; i++) {
          const prev = i === 0 ? START_TOKEN : sent[i - 1];
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
    // Sort real characters by LCWO order; keep START_TOKEN first
    letters.sort((a, b) => {
      if (a === START_TOKEN) return -1;
      if (b === START_TOKEN) return 1;
      return LCWO_SEQUENCE.indexOf(a) - LCWO_SEQUENCE.indexOf(b);
    });
    let maxRate = 0;
    const matrix = letters.map((row) =>
      letters.map((col) => {
        const c = counts[row]?.[col];
        const total = c?.total || 0;
        const wrong = c?.wrong || 0;
        const rate = total > 0 ? wrong / total : 0;
        if (rate > maxRate) maxRate = rate;
        return { row, col, rate, total, wrong };
      }),
    );
    return { letters, matrix, maxRate };
  }, [rangeFilteredSessions]);

  // Per-character (unigram) error stats — shows error density per individual
  // character independent of the preceding character context.
  const unigramStats = useMemo<
    Array<{ letter: string; total: number; wrong: number; rate: number }>
  >(() => {
    const counts: Record<string, { wrong: number; total: number }> = {};
    rangeFilteredSessions.forEach((s) => {
      (s.groups || []).forEach((g) => {
        const sent = (g?.sent || '').toUpperCase();
        const rec = (g?.received || '').toUpperCase();
        for (let i = 0; i < sent.length; i++) {
          const ch = sent[i];
          if (!ch) continue;
          if (!counts[ch]) counts[ch] = { wrong: 0, total: 0 };
          counts[ch].total += 1;
          if (rec[i] !== ch) counts[ch].wrong += 1;
        }
      });
    });
    return Object.entries(counts)
      .map(([letter, c]) => ({
        letter,
        total: c.total,
        wrong: c.wrong,
        rate: c.total > 0 ? c.wrong / c.total : 0,
      }))
      .sort((a, b) => LCWO_SEQUENCE.indexOf(a.letter) - LCWO_SEQUENCE.indexOf(b.letter));
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
      const best: LetterStatsPoint | null = rangeLetterStats.length > 0 ? (rangeLetterStats[0] ?? null) : null;
      const worstIdx = rangeLetterStats.length > 0 ? rangeLetterStats.length - 1 : -1;
      const worst: LetterStatsPoint | null = worstIdx >= 0 ? (rangeLetterStats[worstIdx] ?? null) : null;
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
    // Use sessionsSorted.length since range indices are based on sessionsSorted
    setRange({ startIndex: firstIdx, endIndex: sessionsSorted.length - 1 });
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
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">Group Training Statistics</h2>
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

          {isLoading && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              Loading sessions…
            </div>
          )}

          {sessionsError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {sessionsError}
            </div>
          )}

          {!isLoading && !hasTrainingSessions && (
            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-800">No group training sessions yet</h3>
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
          {hasTrainingSessions && (
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 text-sm flex-wrap">
                {([
                  { id: 'overview', label: '📊 Overview' },
                  { id: 'progress', label: '📈 Progress' },
                  { id: 'letters', label: '🔤 Letters' },
                  { id: 'mistakes', label: '❌ Mistakes' },
                  { id: 'sessions', label: '📋 Sessions' },
                  { id: 'leaderboard', label: '🏆 Leaderboard' },
                ] as const).map((t) => (
                  <button
                    key={t.id}
                    className={`px-3 py-1.5 rounded-lg transition-colors ${
                      tab === t.id ? 'bg-white shadow-sm text-slate-900' : 'text-slate-600 hover:text-slate-800'
                    }`}
                    onClick={() => setTab(t.id)}
                  >
                    {t.label}
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
          )}
        </div>

        {/* KPIs - shown on overview and progress tabs */}
        {(tab === 'overview' || tab === 'progress') && hasTrainingSessions && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
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
          </div>
        )}

        {/* ==================== OVERVIEW TAB ==================== */}
        {tab === 'overview' && (
          <div className="space-y-6">
            {/* Activity Heatmap */}
            {hasTrainingSessions && (
              <ActivityHeatmap sessions={activitySessions} />
            )}

            {/* Practice Recommendations */}
            {hasTrainingSessions && (letterPerformance.length > 0 || confusionMatrix.length > 0) && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">📋 Practice Recommendations</h3>
                <div className="space-y-3">
                  {letterTimingStats.length > 0 && (
                    <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                      <div className="text-xs font-semibold text-amber-800 mb-1">⏱️ Slowest Response (focus on these)</div>
                      <div className="flex flex-wrap gap-2">
                        {letterTimingStats.slice(0, 5).map((lt) => (
                          <span key={lt.letter} className="px-2 py-1 bg-amber-100 rounded text-sm font-mono font-semibold text-amber-900">
                            {lt.letter} <span className="text-xs font-normal">({lt.avgMs}ms)</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {letterPerformance.filter((lp) => lp.status === 'needsWork').length > 0 && (
                    <div className="p-3 rounded-lg bg-rose-50 border border-rose-200">
                      <div className="text-xs font-semibold text-rose-800 mb-1">🎯 Needs More Practice</div>
                      <div className="flex flex-wrap gap-2">
                        {letterPerformance.filter((lp) => lp.status === 'needsWork').slice(0, 5).map((lp) => (
                          <span key={lp.letter} className="px-2 py-1 bg-rose-100 rounded text-sm font-mono font-semibold text-rose-900">
                            {lp.letter} <span className="text-xs font-normal">({lp.accuracy.toFixed(0)}%)</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {confusionMatrix.length > 0 && (
                    <div className="p-3 rounded-lg bg-violet-50 border border-violet-200">
                      <div className="text-xs font-semibold text-violet-800 mb-1">🔄 Common Confusions</div>
                      <div className="flex flex-wrap gap-2">
                        {confusionMatrix.slice(0, 5).map((c, i) => (
                          <span key={i} className="px-2 py-1 bg-violet-100 rounded text-sm font-mono text-violet-900">
                            {c.sent}→{c.typed} <span className="text-xs font-normal">({c.count}×)</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {letterPerformance.filter((lp) => lp.status === 'mastered').length > 0 && (
                    <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                      <div className="text-xs font-semibold text-emerald-800 mb-1">✨ Mastered ({letterPerformance.filter((lp) => lp.status === 'mastered').length} letters)</div>
                      <div className="flex flex-wrap gap-1">
                        {letterPerformance.filter((lp) => lp.status === 'mastered').map((lp) => (
                          <span key={lp.letter} className="px-1.5 py-0.5 bg-emerald-100 rounded text-xs font-mono font-semibold text-emerald-900">{lp.letter}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================== PROGRESS TAB ==================== */}
        {tab === 'progress' && (
          <div className="space-y-6">
            {/* Accuracy Over Time with Brush */}
            {hasTrainingSessions && (
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <div className="mb-2">
                  <h3 className="text-sm font-semibold text-slate-700">Accuracy Over Time</h3>
                  <p className="text-xs text-slate-500">Drag the slider below to filter date range</p>
                </div>
                <div className="w-full h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} onClick={(event) => { const payload = extractChartPoint(event); if (payload?.timestamp) setSelectedSessionTs(payload.timestamp); }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="x" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip content={({ active, payload }) => {
                        if (!active || !payload?.[0]) return null;
                        const data = payload[0].payload as AccuracyChartPoint;
                        return <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2"><div className="text-sm font-semibold">{data.accuracy.toFixed(1)}%</div><div className="text-xs text-slate-600">{data.x}</div></div>;
                      }} />
                      <Legend />
                      <Line type="monotone" dataKey="accuracy" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} name="Accuracy %" />
                      <Brush dataKey="x" travellerWidth={10} height={28} stroke="#3b82f6" fill="#eff6ff" {...(range ? { startIndex: range.startIndex, endIndex: range.endIndex } : {})} onChange={(v) => { if (v && isBrushRange(v) && typeof v.startIndex === 'number' && typeof v.endIndex === 'number') setRange({ startIndex: v.startIndex, endIndex: v.endIndex }); }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Response Time by Day */}
            {hasTrainingSessions && (
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <div className="mb-2">
                  <h3 className="text-sm font-semibold text-slate-700">Response Time by Day {range && <span className="text-xs font-normal text-slate-500">(filtered)</span>}</h3>
                </div>
                <div className="w-full h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={reindexedTimingDailyAgg}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" dataKey="dayIndex" ticks={reindexedTimingDailyAgg.map((d) => d.dayIndex)} domain={[Math.min(0, (reindexedTimingDailyAgg[0]?.dayIndex ?? 0) - 0.5), (reindexedTimingDailyAgg[reindexedTimingDailyAgg.length - 1]?.dayIndex ?? 0) + 0.5]} tickFormatter={(v: number) => filteredDayIndexToLabel[v] || ''} />
                      <YAxis yAxisId="ms" />
                      <Tooltip content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        type TD = { letter?: string; ms?: number; date?: string; averageMs?: number };
                        const scatter = payload.find((p) => (p?.payload as TD)?.letter !== undefined);
                        if (scatter) { const d = scatter.payload as TD; return <div className="bg-white border rounded-lg shadow-lg px-3 py-2"><div className="font-mono font-semibold">{d.letter}</div><div className="text-xs">{d.ms} ms</div><div className="text-xs text-slate-400">{d.date}</div></div>; }
                        const line = payload[0]?.payload as TD; if (line?.averageMs) return <div className="bg-white border rounded-lg shadow-lg px-3 py-2"><div className="font-semibold">{line.date}</div><div className="text-xs">Avg: {line.averageMs} ms</div></div>;
                        return null;
                      }} />
                      <Legend />
                      <Line yAxisId="ms" type="monotone" dataKey="averageMs" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} name="Avg ms" />
                      <Scatter yAxisId="ms" data={reindexedTimingSamples} dataKey="ms" name="Sample" fill="#fb923c" fillOpacity={0.55} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Session Fatigue */}
            {hasTrainingSessions && sessionFatigue.length > 1 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <div className="mb-2">
                  <h3 className="text-sm font-semibold text-slate-700">Session Fatigue Analysis</h3>
                  <p className="text-xs text-slate-500">Does performance drop toward end of sessions?</p>
                </div>
                <div className="w-full h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={sessionFatigue}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="groupIndex" tickFormatter={(v: number) => `#${v + 1}`} />
                      <YAxis yAxisId="acc" domain={[0, 100]} orientation="left" />
                      <YAxis yAxisId="ms" orientation="right" />
                      <Tooltip content={({ active, payload }) => {
                        if (!active || !payload?.[0]) return null;
                        const d = payload[0].payload as SessionFatiguePoint;
                        return <div className="bg-white border rounded-lg shadow-lg px-3 py-2"><div className="font-semibold">Group #{d.groupIndex + 1}</div><div className="text-xs">Accuracy: {d.avgAccuracy.toFixed(1)}%</div><div className="text-xs">Time: {d.avgMs} ms</div></div>;
                      }} />
                      <Legend />
                      <Line yAxisId="acc" type="monotone" dataKey="avgAccuracy" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} name="Accuracy %" />
                      <Line yAxisId="ms" type="monotone" dataKey="avgMs" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} name="Time (ms)" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                {sessionFatigue.length >= 3 && ((): JSX.Element | null => {
                  const first = sessionFatigue.slice(0, Math.ceil(sessionFatigue.length / 3));
                  const last = sessionFatigue.slice(-Math.ceil(sessionFatigue.length / 3));
                  const diff = first.reduce((a, b) => a + b.avgAccuracy, 0) / first.length - last.reduce((a, b) => a + b.avgAccuracy, 0) / last.length;
                  if (diff > 10) return <div className="mt-2 p-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">⚠️ Fatigue detected: Accuracy drops {diff.toFixed(1)}% toward end. Try shorter sessions.</div>;
                  if (diff < -5) return <div className="mt-2 p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">✨ Great warm-up pattern! You improve as sessions progress.</div>;
                  return null;
                })()}
              </div>
            )}
          </div>
        )}

        {/* ==================== LETTERS TAB ==================== */}
        {tab === 'letters' && (
          <div className="space-y-6">
            {/* Letter Performance Dashboard */}
            {hasTrainingSessions && letterPerformance.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <div className="mb-3">
                  <h3 className="text-sm font-semibold text-slate-700">Letter Performance Dashboard</h3>
                  <p className="text-xs text-slate-500">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1"></span>Mastered
                    <span className="inline-block w-2 h-2 rounded-full bg-amber-500 ml-3 mr-1"></span>Learning
                    <span className="inline-block w-2 h-2 rounded-full bg-rose-500 ml-3 mr-1"></span>Needs Work
                  </p>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
                  {letterPerformance.map((lp) => (
                    <div key={lp.letter} className={`p-2 rounded-lg border text-center ${lp.status === 'mastered' ? 'bg-emerald-50 border-emerald-200' : lp.status === 'learning' ? 'bg-amber-50 border-amber-200' : 'bg-rose-50 border-rose-200'}`} title={`${lp.letter}: ${lp.accuracy.toFixed(1)}% acc, ${lp.avgMs}ms`}>
                      <div className="text-lg font-bold font-mono">{lp.letter}</div>
                      <div className="text-xs text-slate-600">{lp.accuracy.toFixed(0)}%</div>
                      <div className="text-xs text-slate-500">{lp.avgMs}ms</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Response Time by Letter */}
            {hasTrainingSessions && letterTimingStats.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <div className="mb-2">
                  <h3 className="text-sm font-semibold text-slate-700">Response Time by Letter</h3>
                  <p className="text-xs text-slate-500">Sorted slowest to fastest</p>
                </div>
                <div className="w-full h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={letterTimingStats} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" unit=" ms" />
                      <YAxis type="category" dataKey="letter" width={30} />
                      <Tooltip content={({ active, payload }) => {
                        if (!active || !payload?.[0]) return null;
                        const d = payload[0].payload as LetterTimingStats;
                        return <div className="bg-white border rounded-lg shadow-lg px-3 py-2"><div className="font-mono font-semibold">{d.letter}</div><div className="text-xs">Avg: {d.avgMs} ms</div><div className="text-xs text-slate-500">{d.minMs}–{d.maxMs} ms range</div></div>;
                      }} />
                      <Bar dataKey="avgMs" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Letter Learning Trends */}
            {hasTrainingSessions && letterTrends.filter((lt) => lt.dataPoints.length >= 3).length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <div className="mb-3">
                  <h3 className="text-sm font-semibold text-slate-700">Letter Learning Trends</h3>
                  <p className="text-xs text-slate-500">
                    <span className="text-emerald-600">↑ improving</span>
                    <span className="text-slate-500 ml-2">→ stable</span>
                    <span className="text-rose-600 ml-2">↓ declining</span>
                  </p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {letterTrends.filter((lt) => lt.dataPoints.length >= 3).sort((a, b) => ({ declining: 0, stable: 1, improving: 2 }[a.trend] - { declining: 0, stable: 1, improving: 2 }[b.trend])).map((lt) => {
                    const pts = lt.dataPoints.slice(-10);
                    const minA = Math.min(...pts.map((p) => p.accuracy));
                    const maxA = Math.max(...pts.map((p) => p.accuracy));
                    const rng = maxA - minA || 1;
                    const w = 60, h = 24;
                    const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${((i / Math.max(1, pts.length - 1)) * w).toFixed(1)} ${(h - ((p.accuracy - minA) / rng) * h).toFixed(1)}`).join(' ');
                    const color = lt.trend === 'improving' ? '#10b981' : lt.trend === 'declining' ? '#ef4444' : '#64748b';
                    return (
                      <div key={lt.letter} className="p-2 rounded-lg border border-slate-200 hover:border-slate-300">
                        <div className="flex justify-between mb-1"><span className="text-lg font-bold font-mono">{lt.letter}</span><span style={{ color }}>{lt.trend === 'improving' ? '↑' : lt.trend === 'declining' ? '↓' : '→'}</span></div>
                        <svg width={w} height={h} className="w-full"><path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" /></svg>
                        <div className="text-xs text-slate-500 mt-1">{(pts[pts.length - 1]?.accuracy ?? 0).toFixed(0)}% latest</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Letter Accuracy Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Letter Accuracy {range ? '(Filtered)' : '(All)'}</h3>
                <div className="w-full h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={rangeLetterStats}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="letter" /><YAxis domain={[0, 100]} /><Tooltip /><Bar dataKey="accuracy" fill="#8b5cf6" /></BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200">
                    <div className="text-slate-600">Best letter</div>
                    <div className="font-semibold text-slate-800 font-mono">{bestLetter ? `${bestLetter.letter} — ${bestLetter.accuracy.toFixed(1)}%` : '—'}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-rose-50 border border-rose-200">
                    <div className="text-slate-600">Needs work</div>
                    <div className="font-semibold text-slate-800 font-mono">{worstLetter ? `${worstLetter.letter} — ${worstLetter.accuracy.toFixed(1)}%` : '—'}</div>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <div className="flex justify-between mb-2">
                  <h3 className="text-sm font-semibold text-slate-700">Per-Session Letter Accuracy</h3>
                  {selectedSessionTs && <button onClick={() => setSelectedSessionTs(null)} className="text-xs px-2 py-1 rounded bg-slate-100">Clear</button>}
                </div>
                {selectedSession ? (
                  <div className="w-full h-[280px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={selectedSessionLetterStats}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="letter" /><YAxis domain={[0, 100]} /><Tooltip /><Bar dataKey="accuracy" fill="#10b981" /></BarChart></ResponsiveContainer></div>
                ) : <p className="text-sm text-slate-500">Select a session to view per-letter stats.</p>}
              </div>
            </div>
          </div>
        )}

        {/* ==================== MISTAKES TAB ==================== */}
        {tab === 'mistakes' && (
          <div className="space-y-6">
            {/* Confusion Matrix */}
            {hasTrainingSessions && confusionMatrix.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <div className="mb-2">
                  <h3 className="text-sm font-semibold text-slate-700">Confusion Matrix</h3>
                  <p className="text-xs text-slate-500">What you typed when you heard a letter</p>
                </div>
                <div className="overflow-auto max-h-[400px]">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-white">
                      <tr className="border-b"><th className="text-left py-2 px-2">Heard</th><th className="text-left py-2 px-2">Typed</th><th className="text-right py-2 px-2">Count</th><th className="text-right py-2 px-2">Rate</th></tr>
                    </thead>
                    <tbody>
                      {confusionMatrix.slice(0, 30).map((c, i) => (
                        <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-2 px-2 font-mono font-bold">{c.sent}</td>
                          <td className="py-2 px-2 font-mono text-rose-600">{c.typed === '_' ? '(missing)' : c.typed}</td>
                          <td className="py-2 px-2 text-right">{c.count}</td>
                          <td className="py-2 px-2 text-right">{c.percentage.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Bigram Error Heatmap */}
            <BigramHeatmapView
              letters={bigramHeatmap.letters}
              matrix={bigramHeatmap.matrix}
              maxRate={bigramHeatmap.maxRate}
              unigramStats={unigramStats}
              rangeLabel={range ? '(filtered range)' : '(all sessions)'}
            />
          </div>
        )}

        {/* ==================== SESSIONS TAB ==================== */}
        {tab === 'sessions' && (
          <div className="space-y-4">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Session List */}
              <div className="lg:w-1/2">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="text-lg font-semibold text-slate-700">Sessions</h3>
                  {hasTrainingSessions && (
                    <button
                      type="button"
                      onClick={() => void handleClearAllSessions()}
                      disabled={sessionsSyncing}
                      className="px-2.5 py-1.5 text-xs rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50 hover:border-rose-200 hover:text-rose-700 disabled:opacity-60 disabled:cursor-not-allowed"
                      title="Clear all sessions"
                    >
                      Clear all
                    </button>
                  )}
                </div>
                <div className="max-h-[500px] overflow-auto pr-1 space-y-2">
                  {sessionsSorted.slice().sort((a, b) => b.timestamp - a.timestamp).map((s) => {
                    // Format duration
                    const durationMs = s.finishedAt && s.startedAt ? s.finishedAt - s.startedAt : 0;
                    const formatDuration = (ms: number): string => {
                      if (ms <= 0) return '—';
                      const seconds = Math.floor(ms / 1000);
                      const minutes = Math.floor(seconds / 60);
                      const hours = Math.floor(minutes / 60);
                      if (hours > 0) {
                        return `${hours}h ${minutes % 60}m`;
                      }
                      if (minutes > 0) {
                        return `${minutes}m ${seconds % 60}s`;
                      }
                      return `${seconds}s`;
                    };
                    // Infer level from alphabetSize (for Koch method: level = alphabetSize - 1)
                    // This is an approximation since we don't store the actual level
                    const inferredLevel = s.alphabetSize > 0 ? s.alphabetSize - 1 : null;
                    const groupCount = s.groups?.length || 0;
                    return (
                    <div key={s.timestamp} className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors ${selectedSessionTs === s.timestamp ? 'border-blue-300 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`} onClick={() => setSelectedSessionTs(s.timestamp)}>
                        <div className="flex-1">
                        <p className="text-sm font-medium">{formatSessionDate(s.timestamp)}</p>
                          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                        <p className="text-xs text-slate-500">Accuracy: {(s.accuracy * 100).toFixed(1)}%</p>
                            {groupCount > 0 && <p className="text-xs text-slate-500">{groupCount} {groupCount === 1 ? 'group' : 'groups'}</p>}
                            {inferredLevel !== null && <p className="text-xs text-slate-500">Level: {inferredLevel}</p>}
                            {durationMs > 0 && <p className="text-xs text-slate-500">Time: {formatDuration(durationMs)}</p>}
                      </div>
                    </div>
                        <button onClick={(e) => { e.stopPropagation(); void handleDelete(s.timestamp); }} className="px-2 py-1 text-xs rounded-md bg-rose-500 text-white hover:bg-rose-600 ml-2" disabled={sessionsSyncing}>Delete</button>
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* Session Details */}
              <div className="lg:w-1/2">
                <h3 className="text-lg font-semibold text-slate-700 mb-2">Session Details</h3>
                {!selectedSession ? <p className="text-sm text-slate-500">Select a session to view details.</p> : (
                  <div className="max-h-[500px] overflow-auto space-y-2">
                    <p className="text-sm text-slate-600 mb-2">{formatSessionDate(selectedSession.timestamp)}</p>
                    {selectedSessionDetails.map((row) => (
                      <div key={row.idx} className={`p-3 rounded-lg border ${row.correct ? 'border-emerald-200 bg-emerald-50/40' : 'border-rose-200 bg-rose-50/40'}`}>
                        <div className="flex justify-between text-sm font-mono"><span><span className="text-slate-500">#{row.idx + 1}:</span> {row.sent}</span><span className="text-xs">{row.timeMs ? `${row.timeMs}ms` : '—'}</span></div>
                        <div className="mt-1 font-mono text-sm">{row.alignment.map((a, i) => <span key={i} className={a.ok ? 'text-emerald-700' : 'text-rose-700'}>{a.ch || '·'}</span>)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================== LEADERBOARD TAB ==================== */}
        {tab === 'leaderboard' && (
          <div className="space-y-3">
            <Leaderboard limitCount={20} />
          </div>
        )}
      </div>
    </div>
  );
}

