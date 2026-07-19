'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { AutoLevelAdjustProgressCard } from '@/components/ui/training/AutoLevelAdjustProgressCard';
import { useAutoLevelAdjustProgress } from '@/hooks/useAutoLevelAdjustProgress';
import { useHasMounted } from '@/hooks/useHasMounted';
import { useSessionsActions, useSessionsState } from '@/hooks/useSessions';
import {
  useStatsAnalytics,
  type AccuracyChartPoint,
  type LetterStatsPoint,
  type LetterTimingStats,
  type SessionFatiguePoint,
} from '@/hooks/useStatsAnalytics';
import { useTrainingSettingsState } from '@/hooks/useTrainingSettings';
import { createGroupDisplayAlignment } from '@/lib/groupAlignment';
import {
  MASTERED_MIN_ACCURACY,
  MASTERED_MIN_ATTEMPTS,
  SLOW_AVG_MS,
  buildCharacterDiagnostics,
} from '@/lib/scoring/characterDiagnostics';
import { buildBigramHeatmapData, buildUnigramStats } from '@/lib/scoring/letterErrorStats';
import { formatSessionLevelLabel } from '@/lib/sessionLevelSnapshot';
import { computeCharPool } from '@/lib/trainingUtils';

import { AchievementTrophyCase } from './AchievementTrophyCase';
import { BigramHeatmapView } from './BigramHeatmap';
import { CharSamplingPanel } from './CharSamplingPanel';
import { Leaderboard } from './Leaderboard';

type BrushRange = {
  readonly startIndex?: number;
  readonly endIndex?: number;
};

type StatsTab =
  | 'overview'
  | 'progress'
  | 'letters'
  | 'sampling'
  | 'mistakes'
  | 'sessions'
  | 'achievements'
  | 'leaderboard';

const STATS_TABS: ReadonlyArray<{
  readonly id: StatsTab;
  readonly label: string;
  readonly description: string;
  readonly icon: string;
  readonly activeClass: string;
}> = [
  {
    id: 'overview',
    label: 'Overview',
    description: 'Summary and character diagnostics',
    icon: '📊',
    activeClass: 'from-sky-500 to-indigo-600',
  },
  {
    id: 'progress',
    label: 'Progress',
    description: 'Accuracy and timing trends',
    icon: '📈',
    activeClass: 'from-emerald-500 to-teal-600',
  },
  {
    id: 'letters',
    label: 'Letters',
    description: 'Character mastery',
    icon: '🔤',
    activeClass: 'from-violet-500 to-fuchsia-600',
  },
  {
    id: 'sampling',
    label: 'Sampling',
    description: 'Bayesian draw weights',
    icon: '🎲',
    activeClass: 'from-indigo-500 to-sky-600',
  },
  {
    id: 'mistakes',
    label: 'Mistakes',
    description: 'Confusions and errors',
    icon: '✕',
    activeClass: 'from-rose-500 to-orange-500',
  },
  {
    id: 'sessions',
    label: 'Sessions',
    description: 'History and details',
    icon: '▦',
    activeClass: 'from-slate-600 to-slate-800',
  },
  {
    id: 'achievements',
    label: 'Trophies',
    description: 'Badges earned locally',
    icon: '★',
    activeClass: 'from-amber-500 to-yellow-600',
  },
  {
    id: 'leaderboard',
    label: 'Leaderboard',
    description: 'Shared score ranking',
    icon: '🏆',
    activeClass: 'from-indigo-500 to-purple-600',
  },
] as const;

const RANGE_FILTER_TABS = new Set<StatsTab>([
  'overview',
  'progress',
  'letters',
  'mistakes',
  'sessions',
]);

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

