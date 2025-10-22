"use client";

import React, { useMemo, useRef, useState } from 'react';

export type ActivitySessionLite = {
  date: string; // YYYY-MM-DD in local time (already stored by app)
  timestamp: number;
  // Optional count payload allowing callers to represent arbitrary activity (e.g., characters trained)
  count?: number;
};

type ActivityHeatmapProps = {
  sessions: ActivitySessionLite[];
  monthsPerPage?: number; // default 3, used as initial value
  startOfWeek?: 0 | 1; // 0 = Sunday, 1 = Monday
  onSelectDate?: (dateYmd: string) => void; // optional day selection callback
  selectedDate?: string; // optional controlled selected date (YYYY-MM-DD)
};

type DayCell = {
  date: Date;
  key: string; // YYYY-MM-DD
  count: number;
};
type DayCellInMonth = DayCell & { inMonth: boolean };

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

function clampToEndOfToday(d: Date): Date {
  const now = new Date();
  const endToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return d > endToday ? endToday : d;
}

function computeColorForCount(count: number, maxCount: number): string {
  if (count <= 0) return '#e5e7eb'; // slate-200
  const n = Math.min(1, count / Math.max(1, maxCount));
  // Hue 0 (red) to 120 (green), keep fairly saturated and medium lightness
  const hue = 120 * n; // 0 -> red, 120 -> green
  return `hsl(${hue}, 75%, 45%)`;
}

