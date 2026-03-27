import { renderHook } from '@testing-library/react';

import { useStatsAnalytics } from '@/hooks/useStatsAnalytics';
import type { SessionResult } from '@/types';

const createMockSession = (overrides?: Partial<SessionResult>): SessionResult => ({
  date: '2025-01-01',
  timestamp: Date.now(),
  startedAt: Date.now() - 1000,
  finishedAt: Date.now(),
  groups: [],
  groupTimings: [],
  accuracy: 1,
  letterAccuracy: {},
  alphabetSize: 0,
  avgResponseMs: 0,
  totalChars: 0,
  effectiveAlphabetSize: 0,
  score: 100,
  ...overrides,
});

describe('useStatsAnalytics', () => {
  it('should return sorted sessions', () => {
    const sessions: SessionResult[] = [
      createMockSession({ timestamp: 2000, date: '2025-01-02' }),
      createMockSession({ timestamp: 1000, date: '2025-01-01' }),
      createMockSession({ timestamp: 3000, date: '2025-01-03' }),
    ];

    const { result } = renderHook(() => useStatsAnalytics(sessions));

    expect(result.current.sessionsSorted).toHaveLength(3);
    expect(result.current.sessionsSorted[0]?.timestamp).toBe(1000);
    expect(result.current.sessionsSorted[1]?.timestamp).toBe(2000);
    expect(result.current.sessionsSorted[2]?.timestamp).toBe(3000);
  });

  it('should generate chart data', () => {
    const sessions: SessionResult[] = [
      createMockSession({ timestamp: 1000, accuracy: 0.8 }),
      createMockSession({ timestamp: 2000, accuracy: 0.9 }),
    ];

    const { result } = renderHook(() => useStatsAnalytics(sessions));

    expect(result.current.chartData).toHaveLength(2);
    expect(result.current.chartData[0]?.accuracy).toBe(80);
    expect(result.current.chartData[1]?.accuracy).toBe(90);
    expect(result.current.chartData[0]?.timestamp).toBe(1000);
  });

  it('should generate activity sessions', () => {
    const sessions: SessionResult[] = [
      createMockSession({
        date: '2025-01-01',
        timestamp: 1000,
        groups: [{ sent: 'AB', received: 'AB', correct: true }],
      }),
      createMockSession({
        date: '2025-01-02',
        timestamp: 2000,
        groups: [
          { sent: 'CD', received: 'CD', correct: true },
          { sent: 'EF', received: 'EF', correct: true },
        ],
      }),
    ];

    const { result } = renderHook(() => useStatsAnalytics(sessions));

    expect(result.current.activitySessions).toHaveLength(2);
    expect(result.current.activitySessions[0]?.count).toBe(2); // 'AB' = 2 chars
    expect(result.current.activitySessions[1]?.count).toBe(4); // 'CD' + 'EF' = 4 chars
  });

  it('should calculate timing daily aggregates', () => {
    const sessions: SessionResult[] = [
      createMockSession({
        date: '2025-01-01',
        groupTimings: [{ timeToCompleteMs: 1000 }, { timeToCompleteMs: 2000 }],
      }),
      createMockSession({
        date: '2025-01-01',
        groupTimings: [{ timeToCompleteMs: 3000 }],
      }),
      createMockSession({
        date: '2025-01-02',
        groupTimings: [{ timeToCompleteMs: 4000 }],
      }),
    ];

    const { result } = renderHook(() => useStatsAnalytics(sessions));

    expect(result.current.timingDailyAgg).toHaveLength(2);
    expect(result.current.timingDailyAgg[0]?.date).toBe('2025-01-01');
    expect(result.current.timingDailyAgg[0]?.averageMs).toBe(2000); // (1000 + 2000 + 3000) / 3
    expect(result.current.timingDailyAgg[0]?.count).toBe(3);
    expect(result.current.timingDailyAgg[1]?.date).toBe('2025-01-02');
    expect(result.current.timingDailyAgg[1]?.averageMs).toBe(4000);
  });

  it('should create day index mappings', () => {
    const sessions: SessionResult[] = [
      createMockSession({
        date: '2025-01-01',
        groupTimings: [{ timeToCompleteMs: 1000 }],
      }),
      createMockSession({
        date: '2025-01-02',
        groupTimings: [{ timeToCompleteMs: 2000 }],
      }),
    ];

    const { result } = renderHook(() => useStatsAnalytics(sessions));

    expect(result.current.dayIndexByDate['2025-01-01']).toBe(0);
    expect(result.current.dayIndexByDate['2025-01-02']).toBe(1);
    expect(result.current.dayIndexToLabel[0]).toBe('2025-01-01');
    expect(result.current.dayIndexToLabel[1]).toBe('2025-01-02');
  });

  it('should generate timing sample points', () => {
    const sessions: SessionResult[] = [
      createMockSession({
        date: '2025-01-01',
        timestamp: 1000,
        groupTimings: [{ timeToCompleteMs: 1000 }, { timeToCompleteMs: 2000 }],
      }),
    ];

    const { result } = renderHook(() => useStatsAnalytics(sessions));

    expect(result.current.timingSamplesPoints.length).toBeGreaterThan(0);
    expect(result.current.timingSamplesPoints[0]?.ms).toBe(1000);
    expect(result.current.timingSamplesPoints[0]?.date).toBe('2025-01-01');
  });

  it('should calculate overall letter stats', () => {
    const sessions: SessionResult[] = [
      createMockSession({
        letterAccuracy: {
          A: { correct: 10, total: 10 },
          B: { correct: 5, total: 10 },
        },
      }),
      createMockSession({
        letterAccuracy: {
          A: { correct: 8, total: 10 },
          B: { correct: 7, total: 10 },
        },
      }),
    ];

    const { result } = renderHook(() => useStatsAnalytics(sessions));

    expect(result.current.overallLetterStats.length).toBeGreaterThan(0);
    const letterA = result.current.overallLetterStats.find((stat) => stat.letter === 'A');
    const letterB = result.current.overallLetterStats.find((stat) => stat.letter === 'B');

    expect(letterA).toBeDefined();
    expect(letterA?.correct).toBe(18); // 10 + 8
    expect(letterA?.total).toBe(20); // 10 + 10
    expect(letterA?.accuracy).toBe(90); // (18 / 20) * 100

    expect(letterB).toBeDefined();
    expect(letterB?.correct).toBe(12); // 5 + 7
    expect(letterB?.total).toBe(20); // 10 + 10
    expect(letterB?.accuracy).toBe(60); // (12 / 20) * 100
  });

  it('should handle empty sessions', () => {
    const { result } = renderHook(() => useStatsAnalytics([]));

    expect(result.current.sessionsSorted).toEqual([]);
    expect(result.current.chartData).toEqual([]);
    expect(result.current.activitySessions).toEqual([]);
    expect(result.current.timingDailyAgg).toEqual([]);
    expect(result.current.overallLetterStats).toEqual([]);
  });

  it('should filter out invalid timing values', () => {
    const sessions: SessionResult[] = [
      createMockSession({
        date: '2025-01-01',
        groupTimings: [
          { timeToCompleteMs: 1000 },
          { timeToCompleteMs: 0 }, // Invalid
          { timeToCompleteMs: -100 }, // Invalid
          { timeToCompleteMs: NaN }, // Invalid
        ],
      }),
    ];

    const { result } = renderHook(() => useStatsAnalytics(sessions));

    expect(result.current.timingDailyAgg[0]?.count).toBe(1); // Only valid timing
    expect(result.current.timingDailyAgg[0]?.averageMs).toBe(1000);
  });
});

