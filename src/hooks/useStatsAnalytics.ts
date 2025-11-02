'use client';

import { useMemo } from 'react';

import type { ActivitySessionLite } from '@/components/ui/charts/ActivityHeatmap';
import { KOCH_SEQUENCE } from '@/lib/morseConstants';
import type { SessionResult } from '@/types';

export interface AccuracyChartPoint {
  readonly x: string;
  readonly accuracy: number;
  readonly timestamp: number;
}

export interface TimingDailyAggregate {
  readonly date: string;
  readonly dayIndex: number;
  readonly averageMs: number;
  readonly count: number;
}

export interface TimingSamplePoint {
  readonly dayIndex: number;
  readonly ms: number;
  readonly date: string;
}

export interface LetterStatsPoint {
  readonly letter: string;
  readonly accuracy: number;
  readonly total: number;
  readonly correct: number;
}

export interface UseStatsAnalyticsResult {
  readonly sessionsSorted: SessionResult[];
  readonly chartData: AccuracyChartPoint[];
  readonly activitySessions: ActivitySessionLite[];
  readonly timingDailyAgg: TimingDailyAggregate[];
  readonly dayIndexByDate: Record<string, number>;
  readonly dayIndexToLabel: Record<number, string>;
  readonly timingSamplesPoints: TimingSamplePoint[];
  readonly overallLetterStats: LetterStatsPoint[];
}

const groupLetterStats = (sessions: SessionResult[]): LetterStatsPoint[] => {
  const aggregate: Record<string, { correct: number; total: number }> = {};

  sessions.forEach((session) => {
    Object.entries(session.letterAccuracy).forEach(([letter, stats]) => {
      if (!aggregate[letter]) {
        aggregate[letter] = { correct: 0, total: 0 };
      }
      aggregate[letter].correct += stats.correct;
      aggregate[letter].total += stats.total;
    });
  });

  return Object.entries(aggregate)
    .map(([letter, stats]) => ({
      letter,
      accuracy: stats.total ? (stats.correct / stats.total) * 100 : 0,
      total: stats.total,
      correct: stats.correct,
    }))
    .sort((a, b) => KOCH_SEQUENCE.indexOf(a.letter) - KOCH_SEQUENCE.indexOf(b.letter));
};

export function useStatsAnalytics(sessions: SessionResult[]): UseStatsAnalyticsResult {
  const sessionsSorted = useMemo<SessionResult[]>(
    () => sessions.slice().sort((a, b) => a.timestamp - b.timestamp),
    [sessions],
  );

  const chartData = useMemo<AccuracyChartPoint[]>(
    () =>
      sessionsSorted.map((session) => ({
        x: new Date(session.timestamp).toLocaleString(),
        accuracy: session.accuracy * 100,
        timestamp: session.timestamp,
      })),
    [sessionsSorted],
  );

  const activitySessions = useMemo<ActivitySessionLite[]>(
    () =>
      sessionsSorted.map((session) => ({
        date: session.date,
        timestamp: session.timestamp,
        count: (session.groups || []).reduce(
          (sum, group) => sum + (group?.sent?.length || 0),
          0,
        ),
      })),
    [sessionsSorted],
  );

  const timingDailyAgg = useMemo<TimingDailyAggregate[]>(() => {
    const daily: Record<string, number[]> = {};
    sessionsSorted.forEach((session) => {
      const times = (session.groupTimings || [])
        .map((timing) => (typeof timing?.timeToCompleteMs === 'number' ? timing.timeToCompleteMs : 0))
        .filter((value) => value > 0 && Number.isFinite(value));
      if (times.length === 0) {
        return;
      }
      if (!daily[session.date]) {
        daily[session.date] = [];
      }
      daily[session.date].push(...times);
    });

    return Object.keys(daily)
      .sort()
      .map((date, index) => {
        const arr = daily[date];
        const avg = arr.reduce((sum, value) => sum + value, 0) / Math.max(1, arr.length);
        return {
          date,
          dayIndex: index,
          averageMs: Math.round(avg),
          count: arr.length,
        };
      });
  }, [sessionsSorted]);

  const dayIndexByDate = useMemo<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    timingDailyAgg.forEach((entry) => {
      map[entry.date] = entry.dayIndex;
    });
    return map;
  }, [timingDailyAgg]);

  const dayIndexToLabel = useMemo<Record<number, string>>(() => {
    const map: Record<number, string> = {};
    timingDailyAgg.forEach((entry) => {
      map[entry.dayIndex] = entry.date;
    });
    return map;
  }, [timingDailyAgg]);

  const timingSamplesPoints = useMemo<TimingSamplePoint[]>(() => {
    const points: TimingSamplePoint[] = [];
    const jitterAmplitude = 0.28;
    let globalIdx = 0;
    const hash = (input: string): number => {
      let h = 0;
      for (let i = 0; i < input.length; i += 1) {
        h = (h * 31 + input.charCodeAt(i)) | 0;
      }
      return Math.abs(h);
    };

    sessionsSorted.forEach((session) => {
      const baseIndex = dayIndexByDate[session.date];
      if (typeof baseIndex !== 'number') {
        return;
      }
      (session.groupTimings || []).forEach((timing, index) => {
        const value = typeof timing?.timeToCompleteMs === 'number' ? timing.timeToCompleteMs : 0;
        if (value > 0 && Number.isFinite(value)) {
          const seed = hash(`${session.date}:${session.timestamp}:${index}:${globalIdx}:${value}`);
          const r = (seed % 1000) / 1000;
          const jitter = (r - 0.5) * 2 * jitterAmplitude;
          points.push({
            dayIndex: baseIndex + jitter,
            ms: Math.round(value),
            date: session.date,
          });
          globalIdx += 1;
        }
      });
    });

    return points;
  }, [dayIndexByDate, sessionsSorted]);

  const overallLetterStats = useMemo<LetterStatsPoint[]>(() => {
    if (!sessionsSorted.length) {
      return [];
    }
    return groupLetterStats(sessionsSorted);
  }, [sessionsSorted]);

  return {
    sessionsSorted,
    chartData,
    activitySessions,
    timingDailyAgg,
    dayIndexByDate,
    dayIndexToLabel,
    timingSamplesPoints,
    overallLetterStats,
  };
}