export const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({ sessions, monthsPerPage = 3, startOfWeek = 1, onSelectDate, selectedDate }) => {
  // Build date->count map once
  const countByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of sessions) {
      const key = s.date; // already in YYYY-MM-DD
      const inc = typeof s.count === 'number' && isFinite(s.count) ? s.count : 1;
      map.set(key, (map.get(key) || 0) + inc);
    }
    return map;
  }, [sessions]);

  const [monthsToShow, setMonthsToShow] = useState(Math.max(1, monthsPerPage || 3));
  const [anchorMonthStart, setAnchorMonthStart] = useState<Date>(startOfMonth(new Date())); // latest month in window
  const [selectedLocalYmd, setSelectedLocalYmd] = useState<string | null>(selectedDate ?? null);
  const [autoFit, setAutoFit] = useState<boolean>(true);
  const monthsContainerRef = useRef<HTMLDivElement | null>(null);

  // Compute visible window: months blocks (separate mini-heatmaps per month)
  const { monthsBlocks, maxCountInWindow } = useMemo(() => {
    // Build ascending month starts for the window (oldest on the left)
    const starts: Date[] = [];
    for (let i = monthsToShow - 1; i >= 0; i--) {
      starts.push(addMonths(anchorMonthStart, -i));
    }

    const blocks: Array<{ label: string; yearMonthKey: string; weeks: DayCellInMonth[][] }> = [];
    const maxRef = { v: 0 };

    for (const mStart of starts) {
      const mEnd = endOfMonth(mStart);
      const weekStart = getWeekStart(mStart, startOfWeek);
      const lastWeekStart = getWeekStart(mEnd, startOfWeek);
      const lastWeekEnd = new Date(lastWeekStart.getFullYear(), lastWeekStart.getMonth(), lastWeekStart.getDate() + 6);

      const weeks: DayCellInMonth[][] = [];
      let cursor = new Date(weekStart);
      while (cursor <= lastWeekEnd) {
        const col: DayCellInMonth[] = [];
        for (let i = 0; i < 7; i++) {
          const d = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + i);
          const key = formatYmd(d);
          const inMonth = d >= mStart && d <= mEnd;
          const count = inMonth ? (countByDate.get(key) || 0) : 0;
          if (inMonth && count > maxRef.v) maxRef.v = count;
          col.push({ date: d, key, count, inMonth });
        }
        weeks.push(col);
        cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 7);
      }

      const label = `${mStart.toLocaleString(undefined, { month: 'short' })} ${mStart.getFullYear()}`;
      const yearMonthKey = `${mStart.getFullYear()}-${String(mStart.getMonth() + 1).padStart(2, '0')}`;
      blocks.push({ label, yearMonthKey, weeks });
    }

    return { monthsBlocks: blocks, maxCountInWindow: Math.max(1, maxRef.v) };
  }, [countByDate, monthsToShow, anchorMonthStart, startOfWeek]);

  const canGoForward = useMemo(() => {
    // Cannot move beyond current month
    const currentMonthStart = startOfMonth(new Date());
    return anchorMonthStart.getFullYear() < currentMonthStart.getFullYear() ||
      (anchorMonthStart.getFullYear() === currentMonthStart.getFullYear() && anchorMonthStart.getMonth() < currentMonthStart.getMonth());
  }, [anchorMonthStart]);

  const canGoBackward = true; // allow exploring older months

  // Legend values: 0, ceil(max/3), ceil(2*max/3), max
  const legendStops = useMemo(() => {
    const step = Math.max(1, Math.ceil(maxCountInWindow / 3));
    return [0, step, step * 2, maxCountInWindow];
  }, [maxCountInWindow]);

  const weekdayLabels = useMemo(() => {
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

  const handleCellClick = (ymd: string) => {
    if (onSelectDate) onSelectDate(ymd);
    if (selectedDate === undefined) setSelectedLocalYmd(ymd);
  };

  const handlePrev = () => {
    setAnchorMonthStart(prev => addMonths(prev, -monthsToShow));
  };
  const handleNext = () => {
    setAnchorMonthStart(prev => {
      const candidate = addMonths(prev, monthsToShow);
      const current = startOfMonth(new Date());
      if (candidate > current) return current;
      return candidate;
    });
  };

  const handleJumpMonthChange = (value: string) => {
    // value format YYYY-MM
    if (!value) return;
    const [y, m] = value.split('-').map(x => parseInt(x, 10));
    if (!y || !m) return;
    const target = new Date(y, m - 1, 1);
    const current = startOfMonth(new Date());
    setAnchorMonthStart(target > current ? current : target);
  };

  // Auto-fit number of months to available width (largest that fits up to 12)
  React.useEffect(() => {
    if (!autoFit) return;
    const el = monthsContainerRef.current;
    if (!el) return;

    const CELL = 12; // px cell width per column
    const COL_GAP = 2; // px between week columns
    const MONTH_GAP = 16; // px between month blocks (matches inline style)

    const computeNumWeeks = (mStart: Date): number => {
      const mEnd = endOfMonth(mStart);
      const weekStart = getWeekStart(mStart, startOfWeek);
      const lastWeekStart = getWeekStart(mEnd, startOfWeek);
      const weeks = Math.floor((lastWeekStart.getTime() - weekStart.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
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

    const measureAndSet = () => {
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

    let ro: any = null;
    try {
      const RO = (window as any).ResizeObserver;
      if (RO) {
        ro = new RO(() => measureAndSet());
        ro.observe(el);
      }
    } catch {}
    // Run once
    measureAndSet();
    return () => { try { ro && ro.disconnect(); } catch {} };
  }, [autoFit, anchorMonthStart, startOfWeek, monthsToShow]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/70 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700">Activity (characters per day)</h3>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 text-[11px]">
            <label className="inline-flex items-center gap-1">
              <input
                type="checkbox"
                className="rounded border-slate-300"
                checked={autoFit}
                onChange={(e) => setAutoFit(e.target.checked)}
              />
              <span className="text-slate-600">Auto-fit</span>
            </label>
            {!autoFit && (
              <>
                <span className="text-slate-600">Show</span>
                <select
                  className="px-2 py-1 text-xs rounded-md border border-slate-300 text-slate-700"
                  value={monthsToShow}
                  onChange={(e) => setMonthsToShow(Math.max(1, parseInt(e.target.value || '3', 10)))}
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
              max={`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`}
              value={`${anchorMonthStart.getFullYear()}-${String(anchorMonthStart.getMonth() + 1).padStart(2, '0')}`}
              onChange={(e) => handleJumpMonthChange(e.target.value)}
            />
          </div>
          <button
            className="px-2 py-1 text-xs rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
            onClick={handlePrev}
            disabled={!canGoBackward}
          >Prev</button>
          <button
            className={`px-2 py-1 text-xs rounded-md border ${canGoForward ? 'border-slate-300 text-slate-700 hover:bg-slate-50' : 'border-slate-200 text-slate-400 bg-slate-50'}`}
            onClick={handleNext}
            disabled={!canGoForward}
          >Next</button>
        </div>
      </div>

      <div className="flex mt-1">
        {/* Weekday labels */}
        <div className="mr-2 text-[10px] text-slate-500 flex flex-col justify-between py-1">
          <span>{weekdayLabels[0]}</span>
          <span>{weekdayLabels[2]}</span>
          <span>{weekdayLabels[4]}</span>
        </div>

        {/* Month blocks: each with its own grid (columns = weeks, rows fixed 7 with invisible placeholders) */}
        <div ref={monthsContainerRef} className="flex flex-1 min-w-0 overflow-x-auto" style={{ gap: 16 }}>
          {monthsBlocks.map((block) => (
            <div key={block.yearMonthKey} className="flex flex-col">
              <div className="text-[11px] text-slate-600 font-medium mb-1">
                {block.label}
              </div>
              <div className="flex" style={{ gap: 2 }}>
                {block.weeks.map((week, wi) => (
                  <div key={wi} className="flex flex-col" style={{ gap: 2 }}>
                    {week.map((cell, di) => {
                      const color = computeColorForCount(cell.count, maxCountInWindow);
                      if (!cell.inMonth) {
                        return (
                          <div key={`${cell.key}-placeholder`} className="w-3 h-3 rounded-sm invisible" />
                        );
                      }
                      const title = `${cell.date.toLocaleDateString()} — ${cell.count} ${cell.count === 1 ? 'character' : 'characters'}`;
                      const isSelected = selectedLocalYmd === cell.key;
                      return (
                        <div
                          key={cell.key}
                          className={`w-3 h-3 rounded-sm border hover:scale-110 transition-transform duration-75 ${isSelected ? 'border-emerald-500' : 'border-white/40'}`}
                          style={{ backgroundColor: color, boxShadow: isSelected ? '0 0 0 1px rgba(16,185,129,0.6)' : undefined }}
                          title={title}
                          aria-label={title}
                          onClick={() => handleCellClick(cell.key)}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 flex items-center justify-end gap-2 text-[10px] text-slate-500">
        <span>Less</span>
        <div className="flex items-center gap-1">
          {legendStops.map((v, i) => (
            <div key={i} className="w-3 h-3 rounded-sm border border-white/40" style={{ backgroundColor: computeColorForCount(v, maxCountInWindow) }} title={`${v} characters`} />
          ))}
        </div>
        <span>More</span>
      </div>
    </div>
  );
};

export default ActivityHeatmap;


