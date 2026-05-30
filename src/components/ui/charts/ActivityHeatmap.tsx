'use client';

import React, { useMemo, useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

import { useHasMounted } from '@/hooks/useHasMounted';
import {
  ACCURACY_LEGEND_STOPS,
  type ActivityHeatmapColorMode,
  computeActivityCellColor,
  formatAccuracyLegendLabel,
  volumeLegendStops,
} from '@/lib/charts/activityHeatmapColors';
import type { HeatmapSession } from '@/types';

type TooltipData = {
  date: Date;
  count: number;
  sessionCount: number;
  avgDurationMs?: number | undefined;
  avgGroupCount?: number | undefined;
  avgAccuracy?: number | undefined;
};

type DayCellWithTooltip = DayCellInMonth;

function CellWithTooltip({
  cell,
  color,
  colorMode,
  isSelected,
  onCellClick,
  formatDate,
}: {
  cell: DayCellWithTooltip;
  color: string;
  colorMode: ActivityHeatmapColorMode;
  isSelected: boolean;
  onCellClick: (key: string) => void;
  formatDate: (d: Date) => string;
}): JSX.Element {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const cellRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (showTooltip && cellRef.current) {
      const updatePosition = (): void => {
        if (!cellRef.current) return;
        const rect = cellRef.current.getBoundingClientRect();
        const tooltipHeight = 200; // approximate tooltip height
        const tooltipWidth = 250; // approximate tooltip width
        
        // Position above the cell, centered
        let top = rect.top - tooltipHeight - 8;
        let left = rect.left + rect.width / 2 - tooltipWidth / 2;
        
        // Adjust if tooltip would go off-screen
        if (top < 0) {
          top = rect.bottom + 8; // Show below instead
        }
        if (left < 8) {
          left = 8;
        }
        if (left + tooltipWidth > window.innerWidth - 8) {
          left = window.innerWidth - tooltipWidth - 8;
        }
        
        setTooltipPosition({ top, left });
      };
      
      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      
      return (): void => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [showTooltip]);
  
  return (
    <>
      <div
        ref={cellRef}
        className="relative"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <div
          className={`w-3 h-3 rounded-sm border hover:scale-110 transition-transform duration-75 ${isSelected ? 'border-emerald-500' : 'border-white/40'}`}
          style={{
            backgroundColor: color,
            boxShadow: isSelected ? '0 0 0 1px rgba(16,185,129,0.6)' : undefined,
          }}
          aria-label={
            colorMode === 'accuracy' && cell.avgAccuracy !== undefined
              ? `${formatDate(cell.date)} — ${(cell.avgAccuracy * 100).toFixed(1)}% accuracy, ${cell.sessionCount} sessions`
              : `${formatDate(cell.date)} — ${cell.count} characters, ${cell.sessionCount} sessions`
          }
          onClick={() => onCellClick(cell.key)}
        />
      </div>
      {showTooltip && typeof window !== 'undefined' && createPortal(
        <div
          ref={tooltipRef}
          className="fixed z-[9999] pointer-events-none"
          style={{
            top: `${tooltipPosition.top}px`,
            left: `${tooltipPosition.left}px`,
            maxWidth: '250px',
          }}
        >
          <ActivityTooltip
            data={{
              date: cell.date,
              count: cell.count,
              sessionCount: cell.sessionCount,
              ...(cell.avgDurationMs !== undefined ? { avgDurationMs: cell.avgDurationMs } : {}),
              ...(cell.avgGroupCount !== undefined ? { avgGroupCount: cell.avgGroupCount } : {}),
              ...(cell.avgAccuracy !== undefined ? { avgAccuracy: cell.avgAccuracy } : {}),
            }}
            formatDate={formatDate}
          />
        </div>,
        document.body
      )}
    </>
  );
}

function ActivityTooltip({ data, formatDate }: { data: TooltipData; formatDate: (d: Date) => string }): JSX.Element {
  const { date, count, sessionCount, avgDurationMs, avgGroupCount, avgAccuracy } = data;
  
  const totalGroups = avgGroupCount ? Math.round(avgGroupCount * sessionCount) : 0;
  const charsPerGroup = totalGroups > 0 ? Math.round((count / totalGroups) * 10) / 10 : 0;
  const avgDurationMin = avgDurationMs ? Math.round(avgDurationMs / 60000 * 10) / 10 : 0;
  const avgAccuracyPercent = avgAccuracy !== undefined ? Math.round(avgAccuracy * 1000) / 10 : undefined;
  
  // Calculate max values for scaling visualizations
  const maxChars = Math.max(count, 100);
  const maxGroups = Math.max(totalGroups, 20);
  const maxDuration = Math.max(avgDurationMin, 10);
  
  const charBarWidth = Math.min(100, (count / maxChars) * 100);
  const groupsBarWidth = totalGroups > 0 ? Math.min(100, (totalGroups / maxGroups) * 100) : 0;
  const durationBarWidth = avgDurationMin > 0 ? Math.min(100, (avgDurationMin / maxDuration) * 100) : 0;
  const accuracyBarWidth = avgAccuracyPercent !== undefined ? Math.min(100, avgAccuracyPercent) : 0;
  
  return (
    <div className="bg-white border border-slate-300 rounded-lg shadow-xl p-3 min-w-[200px]">
      <div className="text-sm font-semibold text-slate-800 mb-2 border-b border-slate-200 pb-1">
        {formatDate(date)}
      </div>
      
      <div className="space-y-2 text-xs">
        {/* Characters visualization */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-slate-600">Characters</span>
            <span className="font-semibold text-slate-800">{count}</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${charBarWidth}%` }}
            />
          </div>
        </div>
        
        {/* Sessions visualization */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-slate-600">Sessions</span>
            <span className="font-semibold text-slate-800">{sessionCount}</span>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: Math.min(sessionCount, 20) }).map((_, i) => (
              <div
                key={i}
                className="h-3 flex-1 bg-green-500 rounded"
                style={{ 
                  opacity: i < sessionCount ? 1 : 0.3,
                  maxWidth: '8px'
                }}
              />
            ))}
            {sessionCount > 20 && (
              <span className="text-slate-500 ml-1">+{sessionCount - 20}</span>
            )}
          </div>
        </div>
        
        {/* Groups visualization */}
        {avgGroupCount !== undefined && totalGroups > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-slate-600">Groups</span>
              <span className="font-semibold text-slate-800">
                {totalGroups} total (~{avgGroupCount.toFixed(1)}/session)
              </span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-purple-500 rounded-full transition-all"
                style={{ width: `${groupsBarWidth}%` }}
              />
            </div>
            {charsPerGroup > 0 && (
              <div className="text-slate-500 mt-0.5">~{charsPerGroup} chars/group</div>
            )}
          </div>
        )}
        
        {/* Duration visualization */}
        {avgDurationMs !== undefined && avgDurationMin > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-slate-600">Duration</span>
              <span className="font-semibold text-slate-800">~{avgDurationMin} min avg</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-orange-500 rounded-full transition-all"
                style={{ width: `${durationBarWidth}%` }}
              />
            </div>
          </div>
        )}
        
        {/* Accuracy visualization */}
        {avgAccuracyPercent !== undefined && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-slate-600">Accuracy</span>
              <span className="font-semibold text-slate-800">{avgAccuracyPercent.toFixed(1)}% avg</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${accuracyBarWidth}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

type ActivityHeatmapProps = {
  sessions: readonly HeatmapSession[];
  monthsPerPage?: number; // default 3, used as initial value
  startOfWeek?: 0 | 1; // 0 = Sunday, 1 = Monday
  onSelectDate?: (dateYmd: string) => void; // optional day selection callback
  selectedDate?: string; // optional controlled selected date (YYYY-MM-DD)
};

type DayCell = {
  date: Date;
  key: string; // YYYY-MM-DD
  count: number;
  sessionCount: number;
  avgDurationMs?: number | undefined; // average session duration in milliseconds
  avgGroupCount?: number | undefined; // average number of groups per session
  avgAccuracy?: number | undefined; // average accuracy (0-1)
};
type DayCellInMonth = DayCell & { inMonth: boolean };

type MonthBlock = {
  readonly label: string;
  readonly yearMonthKey: string;
  readonly weeks: DayCellInMonth[][];
};

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function addMonths(d: Date, delta: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + delta, d.getDate());
}

function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}

function getWeekStart(d: Date, startOfWeek: 0 | 1): Date {
  const day = d.getDay(); // 0..6 (Sun..Sat)
  const offset = startOfWeek === 1 ? (day === 0 ? 6 : day - 1) : day;
  const res = new Date(d);
  res.setDate(d.getDate() - offset);
  res.setHours(0, 0, 0, 0);
  return res;
}

/** Stable anchor for SSR/first paint so month labels match between server and client. */
const HYDRATION_PLACEHOLDER_ANCHOR = new Date(2020, 0, 1);

export function ActivityHeatmap({
  sessions,
  monthsPerPage = 3,
  startOfWeek = 1,
  onSelectDate,
  selectedDate,
}: ActivityHeatmapProps): JSX.Element {
  // Build date->count, date->sessionCount, and aggregated stats maps once
  const { countByDate, sessionCountByDate, durationByDate, groupCountByDate, accuracyByDate } = useMemo(() => {
    const countMap = new Map<string, number>();
    const sessionMap = new Map<string, number>();
    const durationMap = new Map<string, number[]>(); // array of durations per date
    const groupCountMap = new Map<string, number[]>(); // array of group counts per date
    const accuracyMap = new Map<string, number[]>(); // array of accuracies per date
    for (const s of sessions) {
      const key = s.date; // already in YYYY-MM-DD
      const inc = typeof s.count === 'number' && isFinite(s.count) ? s.count : 1;
      countMap.set(key, (countMap.get(key) || 0) + inc);
      sessionMap.set(key, (sessionMap.get(key) || 0) + 1);
      
      // Track durations and group counts for averaging
      if (typeof s.durationMs === 'number' && isFinite(s.durationMs) && s.durationMs > 0) {
        const durations = durationMap.get(key) || [];
        durations.push(s.durationMs);
        durationMap.set(key, durations);
      }
      if (typeof s.groupCount === 'number' && isFinite(s.groupCount) && s.groupCount > 0) {
        const counts = groupCountMap.get(key) || [];
        counts.push(s.groupCount);
        groupCountMap.set(key, counts);
      }
      // Track accuracies for averaging
      if (typeof s.accuracy === 'number' && isFinite(s.accuracy) && s.accuracy >= 0 && s.accuracy <= 1) {
        const accuracies = accuracyMap.get(key) || [];
        accuracies.push(s.accuracy);
        accuracyMap.set(key, accuracies);
      }
    }
    return { countByDate: countMap, sessionCountByDate: sessionMap, durationByDate: durationMap, groupCountByDate: groupCountMap, accuracyByDate: accuracyMap };
  }, [sessions]);

  const [monthsToShow, setMonthsToShow] = useState(Math.max(1, monthsPerPage || 3));
  const [anchorMonthStart, setAnchorMonthStart] = useState<Date>(() =>
    startOfMonth(HYDRATION_PLACEHOLDER_ANCHOR),
  );
  const [selectedLocalYmd, setSelectedLocalYmd] = useState<string | null>(selectedDate ?? null);
  const [autoFit, setAutoFit] = useState<boolean>(true);
  const [colorMode, setColorMode] = useState<ActivityHeatmapColorMode>('volume');
  const monthsContainerRef = useRef<HTMLDivElement | null>(null);
  const hasMounted = useHasMounted();

  useEffect(() => {
    setAnchorMonthStart(startOfMonth(new Date()));
  }, []);
  const formatDate = useMemo(
    (): ((d: Date) => string) =>
      (d) => (hasMounted ? d.toLocaleDateString() : formatYmd(d)),
    [hasMounted],
  );
  const formatMonthLabel = useMemo(
    (): ((d: Date) => string) =>
      (d) =>
        hasMounted
          ? `${d.toLocaleString(undefined, { month: 'short' })} ${d.getFullYear()}`
          : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
    [hasMounted],
  );

  const layoutAnchorMonthStart = hasMounted
    ? anchorMonthStart
    : startOfMonth(HYDRATION_PLACEHOLDER_ANCHOR);

  // Compute visible window: months blocks (separate mini-heatmaps per month)
  const { monthsBlocks, maxCountInWindow } = useMemo<{
    monthsBlocks: MonthBlock[];
    maxCountInWindow: number;
  }>(() => {
    // Build ascending month starts for the window (oldest on the left)
    const starts: Date[] = [];
    for (let i = monthsToShow - 1; i >= 0; i--) {
      starts.push(addMonths(layoutAnchorMonthStart, -i));
    }

    const blocks: Array<{ label: string; yearMonthKey: string; weeks: DayCellInMonth[][] }> = [];
    const maxRef = { v: 0 };

    for (const mStart of starts) {
      const mEnd = endOfMonth(mStart);
      const weekStart = getWeekStart(mStart, startOfWeek);
      const lastWeekStart = getWeekStart(mEnd, startOfWeek);
      const lastWeekEnd = new Date(
        lastWeekStart.getFullYear(),
        lastWeekStart.getMonth(),
        lastWeekStart.getDate() + 6,
      );

      const weeks: DayCellInMonth[][] = [];
      let cursor = new Date(weekStart);
      while (cursor <= lastWeekEnd) {
        const col: DayCellInMonth[] = [];
        for (let i = 0; i < 7; i++) {
          const d = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + i);
          const key = formatYmd(d);
          const inMonth = d >= mStart && d <= mEnd;
          const count = inMonth ? countByDate.get(key) || 0 : 0;
          const sessionCount = inMonth ? sessionCountByDate.get(key) || 0 : 0;
          
          // Calculate averages for durations, group counts, and accuracy
          let avgDurationMs: number | undefined;
          let avgGroupCount: number | undefined;
          let avgAccuracy: number | undefined;
          if (inMonth && sessionCount > 0) {
            const durations = durationByDate.get(key);
            if (durations && durations.length > 0) {
              avgDurationMs = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
            }
            const groupCounts = groupCountByDate.get(key);
            if (groupCounts && groupCounts.length > 0) {
              avgGroupCount = Math.round((groupCounts.reduce((a, b) => a + b, 0) / groupCounts.length) * 10) / 10; // round to 1 decimal
            }
            const accuracies = accuracyByDate.get(key);
            if (accuracies && accuracies.length > 0) {
              avgAccuracy = Math.round((accuracies.reduce((a, b) => a + b, 0) / accuracies.length) * 1000) / 1000; // round to 3 decimals
            }
          }
          
          if (inMonth && count > maxRef.v) maxRef.v = count;
          col.push({ 
            date: d, 
            key, 
            count, 
            sessionCount, 
            ...(avgDurationMs !== undefined ? { avgDurationMs } : {}),
            ...(avgGroupCount !== undefined ? { avgGroupCount } : {}),
            ...(avgAccuracy !== undefined ? { avgAccuracy } : {}),
            inMonth 
          });
        }
        weeks.push(col);
        cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 7);
      }

      const label = formatMonthLabel(mStart);
      const yearMonthKey = `${mStart.getFullYear()}-${String(mStart.getMonth() + 1).padStart(2, '0')}`;
      blocks.push({ label, yearMonthKey, weeks });
    }

    return { monthsBlocks: blocks, maxCountInWindow: Math.max(1, maxRef.v) };
  }, [
    countByDate,
    sessionCountByDate,
    durationByDate,
    groupCountByDate,
    accuracyByDate,
    monthsToShow,
    layoutAnchorMonthStart,
    startOfWeek,
    formatMonthLabel,
  ]);

  const canGoForward = useMemo<boolean>(() => {
    if (!hasMounted) {
      return false;
    }
    // Cannot move beyond current month
    const currentMonthStart = startOfMonth(new Date());
    return (
      anchorMonthStart.getFullYear() < currentMonthStart.getFullYear() ||
      (anchorMonthStart.getFullYear() === currentMonthStart.getFullYear() &&
        anchorMonthStart.getMonth() < currentMonthStart.getMonth())
    );
  }, [anchorMonthStart, hasMounted]);

  const canGoBackward = true; // allow exploring older months

  const volumeLegendValues = useMemo(
    () => volumeLegendStops(maxCountInWindow),
    [maxCountInWindow],
  );

  const chartTitle =
    colorMode === 'volume' ? 'Activity (characters per day)' : 'Activity (accuracy per day)';

  const weekdayLabels = useMemo<string[]>(() => {
    const namesMon = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const namesSun = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return startOfWeek === 1 ? namesMon : namesSun;
  }, [startOfWeek]);

  // Sync local selected state when controlled value provided
  React.useEffect(() => {
    if (selectedDate !== undefined) {
      setSelectedLocalYmd(selectedDate);
    }
  }, [selectedDate]);

  const handleCellClick = (ymd: string): void => {
    if (onSelectDate) onSelectDate(ymd);
    if (selectedDate === undefined) setSelectedLocalYmd(ymd);
  };

  const handlePrev = (): void => {
    setAnchorMonthStart((prev) => addMonths(prev, -monthsToShow));
  };
  const handleNext = (): void => {
    setAnchorMonthStart((prev) => {
      const candidate = addMonths(prev, monthsToShow);
      const current = startOfMonth(new Date());
      if (candidate > current) return current;
      return candidate;
    });
  };

  const handleJumpMonthChange = (value: string): void => {
    // value format YYYY-MM
    if (!value) return;
    const [y, m] = value.split('-').map((x) => parseInt(x, 10));
    if (!y || !m) return;
    const target = new Date(y, m - 1, 1);
    const current = startOfMonth(new Date());
    setAnchorMonthStart(target > current ? current : target);
  };

  // Auto-fit number of months to available width (largest that fits up to 12)
  React.useEffect(() => {
    if (!hasMounted || !autoFit) return;
    const el = monthsContainerRef.current;
    if (!el) return;

    const CELL = 12; // px cell width per column
    const COL_GAP = 2; // px between week columns
    const MONTH_GAP = 16; // px between month blocks (matches inline style)

    const computeNumWeeks = (mStart: Date): number => {
      const mEnd = endOfMonth(mStart);
      const weekStart = getWeekStart(mStart, startOfWeek);
      const lastWeekStart = getWeekStart(mEnd, startOfWeek);
      const weeks =
        Math.floor((lastWeekStart.getTime() - weekStart.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
      return Math.max(4, Math.min(6, weeks)); // clamp to sensible range
    };

    const totalWidthForMonths = (count: number): number => {
      const starts: Date[] = [];
      for (let i = count - 1; i >= 0; i--) starts.push(addMonths(anchorMonthStart, -i));
      let w = 0;
      starts.forEach((s, idx) => {
        const weeks = computeNumWeeks(s);
        const block = weeks * CELL + (weeks - 1) * COL_GAP;
        w += block;
        if (idx < starts.length - 1) w += MONTH_GAP;
      });
      return w;
    };

    const measureAndSet = (): void => {
      // account for vertical weekday label column (approx 28px) and outer paddings
      const weekdayLabelReserve = 28;
      const containerWidth = (el.parentElement ? el.parentElement.clientWidth : el.clientWidth) - 4;
      const available = Math.max(0, containerWidth - weekdayLabelReserve);
      let best = 1;
      for (let candidate = 12; candidate >= 1; candidate--) {
        if (totalWidthForMonths(candidate) <= available) {
          best = candidate;
          break;
        }
      }
      if (best !== monthsToShow) setMonthsToShow(best);
    };

    let ro: ResizeObserver | null = null;
    if (typeof window !== 'undefined' && 'ResizeObserver' in window) {
      ro = new ResizeObserver(() => measureAndSet());
      ro.observe(el);
    }
    // Run once
    measureAndSet();
    return (): void => {
      try {
        ro?.disconnect();
      } catch {}
    };
  }, [autoFit, anchorMonthStart, startOfWeek, monthsToShow, hasMounted]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/70 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700">{chartTitle}</h3>
        <div className="flex items-center gap-2 flex-wrap">
          <div
            className="inline-flex rounded-md border border-slate-300 overflow-hidden text-[11px]"
            role="group"
            aria-label="Heatmap color mode"
          >
            {(['volume', 'accuracy'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={colorMode === mode}
                className={`px-2 py-1 capitalize ${
                  colorMode === mode
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-slate-700 hover:bg-slate-50'
                }`}
                onClick={() => setColorMode(mode)}
              >
                {mode}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <label className="inline-flex items-center gap-1">
              <input
                type="checkbox"
                className="rounded border-slate-300"
                checked={autoFit}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  setAutoFit(event.target.checked)
                }
              />
              <span className="text-slate-600">Auto-fit</span>
            </label>
            {!autoFit && (
              <>
                <span className="text-slate-600">Show</span>
                <select
                  className="px-2 py-1 text-xs rounded-md border border-slate-300 text-slate-700"
                  value={monthsToShow}
                  onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                    setMonthsToShow(Math.max(1, parseInt(event.target.value || '3', 10)))
                  }
                >
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                  <option value={5}>5</option>
                  <option value={6}>6</option>
                  <option value={9}>9</option>
                  <option value={12}>12</option>
                </select>
                <span className="text-slate-600">months</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1 text-[11px]">
            <span className="text-slate-600">Jump to</span>
            <input
              type="month"
              className="px-2 py-1 text-xs rounded-md border border-slate-300 text-slate-700"
              max={
                hasMounted
                  ? `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
                  : '2020-12'
              }
              value={`${layoutAnchorMonthStart.getFullYear()}-${String(layoutAnchorMonthStart.getMonth() + 1).padStart(2, '0')}`}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                handleJumpMonthChange(event.target.value)
              }
            />
          </div>
          <button
            className="px-2 py-1 text-xs rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
            onClick={handlePrev}
            disabled={!canGoBackward}
          >
            Prev
          </button>
          <button
            className={`px-2 py-1 text-xs rounded-md border ${canGoForward ? 'border-slate-300 text-slate-700 hover:bg-slate-50' : 'border-slate-200 text-slate-400 bg-slate-50'}`}
            onClick={handleNext}
            disabled={!canGoForward}
          >
            Next
          </button>
        </div>
      </div>

      <div className="flex mt-1">
        {/* Weekday labels */}
        <div className="mr-2 text-[10px] text-slate-500 flex flex-col justify-between py-1">
          <span>{weekdayLabels[0]}</span>
          <span>{weekdayLabels[2]}</span>
          <span>{weekdayLabels[4]}</span>
        </div>

        {/* Month blocks: calendar cells use local TZ — render only after mount to avoid SSR/client text mismatch (#418). */}
        <div
          ref={monthsContainerRef}
          className="flex flex-1 min-w-0 overflow-x-auto"
          style={{ gap: 16 }}
          aria-busy={!hasMounted}
        >
          {monthsBlocks.map((block) => (
            <div key={block.yearMonthKey} className="flex flex-col">
              <div className="text-[11px] text-slate-600 font-medium mb-1">{block.label}</div>
              {hasMounted ? (
                <div className="flex" style={{ gap: 2 }}>
                  {block.weeks.map((week, wi) => (
                    <div key={wi} className="flex flex-col" style={{ gap: 2 }}>
                      {week.map((cell) => {
                        const color = computeActivityCellColor(colorMode, {
                          count: cell.count,
                          sessionCount: cell.sessionCount,
                          maxCountInWindow,
                          ...(cell.avgAccuracy !== undefined
                            ? { avgAccuracy: cell.avgAccuracy }
                            : {}),
                        });
                        if (!cell.inMonth) {
                          return (
                            <div
                              key={`${cell.key}-placeholder`}
                              className="w-3 h-3 rounded-sm invisible"
                            />
                          );
                        }
                        const isSelected = selectedLocalYmd === cell.key;
                        return (
                          <CellWithTooltip
                            key={cell.key}
                            cell={cell}
                            color={color}
                            colorMode={colorMode}
                            isSelected={isSelected}
                            onCellClick={handleCellClick}
                            formatDate={formatDate}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  className="flex rounded-sm bg-slate-100/80"
                  style={{ gap: 2, width: 52, height: 84 }}
                  aria-hidden
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 flex items-center justify-end gap-2 text-[10px] text-slate-500">
        <span>{colorMode === 'volume' ? 'Less' : 'Lower'}</span>
        <div className="flex items-center gap-1">
          {colorMode === 'volume'
            ? volumeLegendValues.map((v, i) => (
                <div
                  key={i}
                  className="w-3 h-3 rounded-sm border border-white/40"
                  style={{
                    backgroundColor: computeActivityCellColor('volume', {
                      count: v,
                      sessionCount: v > 0 ? 1 : 0,
                      maxCountInWindow,
                    }),
                  }}
                  title={`${v} characters`}
                />
              ))
            : ACCURACY_LEGEND_STOPS.map((v, i) => (
                <div
                  key={i}
                  className="w-3 h-3 rounded-sm border border-white/40"
                  style={{
                    backgroundColor: computeActivityCellColor('accuracy', {
                      count: 0,
                      sessionCount: 1,
                      maxCountInWindow,
                      avgAccuracy: v,
                    }),
                  }}
                  title={formatAccuracyLegendLabel(v)}
                />
              ))}
        </div>
        <span>{colorMode === 'volume' ? 'More' : 'Higher'}</span>
        {colorMode === 'accuracy' && (
          <span className="text-slate-400 ml-1">(no practice = gray)</span>
        )}
      </div>
    </div>
  );
}
