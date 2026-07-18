'use client';

import { useMemo } from 'react';

import { LCWO_SEQUENCE } from '@/lib/morseConstants';
import { buildCharacterDiagnostics } from '@/lib/scoring/characterDiagnostics';
import { mapSessionsToHeatmap } from '@/lib/utils/mapSessionsToHeatmap';
import type { HeatmapSession, SessionResult } from '@/types';

/** Format a session timestamp for display. If not provided, ISO string is used (hydration-safe). */
export type FormatSessionDate = (timestamp: number) => string;

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
  readonly letter: string;
  readonly sessionTimestamp: number;
}

export interface LetterStatsPoint {
  readonly letter: string;
  readonly accuracy: number;
  readonly total: number;
  readonly correct: number;
}

export interface LetterTimingStats {
  readonly letter: string;
  readonly avgMs: number;
  readonly minMs: number;
  readonly maxMs: number;
  readonly count: number;
  readonly samples: number[];
}

export interface LetterPerformance {
  readonly letter: string;
  readonly accuracy: number;
  readonly avgMs: number;
  readonly total: number;
  readonly correct: number;
  readonly status: 'mastered' | 'building' | 'weak';
  readonly isSlow: boolean;
}

export interface ConfusionEntry {
  readonly sent: string;
  readonly typed: string;
  readonly count: number;
  readonly percentage: number;
}

export interface LetterTrend {
  readonly letter: string;
  readonly dataPoints: Array<{ sessionIndex: number; accuracy: number; avgMs: number }>;
  readonly trend: 'improving' | 'stable' | 'declining';
}

export interface SessionFatiguePoint {
  readonly groupIndex: number;
  readonly avgAccuracy: number;
  readonly avgMs: number;
  readonly sampleCount: number;
}

export interface UseStatsAnalyticsResult {
  readonly sessionsSorted: SessionResult[];
  readonly chartData: AccuracyChartPoint[];
  readonly activitySessions: readonly HeatmapSession[];
  readonly timingDailyAgg: TimingDailyAggregate[];
  readonly dayIndexByDate: Record<string, number>;
  readonly dayIndexToLabel: Record<number, string>;
  readonly timingSamplesPoints: TimingSamplePoint[];
  readonly overallLetterStats: LetterStatsPoint[];
  // New analytics
  readonly letterTimingStats: LetterTimingStats[];
  readonly letterPerformance: LetterPerformance[];
  readonly confusionMatrix: ConfusionEntry[];
  readonly letterTrends: LetterTrend[];
  readonly sessionFatigue: SessionFatiguePoint[];
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
    .sort((a, b) => LCWO_SEQUENCE.indexOf(a.letter) - LCWO_SEQUENCE.indexOf(b.letter));
};