export function GroupTrainingStats({ onBack, embedded }: GroupTrainingStatsProps): JSX.Element {
  const [selectedSessionTs, setSelectedSessionTs] = useState<number | null>(null);
  const [selectedForDeletion, setSelectedForDeletion] = useState<ReadonlySet<number>>(
    () => new Set(),
  );
  const selectAllCheckboxRef = useRef<HTMLInputElement>(null);
  const [range, setRange] = useState<{ startIndex: number; endIndex: number } | null>(null);
  const [tab, setTab] = useState<StatsTab>('overview');

  const { sessions, sessionsStatus, sessionsError, sessionsSyncing } = useSessionsState();
  const { trainingSettings } = useTrainingSettingsState();
  const { removeSessionByTimestamp } = useSessionsActions();

  const sessionResults = sessions;
  const groupSessions = useMemo(
    () => sessionResults.filter((session) => (session.mode ?? 'group') === 'group'),
    [sessionResults],
  );
  const lastGroupAccuracyPercent = useMemo(() => {
    const sorted = [...groupSessions].sort((a, b) => a.timestamp - b.timestamp);
    const last = sorted[sorted.length - 1];
    return last && Number.isFinite(last.accuracy) ? Math.round(last.accuracy * 100) : 0;
  }, [groupSessions]);
  const levelAdjustProgress = useAutoLevelAdjustProgress(
    trainingSettings,
    'group',
    groupSessions.length + lastGroupAccuracyPercent,
  );
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
        setSelectedForDeletion((current) => {
          if (!current.has(timestamp)) return current;
          const next = new Set(current);
          next.delete(timestamp);
          return next;
        });
      } catch (error) {
        console.error('[GroupTrainingStats] Failed to delete session', error);
      }
    },
    [removeSessionByTimestamp],
  );

  const displayedSessions = useMemo(
    () => sessionsSorted.slice().sort((a, b) => b.timestamp - a.timestamp),
    [sessionsSorted],
  );

  const allDisplayedSelected =
    displayedSessions.length > 0 &&
    displayedSessions.every((session) => selectedForDeletion.has(session.timestamp));

  const someDisplayedSelected = displayedSessions.some((session) =>
    selectedForDeletion.has(session.timestamp),
  );

  useEffect(() => {
    const validTimestamps = new Set(sessionResults.map((session) => session.timestamp));
    setSelectedForDeletion((current) => {
      const next = new Set([...current].filter((timestamp) => validTimestamps.has(timestamp)));
      return next.size === current.size ? current : next;
    });
  }, [sessionResults]);

  useEffect(() => {
    const checkbox = selectAllCheckboxRef.current;
    if (!checkbox) return;
    checkbox.indeterminate = someDisplayedSelected && !allDisplayedSelected;
  }, [someDisplayedSelected, allDisplayedSelected]);

  const toggleSelectAllSessions = useCallback((): void => {
    if (allDisplayedSelected) {
      setSelectedForDeletion(new Set());
      return;
    }
    setSelectedForDeletion(new Set(displayedSessions.map((session) => session.timestamp)));
  }, [allDisplayedSelected, displayedSessions]);

  const toggleSessionDeletionSelection = useCallback((timestamp: number): void => {
    setSelectedForDeletion((current) => {
      const next = new Set(current);
      if (next.has(timestamp)) {
        next.delete(timestamp);
      } else {
        next.add(timestamp);
      }
      return next;
    });
  }, []);

  const handleClearSelectedSessions = useCallback(async (): Promise<void> => {
    const timestamps = [...selectedForDeletion];
    if (timestamps.length === 0) return;
    const confirmed = window.confirm(
      `Delete ${timestamps.length} selected session${timestamps.length === 1 ? '' : 's'}? This cannot be undone.`,
    );
    if (!confirmed) return;
    try {
      for (const timestamp of timestamps) {
        await removeSessionByTimestamp(timestamp);
        setSelectedForDeletion((current) => {
          const next = new Set(current);
          next.delete(timestamp);
          return next;
        });
        setSelectedSessionTs((current) => (current === timestamp ? null : current));
      }
    } catch (error) {
      console.error('[GroupTrainingStats] Failed to delete selected sessions', error);
    }
  }, [removeSessionByTimestamp, selectedForDeletion]);

  const aggregateLetterStats = useCallback(
    (sessionsToAggregate: typeof sessionsSorted): LetterStatsPoint[] => {
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
    },
    [],
  );

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

  const selectedSession = useMemo<(typeof sessionsSorted)[number] | null>(
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

  const letterGroupSamples = useMemo(
    () =>
      rangeFilteredSessions.flatMap((s) =>
        (s.groups ?? []).map((g) => ({
          sent: g?.sent ?? '',
          received: g?.received ?? '',
        })),
      ),
    [rangeFilteredSessions],
  );

  const bigramHeatmap = useMemo(
    () => buildBigramHeatmapData(letterGroupSamples),
    [letterGroupSamples],
  );

  const unigramStats = useMemo(() => buildUnigramStats(letterGroupSamples), [letterGroupSamples]);

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
      const best: LetterStatsPoint | null =
        rangeLetterStats.length > 0 ? (rangeLetterStats[0] ?? null) : null;
      const worstIdx = rangeLetterStats.length > 0 ? rangeLetterStats.length - 1 : -1;
      const worst: LetterStatsPoint | null =
        worstIdx >= 0 ? (rangeLetterStats[worstIdx] ?? null) : null;
      return {
        kpiAvgAccuracy: avgAcc,
        kpiSessions: totalSessions,
        kpiAvgMs: avgMs,
        kpiUniqueDays: days,
        bestLetter: best,
        worstLetter: worst,
      };
    }, [rangeFilteredSessions, rangeLetterStats]);

  const practicePool = useMemo(() => {
    const settings = trainingSettings;
    const customSet = Array.isArray(settings.customSet) ? settings.customSet : [];
    const customSequence = Array.isArray(settings.customSequence) ? settings.customSequence : [];
    return computeCharPool({
      kochLevel: settings.kochLevel,
      charSetMode: settings.charSetMode,
      digitsLevel: settings.digitsLevel,
      ...(customSet.length > 0 ? { customSet: [...customSet] } : {}),
      ...(customSequence.length > 0 ? { customSequence: [...customSequence] } : {}),
      ...(settings.slidingWindowStart !== undefined
        ? { slidingWindowStart: settings.slidingWindowStart }
        : {}),
      ...(settings.slidingWindowEnd !== undefined
        ? { slidingWindowEnd: settings.slidingWindowEnd }
        : {}),
    });
  }, [trainingSettings]);

  const poolDiagnostics = useMemo(
    () =>
      buildCharacterDiagnostics({
        sessions: rangeFilteredSessions,
        pool: practicePool,
      }),
    [rangeFilteredSessions, practicePool],
  );

  const poolWeak = useMemo(
    () => poolDiagnostics.filter((d) => d.status === 'weak'),
    [poolDiagnostics],
  );
  const poolSlow = useMemo(() => poolDiagnostics.filter((d) => d.isSlow), [poolDiagnostics]);
  const poolMastered = useMemo(
    () => poolDiagnostics.filter((d) => d.status === 'mastered'),
    [poolDiagnostics],
  );
  const poolConfusions = useMemo(() => {
    const poolSet = new Set(practicePool.map((c) => c.toUpperCase()));
    return confusionMatrix.filter((c) => poolSet.has(c.sent)).slice(0, 5);
  }, [confusionMatrix, practicePool]);

  const hasPoolDiagnostics =
    poolWeak.length > 0 ||
    poolSlow.length > 0 ||
    poolMastered.length > 0 ||
    poolConfusions.length > 0;

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
  const showRangeControls = RANGE_FILTER_TABS.has(tab);
  const activeTabDetails = STATS_TABS.find((item) => item.id === tab) ?? {
    id: 'overview' as const,
    label: 'Overview',
    description: 'Summary and character diagnostics',
    icon: '📊',
    activeClass: 'from-sky-500 to-indigo-600',
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
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">
              Group Training Statistics
            </h2>
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
              <h3 className="text-lg font-semibold text-slate-800">
                No group training sessions yet
              </h3>
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
            <div className="space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-white/90 p-2 shadow-sm">
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {STATS_TABS.map((t) => {
                    const active = tab === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        className={`group relative flex shrink-0 items-center gap-2 overflow-hidden rounded-xl px-3 py-2 text-sm font-semibold transition ${
                          active
                            ? 'text-white shadow-md shadow-indigo-100'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                        onClick={() => setTab(t.id)}
                        aria-pressed={active}
                      >
                        {active && (
                          <span
                            className={`absolute inset-0 bg-gradient-to-r ${t.activeClass}`}
                            aria-hidden="true"
                          />
                        )}
                        <span
                          className={`relative flex h-6 w-6 items-center justify-center rounded-lg text-xs font-bold ${
                            active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {t.icon}
                        </span>
                        <span className="relative whitespace-nowrap">{t.label}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex flex-col gap-2 border-t border-slate-100 px-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-slate-500">
                    <span className="font-semibold text-slate-700">{activeTabDetails.label}:</span>{' '}
                    {activeTabDetails.description}
                  </p>
                  {!showRangeControls && (
                    <p className="text-xs text-slate-500">Uses your full local history.</p>
                  )}
                </div>
              </div>
              {showRangeControls && (
                <div className="flex items-center gap-3 flex-wrap rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Date range
                  </span>
                  <div className="inline-flex rounded-lg border border-slate-200 bg-white overflow-hidden">
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
                      className="px-2.5 py-1.5 text-xs rounded-md bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                    >
                      Clear range
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* KPIs - shown on overview and progress tabs */}
        {(tab === 'overview' || tab === 'progress') && hasTrainingSessions && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <div className="p-3 sm:p-4 rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                <span aria-hidden>🎯</span>Avg accuracy
              </div>
              <div className="mt-0.5 text-2xl font-extrabold text-emerald-800">
                {kpiAvgAccuracy.toFixed(1)}%
              </div>
            </div>
            <div className="p-3 sm:p-4 rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-blue-700">
                <span aria-hidden>📻</span>Sessions
              </div>
              <div className="mt-0.5 text-2xl font-extrabold text-blue-800">{kpiSessions}</div>
            </div>
            <div className="p-3 sm:p-4 rounded-xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-700">
                <span aria-hidden>⏱️</span>Avg response
              </div>
              <div className="mt-0.5 text-2xl font-extrabold text-amber-800">
                {kpiAvgMs ? Math.round(kpiAvgMs) : '—'}
                <span className="text-base font-bold text-amber-600 ml-1">ms</span>
              </div>
            </div>
            <div className="p-3 sm:p-4 rounded-xl border border-violet-100 bg-gradient-to-br from-violet-50 to-white">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-violet-700">
                <span aria-hidden>🗓️</span>Active days
              </div>
              <div className="mt-0.5 text-2xl font-extrabold text-violet-800">{kpiUniqueDays}</div>
            </div>
          </div>
        )}

        {/* ==================== OVERVIEW TAB ==================== */}
        {tab === 'overview' && (
          <div className="space-y-6">
            {levelAdjustProgress !== null ? (
              <AutoLevelAdjustProgressCard progress={levelAdjustProgress} profileLabel="Group" />
            ) : null}

            {/* Activity Heatmap */}
            {hasTrainingSessions && <ActivityHeatmap sessions={activitySessions} />}

            {/* Character diagnostics (current practice set) */}
            {hasTrainingSessions && hasPoolDiagnostics && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-1">Character diagnostics</h3>
                <p className="text-xs text-slate-500 mb-3">
                  Within your current practice set. Stage and certificate progress live in the
                  Teaching plan — this is where individual characters need attention.
                </p>
                <div className="space-y-3">
                  {poolWeak.length > 0 && (
                    <div className="p-3 rounded-lg bg-rose-50 border border-rose-200">
                      <div className="text-xs font-semibold text-rose-800 mb-1">Weak accuracy</div>
                      <div className="flex flex-wrap gap-2">
                        {poolWeak.slice(0, 8).map((lp) => (
                          <span
                            key={lp.letter}
                            className="px-2 py-1 bg-rose-100 rounded text-sm font-mono font-semibold text-rose-900"
                          >
                            {lp.letter}{' '}
                            <span className="text-xs font-normal">({lp.accuracy.toFixed(0)}%)</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {poolSlow.length > 0 && (
                    <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                      <div className="text-xs font-semibold text-amber-800 mb-1">
                        Accurate but slow (≥{SLOW_AVG_MS} ms)
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {poolSlow.slice(0, 8).map((lp) => (
                          <span
                            key={lp.letter}
                            className="px-2 py-1 bg-amber-100 rounded text-sm font-mono font-semibold text-amber-900"
                          >
                            {lp.letter} <span className="text-xs font-normal">({lp.avgMs} ms)</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {poolConfusions.length > 0 && (
                    <div className="p-3 rounded-lg bg-violet-50 border border-violet-200">
                      <div className="text-xs font-semibold text-violet-800 mb-1">
                        Common confusions
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {poolConfusions.map((c, i) => (
                          <span
                            key={`${c.sent}-${c.typed}-${i}`}
                            className="px-2 py-1 bg-violet-100 rounded text-sm font-mono text-violet-900"
                          >
                            {c.sent}→{c.typed}{' '}
                            <span className="text-xs font-normal">({c.count}×)</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {poolMastered.length > 0 && (
                    <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                      <div className="text-xs font-semibold text-emerald-800 mb-1">
                        Mastered in this set ({poolMastered.length}) — same bar as trophies (≥
                        {MASTERED_MIN_ATTEMPTS} attempts, ≥{Math.round(MASTERED_MIN_ACCURACY * 100)}
                        %)
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {poolMastered.map((lp) => (
                          <span
                            key={lp.letter}
                            className="px-1.5 py-0.5 bg-emerald-100 rounded text-xs font-mono font-semibold text-emerald-900"
                          >
                            {lp.letter}
                            {lp.isSlow ? '·' : ''}
                          </span>
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
                  <p className="text-xs text-slate-500">
                    Drag the slider below to filter date range
                  </p>
                </div>
                <div className="w-full h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={chartData}
                      onClick={(event) => {
                        const payload = extractChartPoint(event);
                        if (payload?.timestamp) setSelectedSessionTs(payload.timestamp);
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="x" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.[0]) return null;
                          const data = payload[0].payload as AccuracyChartPoint;
                          return (
                            <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2">
                              <div className="text-sm font-semibold">
                                {data.accuracy.toFixed(1)}%
                              </div>
                              <div className="text-xs text-slate-600">{data.x}</div>
                            </div>
                          );
                        }}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="accuracy"
                        stroke="#2563eb"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        name="Accuracy %"
                      />
                      <Brush
                        dataKey="x"
                        travellerWidth={10}
                        height={28}
                        stroke="#3b82f6"
                        fill="#eff6ff"
                        {...(range
                          ? { startIndex: range.startIndex, endIndex: range.endIndex }
                          : {})}
                        onChange={(v) => {
                          if (
                            v &&
                            isBrushRange(v) &&
                            typeof v.startIndex === 'number' &&
                            typeof v.endIndex === 'number'
                          )
                            setRange({ startIndex: v.startIndex, endIndex: v.endIndex });
                        }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Response Time by Day */}
            {hasTrainingSessions && (
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <div className="mb-2">
                  <h3 className="text-sm font-semibold text-slate-700">
                    Response Time by Day{' '}
                    {range && (
                      <span className="text-xs font-normal text-slate-500">(filtered)</span>
                    )}
                  </h3>
                </div>
                <div className="w-full h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={reindexedTimingDailyAgg}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        type="number"
                        dataKey="dayIndex"
                        ticks={reindexedTimingDailyAgg.map((d) => d.dayIndex)}
                        domain={[
                          Math.min(0, (reindexedTimingDailyAgg[0]?.dayIndex ?? 0) - 0.5),
                          (reindexedTimingDailyAgg[reindexedTimingDailyAgg.length - 1]?.dayIndex ??
                            0) + 0.5,
                        ]}
                        tickFormatter={(v: number) => filteredDayIndexToLabel[v] || ''}
                      />
                      <YAxis yAxisId="ms" />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          type TD = {
                            letter?: string;
                            ms?: number;
                            date?: string;
                            averageMs?: number;
                          };
                          const scatter = payload.find(
                            (p) => (p?.payload as TD)?.letter !== undefined,
                          );
                          if (scatter) {
                            const d = scatter.payload as TD;
                            return (
                              <div className="bg-white border rounded-lg shadow-lg px-3 py-2">
                                <div className="font-mono font-semibold">{d.letter}</div>
                                <div className="text-xs">{d.ms} ms</div>
                                <div className="text-xs text-slate-400">{d.date}</div>
                              </div>
                            );
                          }
                          const line = payload[0]?.payload as TD;
                          if (line?.averageMs)
                            return (
                              <div className="bg-white border rounded-lg shadow-lg px-3 py-2">
                                <div className="font-semibold">{line.date}</div>
                                <div className="text-xs">Avg: {line.averageMs} ms</div>
                              </div>
                            );
                          return null;
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
                        data={reindexedTimingSamples}
                        dataKey="ms"
                        name="Sample"
                        fill="#fb923c"
                        fillOpacity={0.55}
                      />
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
                  <p className="text-xs text-slate-500">
                    Does performance drop toward end of sessions?
                  </p>
                </div>
                <div className="w-full h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={sessionFatigue}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="groupIndex" tickFormatter={(v: number) => `#${v + 1}`} />
                      <YAxis yAxisId="acc" domain={[0, 100]} orientation="left" />
                      <YAxis yAxisId="ms" orientation="right" />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.[0]) return null;
                          const d = payload[0].payload as SessionFatiguePoint;
                          return (
                            <div className="bg-white border rounded-lg shadow-lg px-3 py-2">
                              <div className="font-semibold">Group #{d.groupIndex + 1}</div>
                              <div className="text-xs">Accuracy: {d.avgAccuracy.toFixed(1)}%</div>
                              <div className="text-xs">Time: {d.avgMs} ms</div>
                            </div>
                          );
                        }}
                      />
                      <Legend />
                      <Line
                        yAxisId="acc"
                        type="monotone"
                        dataKey="avgAccuracy"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        name="Accuracy %"
                      />
                      <Line
                        yAxisId="ms"
                        type="monotone"
                        dataKey="avgMs"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        name="Time (ms)"
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                {sessionFatigue.length >= 3 &&
                  ((): JSX.Element | null => {
                    const first = sessionFatigue.slice(0, Math.ceil(sessionFatigue.length / 3));
                    const last = sessionFatigue.slice(-Math.ceil(sessionFatigue.length / 3));
                    const diff =
                      first.reduce((a, b) => a + b.avgAccuracy, 0) / first.length -
                      last.reduce((a, b) => a + b.avgAccuracy, 0) / last.length;
                    if (diff > 10)
                      return (
                        <div className="mt-2 p-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                          ⚠️ Fatigue detected: Accuracy drops {diff.toFixed(1)}% toward end. Try
                          shorter sessions.
                        </div>
                      );
                    if (diff < -5)
                      return (
                        <div className="mt-2 p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                          ✨ Great warm-up pattern! You improve as sessions progress.
                        </div>
                      );
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
                  <h3 className="text-sm font-semibold text-slate-700">
                    Letter Performance Dashboard
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Mastery matches trophies: ≥{MASTERED_MIN_ATTEMPTS} attempts at ≥
                    {Math.round(MASTERED_MIN_ACCURACY * 100)}% accuracy. Speed is separate — a dot
                    marks accurate-but-slow (≥{SLOW_AVG_MS} ms).
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1"></span>
                    Mastered
                    <span className="inline-block w-2 h-2 rounded-full bg-amber-500 ml-3 mr-1"></span>
                    Building
                    <span className="inline-block w-2 h-2 rounded-full bg-rose-500 ml-3 mr-1"></span>
                    Weak
                  </p>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
                  {letterPerformance.map((lp) => (
                    <div
                      key={lp.letter}
                      className={`p-2 rounded-lg border text-center ${
                        lp.status === 'mastered'
                          ? 'bg-emerald-50 border-emerald-200'
                          : lp.status === 'building'
                            ? 'bg-amber-50 border-amber-200'
                            : 'bg-rose-50 border-rose-200'
                      }`}
                      title={`${lp.letter}: ${lp.accuracy.toFixed(1)}% acc, ${lp.avgMs}ms${lp.isSlow ? ' (slow)' : ''}`}
                    >
                      <div className="text-lg font-bold font-mono">
                        {lp.letter}
                        {lp.isSlow ? (
                          <span className="text-amber-600 text-xs ml-0.5" aria-label="slow">
                            ·
                          </span>
                        ) : null}
                      </div>
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
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.[0]) return null;
                          const d = payload[0].payload as LetterTimingStats;
                          return (
                            <div className="bg-white border rounded-lg shadow-lg px-3 py-2">
                              <div className="font-mono font-semibold">{d.letter}</div>
                              <div className="text-xs">Avg: {d.avgMs} ms</div>
                              <div className="text-xs text-slate-500">
                                {d.minMs}–{d.maxMs} ms range
                              </div>
                            </div>
                          );
                        }}
                      />
                      <Bar dataKey="avgMs" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Letter Learning Trends */}
            {hasTrainingSessions &&
              letterTrends.filter((lt) => lt.dataPoints.length >= 3).length > 0 && (
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
                    {letterTrends
                      .filter((lt) => lt.dataPoints.length >= 3)
                      .sort(
                        (a, b) =>
                          ({ declining: 0, stable: 1, improving: 2 })[a.trend] -
                          { declining: 0, stable: 1, improving: 2 }[b.trend],
                      )
                      .map((lt) => {
                        const pts = lt.dataPoints.slice(-10);
                        const minA = Math.min(...pts.map((p) => p.accuracy));
                        const maxA = Math.max(...pts.map((p) => p.accuracy));
                        const rng = maxA - minA || 1;
                        const w = 60,
                          h = 24;
                        const path = pts
                          .map(
                            (p, i) =>
                              `${i === 0 ? 'M' : 'L'} ${((i / Math.max(1, pts.length - 1)) * w).toFixed(1)} ${(h - ((p.accuracy - minA) / rng) * h).toFixed(1)}`,
                          )
                          .join(' ');
                        const color =
                          lt.trend === 'improving'
                            ? '#10b981'
                            : lt.trend === 'declining'
                              ? '#ef4444'
                              : '#64748b';
                        return (
                          <div
                            key={lt.letter}
                            className="p-2 rounded-lg border border-slate-200 hover:border-slate-300"
                          >
                            <div className="flex justify-between mb-1">
                              <span className="text-lg font-bold font-mono">{lt.letter}</span>
                              <span style={{ color }}>
                                {lt.trend === 'improving'
                                  ? '↑'
                                  : lt.trend === 'declining'
                                    ? '↓'
                                    : '→'}
                              </span>
                            </div>
                            <svg width={w} height={h} className="w-full">
                              <path
                                d={path}
                                fill="none"
                                stroke={color}
                                strokeWidth="2"
                                strokeLinecap="round"
                              />
                            </svg>
                            <div className="text-xs text-slate-500 mt-1">
                              {(pts[pts.length - 1]?.accuracy ?? 0).toFixed(0)}% latest
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

            {/* Letter Accuracy Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <h3 className="text-sm font-semibold text-slate-700 mb-2">
                  Letter Accuracy {range ? '(Filtered)' : '(All)'}
                </h3>
                <div className="w-full h-[240px]">
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
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200">
                    <div className="text-slate-600">Best letter</div>
                    <div className="font-semibold text-slate-800 font-mono">
                      {bestLetter
                        ? `${bestLetter.letter} — ${bestLetter.accuracy.toFixed(1)}%`
                        : '—'}
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-rose-50 border border-rose-200">
                    <div className="text-slate-600">Needs work</div>
                    <div className="font-semibold text-slate-800 font-mono">
                      {worstLetter
                        ? `${worstLetter.letter} — ${worstLetter.accuracy.toFixed(1)}%`
                        : '—'}
                    </div>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <div className="flex justify-between mb-2">
                  <h3 className="text-sm font-semibold text-slate-700">
                    Per-Session Letter Accuracy
                  </h3>
                  {selectedSessionTs && (
                    <button
                      onClick={() => setSelectedSessionTs(null)}
                      className="text-xs px-2 py-1 rounded bg-slate-100"
                    >
                      Clear
                    </button>
                  )}
                </div>
                {selectedSession ? (
                  <div className="w-full h-[280px]">
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
                    Select a session to view per-letter stats.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === 'sampling' && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              P(error) is Bayesian (sampling); Letters tab is frequentist accuracy (performance).
              Reflects saved settings and all group sessions.
            </p>
            <CharSamplingPanel settings={trainingSettings} sessions={groupSessions} />
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
                      <tr className="border-b">
                        <th className="text-left py-2 px-2">Heard</th>
                        <th className="text-left py-2 px-2">Typed</th>
                        <th className="text-right py-2 px-2">Count</th>
                        <th className="text-right py-2 px-2">Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {confusionMatrix.slice(0, 30).map((c, i) => (
                        <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-2 px-2 font-mono font-bold">{c.sent}</td>
                          <td className="py-2 px-2 font-mono text-rose-600">
                            {c.typed === '_' ? '(missing)' : c.typed}
                          </td>
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
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-3">
                    {hasTrainingSessions && (
                      <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
                        <input
                          ref={selectAllCheckboxRef}
                          type="checkbox"
                          checked={allDisplayedSelected}
                          onChange={toggleSelectAllSessions}
                          disabled={sessionsSyncing}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          aria-label="Select all sessions"
                        />
                        Select all
                      </label>
                    )}
                    <h3 className="text-lg font-semibold text-slate-700">Sessions</h3>
                  </div>
                  {selectedForDeletion.size > 0 && (
                    <button
                      type="button"
                      onClick={() => void handleClearSelectedSessions()}
                      disabled={sessionsSyncing}
                      className="px-2.5 py-1.5 text-xs rounded-md border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-60 disabled:cursor-not-allowed"
                      title="Delete selected sessions"
                    >
                      Clear selected ({selectedForDeletion.size})
                    </button>
                  )}
                </div>
                <div className="max-h-[500px] overflow-auto pr-1 space-y-2">
                  {displayedSessions.map((s) => {
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
                    const levelLabel = formatSessionLevelLabel(s);
                    const groupCount = s.groups?.length || 0;
                    return (
                      <div
                        key={s.timestamp}
                        className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-colors ${selectedSessionTs === s.timestamp ? 'border-blue-300 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'} ${selectedForDeletion.has(s.timestamp) ? 'ring-1 ring-rose-200' : ''}`}
                        onClick={() => setSelectedSessionTs(s.timestamp)}
                      >
                        <input
                          type="checkbox"
                          checked={selectedForDeletion.has(s.timestamp)}
                          onChange={() => toggleSessionDeletionSelection(s.timestamp)}
                          onClick={(e) => e.stopPropagation()}
                          disabled={sessionsSyncing}
                          className="shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          aria-label={`Select session ${formatSessionDate(s.timestamp)} for deletion`}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{formatSessionDate(s.timestamp)}</p>
                          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                            <p className="text-xs text-slate-500">
                              Accuracy: {(s.accuracy * 100).toFixed(1)}%
                            </p>
                            {groupCount > 0 && (
                              <p className="text-xs text-slate-500">
                                {groupCount} {groupCount === 1 ? 'group' : 'groups'}
                              </p>
                            )}
                            {levelLabel !== null && (
                              <p className="text-xs text-slate-500">Level: {levelLabel}</p>
                            )}
                            {durationMs > 0 && (
                              <p className="text-xs text-slate-500">
                                Time: {formatDuration(durationMs)}
                              </p>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDelete(s.timestamp);
                          }}
                          className="px-2 py-1 text-xs rounded-md bg-rose-500 text-white hover:bg-rose-600 ml-2"
                          disabled={sessionsSyncing}
                        >
                          Delete
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* Session Details */}
              <div className="lg:w-1/2">
                <h3 className="text-lg font-semibold text-slate-700 mb-2">Session Details</h3>
                {!selectedSession ? (
                  <p className="text-sm text-slate-500">Select a session to view details.</p>
                ) : (
                  <div className="max-h-[500px] overflow-auto space-y-2">
                    <p className="text-sm text-slate-600 mb-2">
                      {formatSessionDate(selectedSession.timestamp)}
                    </p>
                    {selectedSessionDetails.map((row) => (
                      <div
                        key={row.idx}
                        className={`p-3 rounded-lg border ${row.correct ? 'border-emerald-200 bg-emerald-50/40' : 'border-rose-200 bg-rose-50/40'}`}
                      >
                        <div className="flex justify-between text-sm font-mono">
                          <span>
                            <span className="text-slate-500">#{row.idx + 1}:</span> {row.sent}
                          </span>
                          <span className="text-xs">{row.timeMs ? `${row.timeMs}ms` : '—'}</span>
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

        {/* ==================== ACHIEVEMENTS TAB ==================== */}
        {tab === 'achievements' && <AchievementTrophyCase sessions={sessionResults} />}
      </div>
    </div>
  );
}