export function useStatsAnalytics(
  sessions: SessionResult[],
  formatSessionDate?: FormatSessionDate,
): UseStatsAnalyticsResult {
  const sessionsSorted = useMemo<SessionResult[]>(
    () => sessions.slice().sort((a, b) => a.timestamp - b.timestamp),
    [sessions],
  );

  const chartData = useMemo<AccuracyChartPoint[]>(
    () =>
      sessionsSorted.map((session) => ({
        x: formatSessionDate
          ? formatSessionDate(session.timestamp)
          : new Date(session.timestamp).toISOString(),
        accuracy: session.accuracy * 100,
        timestamp: session.timestamp,
      })),
    [sessionsSorted, formatSessionDate],
  );

  const activitySessions = useMemo(() => mapSessionsToHeatmap(sessionsSorted), [sessionsSorted]);

  const timingDailyAgg = useMemo<TimingDailyAggregate[]>(() => {
    const daily: Record<string, number[]> = {};
    sessionsSorted.forEach((session) => {
      const times = (session.groupTimings || [])
        .map((timing) => (typeof timing?.timeToCompleteMs === 'number' ? timing.timeToCompleteMs : 0))
        .filter((value) => value > 0 && Number.isFinite(value));
      if (times.length === 0) {
        return;
      }
      const date = session.date;
      if (!date) return;
      if (!daily[date]) {
        daily[date] = [];
      }
      const arr = daily[date];
      if (arr) {
        arr.push(...times);
      }
    });

    return Object.keys(daily)
      .sort()
      .map((date, index) => {
        const arr = daily[date];
        if (!arr || arr.length === 0) {
          return { date, dayIndex: index, averageMs: 0, count: 0 };
        }
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
      const groups = session.groups || [];
      (session.groupTimings || []).forEach((timing, index) => {
        const value = typeof timing?.timeToCompleteMs === 'number' ? timing.timeToCompleteMs : 0;
        if (value > 0 && Number.isFinite(value)) {
          const seed = hash(`${session.date}:${session.timestamp}:${index}:${globalIdx}:${value}`);
          const r = (seed % 1000) / 1000;
          const jitter = (r - 0.5) * 2 * jitterAmplitude;
          // Get the letter/group that was sent for this timing
          const group = groups[index];
          const letter = group?.sent || '?';
          points.push({
            dayIndex: baseIndex + jitter,
            ms: Math.round(value),
            date: session.date,
            letter,
            sessionTimestamp: session.timestamp,
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

  // Per-letter timing statistics
  const letterTimingStats = useMemo<LetterTimingStats[]>(() => {
    const timingByLetter: Record<string, number[]> = {};
    
    sessionsSorted.forEach((session) => {
      const groups = session.groups || [];
      const timings = session.groupTimings || [];
      
      groups.forEach((group, idx) => {
        const timing = timings[idx];
        const ms = typeof timing?.timeToCompleteMs === 'number' ? timing.timeToCompleteMs : 0;
        if (ms <= 0 || !Number.isFinite(ms)) return;
        
        // Distribute timing across letters in the group (approximate per-letter time)
        const sent = group?.sent || '';
        const perLetterMs = ms / Math.max(1, sent.length);
        
        for (const char of sent) {
          if (!timingByLetter[char]) {
            timingByLetter[char] = [];
          }
          timingByLetter[char].push(perLetterMs);
        }
      });
    });

    return Object.entries(timingByLetter)
      .map(([letter, samples]) => {
        const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
        return {
          letter,
          avgMs: Math.round(avg),
          minMs: Math.round(Math.min(...samples)),
          maxMs: Math.round(Math.max(...samples)),
          count: samples.length,
          samples,
        };
      })
      .sort((a, b) => b.avgMs - a.avgMs); // Slowest first
  }, [sessionsSorted]);

  // Combined letter performance: shared mastery bar + separate slow flag
  const letterPerformance = useMemo<LetterPerformance[]>(() => {
    const avgMsByLetter = new Map(letterTimingStats.map((t) => [t.letter, t.avgMs]));
    return buildCharacterDiagnostics({
      sessions: sessionsSorted,
      avgMsByLetter,
    });
  }, [sessionsSorted, letterTimingStats]);

  // Confusion matrix - what was typed when a letter was sent
  const confusionMatrix = useMemo<ConfusionEntry[]>(() => {
    const confusions: Record<string, Record<string, number>> = {};
    const totals: Record<string, number> = {};
    
    sessionsSorted.forEach((session) => {
      (session.groups || []).forEach((group) => {
        const sent = (group?.sent || '').toUpperCase();
        const received = (group?.received || '').toUpperCase();
        
        // Compare character by character
        const maxLen = Math.max(sent.length, received.length);
        for (let i = 0; i < maxLen; i++) {
          const sentChar = sent[i] || '';
          const typedChar = received[i] || '_'; // underscore for missing
          
          if (!sentChar) continue;
          
          if (!confusions[sentChar]) {
            confusions[sentChar] = {};
          }
          if (!confusions[sentChar][typedChar]) {
            confusions[sentChar][typedChar] = 0;
          }
          confusions[sentChar][typedChar]++;
          totals[sentChar] = (totals[sentChar] || 0) + 1;
        }
      });
    });

    // Convert to flat array, excluding correct matches
    const entries: ConfusionEntry[] = [];
    Object.entries(confusions).forEach(([sent, typedMap]) => {
      Object.entries(typedMap).forEach(([typed, count]) => {
        if (sent !== typed && count > 0) {
          entries.push({
            sent,
            typed,
            count,
            percentage: (count / (totals[sent] || 1)) * 100,
          });
        }
      });
    });

    return entries.sort((a, b) => b.count - a.count);
  }, [sessionsSorted]);

  // Letter trends over sessions (for sparklines)
  const letterTrends = useMemo<LetterTrend[]>(() => {
    const letterData: Record<string, Array<{ sessionIndex: number; correct: number; total: number; totalMs: number; msCount: number }>> = {};
    
    sessionsSorted.forEach((session, sessionIndex) => {
      const groups = session.groups || [];
      const timings = session.groupTimings || [];
      
      // Aggregate per letter for this session
      const sessionLetterData: Record<string, { correct: number; total: number; totalMs: number; msCount: number }> = {};
      
      groups.forEach((group, idx) => {
        const sent = (group?.sent || '').toUpperCase();
        const received = (group?.received || '').toUpperCase();
        const timing = timings[idx];
        const ms = typeof timing?.timeToCompleteMs === 'number' ? timing.timeToCompleteMs : 0;
        const perLetterMs = ms / Math.max(1, sent.length);
        
        for (let i = 0; i < sent.length; i++) {
          const sentChar = sent[i];
          const typedChar = received[i];
          if (!sentChar) continue;
          
          if (!sessionLetterData[sentChar]) {
            sessionLetterData[sentChar] = { correct: 0, total: 0, totalMs: 0, msCount: 0 };
          }
          sessionLetterData[sentChar].total++;
          if (sentChar === typedChar) {
            sessionLetterData[sentChar].correct++;
          }
          if (ms > 0 && Number.isFinite(perLetterMs)) {
            sessionLetterData[sentChar].totalMs += perLetterMs;
            sessionLetterData[sentChar].msCount++;
          }
        }
      });
      
      // Add to overall letter data
      Object.entries(sessionLetterData).forEach(([letter, data]) => {
        if (!letterData[letter]) {
          letterData[letter] = [];
        }
        letterData[letter].push({ sessionIndex, ...data });
      });
    });

    // Calculate trends
    return Object.entries(letterData).map(([letter, sessions]) => {
      const dataPoints = sessions.map((s) => ({
        sessionIndex: s.sessionIndex,
        accuracy: s.total > 0 ? (s.correct / s.total) * 100 : 0,
        avgMs: s.msCount > 0 ? s.totalMs / s.msCount : 0,
      }));
      
      // Determine trend by comparing first half to second half
      let trend: 'improving' | 'stable' | 'declining' = 'stable';
      if (dataPoints.length >= 4) {
        const mid = Math.floor(dataPoints.length / 2);
        const firstHalf = dataPoints.slice(0, mid);
        const secondHalf = dataPoints.slice(mid);
        const avgFirst = firstHalf.reduce((a, b) => a + b.accuracy, 0) / firstHalf.length;
        const avgSecond = secondHalf.reduce((a, b) => a + b.accuracy, 0) / secondHalf.length;
        
        if (avgSecond - avgFirst > 5) trend = 'improving';
        else if (avgFirst - avgSecond > 5) trend = 'declining';
      }
      
      return { letter, dataPoints, trend };
    });
  }, [sessionsSorted]);

  // Session fatigue analysis - accuracy/speed by position within session
  const sessionFatigue = useMemo<SessionFatiguePoint[]>(() => {
    const byPosition: Record<number, { correctCount: number; totalCount: number; totalMs: number; msCount: number }> = {};
    
    sessionsSorted.forEach((session) => {
      const groups = session.groups || [];
      const timings = session.groupTimings || [];
      
      groups.forEach((group, idx) => {
        if (!byPosition[idx]) {
          byPosition[idx] = { correctCount: 0, totalCount: 0, totalMs: 0, msCount: 0 };
        }
        
        byPosition[idx].totalCount++;
        if (group?.correct) {
          byPosition[idx].correctCount++;
        }
        
        const ms = timings[idx]?.timeToCompleteMs;
        if (typeof ms === 'number' && ms > 0 && Number.isFinite(ms)) {
          byPosition[idx].totalMs += ms;
          byPosition[idx].msCount++;
        }
      });
    });

    return Object.entries(byPosition)
      .map(([idx, data]) => ({
        groupIndex: parseInt(idx, 10),
        avgAccuracy: data.totalCount > 0 ? (data.correctCount / data.totalCount) * 100 : 0,
        avgMs: data.msCount > 0 ? Math.round(data.totalMs / data.msCount) : 0,
        sampleCount: data.totalCount,
      }))
      .sort((a, b) => a.groupIndex - b.groupIndex);
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
    // New analytics
    letterTimingStats,
    letterPerformance,
    confusionMatrix,
    letterTrends,
    sessionFatigue,
  };
}


