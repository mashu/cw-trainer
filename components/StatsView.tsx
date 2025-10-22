import React, { useMemo, useState } from 'react';
import { KOCH_SEQUENCE } from '@/lib/morseConstants';
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Line, BarChart, Bar, Brush, ReferenceLine, ComposedChart, Scatter } from 'recharts';

interface SessionGroup {
  sent: string;
  received: string;
  correct: boolean;
}

export interface SessionResult {
  date: string;
  timestamp: number;
  groups: SessionGroup[];
  groupTimings?: Array<{ timeToCompleteMs: number }>; // optional per-group response time
  accuracy: number;
  letterAccuracy: Record<string, { correct: number; total: number }>;
}

interface StatsViewProps {
  sessionResults: SessionResult[];
  onBack: () => void;
  onDelete: (timestamp: number) => void;
  thresholdPercent?: number; // reference line threshold (0..100)
}

const StatsView: React.FC<StatsViewProps> = ({ sessionResults, onBack, onDelete, thresholdPercent }) => {
  const [selectedSessionTs, setSelectedSessionTs] = useState<number | null>(null);
  const [range, setRange] = useState<{ startIndex: number; endIndex: number } | null>(null);

  const sessionsSorted = useMemo(() => sessionResults.slice().sort((a, b) => a.timestamp - b.timestamp), [sessionResults]);

  const chartData = useMemo(() => (
    sessionsSorted.map((s) => ({
      x: new Date(s.timestamp).toLocaleString(),
      accuracy: s.accuracy * 100,
      timestamp: s.timestamp
    }))
  ), [sessionsSorted]);

  // Response time over time (daily aggregates with index for numeric axis)
  const timingDailyAgg = useMemo(() => {
    const daily: Record<string, number[]> = {};
    sessionsSorted.forEach(s => {
      const times = (s.groupTimings || [])
        .map(t => (typeof t?.timeToCompleteMs === 'number' ? t.timeToCompleteMs : 0))
        .filter(v => v > 0 && isFinite(v));
      if (!times.length) return;
      if (!daily[s.date]) daily[s.date] = [];
      daily[s.date].push(...times);
    });
    const dates = Object.keys(daily).sort();
    return dates.map((date, idx) => {
      const arr = daily[date];
      const avg = arr.reduce((a, b) => a + b, 0) / Math.max(1, arr.length);
      return { date, dayIndex: idx, averageMs: Math.round(avg), count: arr.length };
    });
  }, [sessionsSorted]);

  const dayIndexByDate = useMemo(() => {
    const map: Record<string, number> = {};
    timingDailyAgg.forEach(d => { map[d.date] = d.dayIndex; });
    return map;
  }, [timingDailyAgg]);

  const dayIndexToLabel = useMemo(() => {
    const map: Record<number, string> = {};
    timingDailyAgg.forEach(d => { map[d.dayIndex] = d.date; });
    return map;
  }, [timingDailyAgg]);

  // All per-group response time samples (ms), numeric x with deterministic jitter
  const timingSamplesPoints = useMemo(() => {
    const points: Array<{ dayIndex: number; ms: number; date: string }> = [];
    const jitterAmplitude = 0.28; // fraction of a day slot to spread points
    let globalIdx = 0;
    const hash = (s: string): number => {
      let h = 0;
      for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
      return Math.abs(h);
    };
    sessionsSorted.forEach(s => {
      const date = s.date;
      const baseIndex = dayIndexByDate[date];
      if (typeof baseIndex !== 'number') return;
      (s.groupTimings || []).forEach((t, i) => {
        const v = typeof t?.timeToCompleteMs === 'number' ? t.timeToCompleteMs : 0;
        if (v > 0 && isFinite(v)) {
          const seed = hash(`${date}:${s.timestamp}:${i}:${globalIdx}:${v}`);
          const r = (seed % 1000) / 1000; // [0,1)
          const jitter = (r - 0.5) * 2 * jitterAmplitude;
          points.push({ dayIndex: baseIndex + jitter, ms: Math.round(v), date });
          globalIdx += 1;
        }
      });
    });
    return points;
  }, [sessionsSorted, dayIndexByDate]);

  const aggregateLetterStats = (sessions: SessionResult[]) => {
    const letterStats: Record<string, { correct: number; total: number }> = {};
    sessions.forEach(result => {
      Object.keys(result.letterAccuracy).forEach(letter => {
        if (!letterStats[letter]) letterStats[letter] = { correct: 0, total: 0 };
        letterStats[letter].correct += result.letterAccuracy[letter].correct;
        letterStats[letter].total += result.letterAccuracy[letter].total;
      });
    });
    return Object.keys(letterStats).map(letter => ({
      letter,
      accuracy: (letterStats[letter].correct / letterStats[letter].total) * 100,
      total: letterStats[letter].total
    })).sort((a, b) => a.accuracy - b.accuracy);
  };

  const rangeFilteredSessions = useMemo(() => {
    if (!range) return sessionsSorted;
    const start = Math.max(0, range.startIndex || 0);
    const end = Math.min(chartData.length - 1, range.endIndex || (chartData.length - 1));
    return sessionsSorted.slice(start, end + 1);
  }, [range, sessionsSorted, chartData.length]);

  const overallLetterStats = useMemo(() => aggregateLetterStats(rangeFilteredSessions), [rangeFilteredSessions]);

  const selectedSession = useMemo(() => sessionsSorted.find(s => s.timestamp === selectedSessionTs) || null, [sessionsSorted, selectedSessionTs]);
  const selectedSessionLetterStats = useMemo(() => selectedSession ? aggregateLetterStats([selectedSession]) : [], [selectedSession]);
  const selectedSessionDetails = useMemo(() => {
    if (!selectedSession) return [] as Array<{ idx: number; sent: string; received: string; correct: boolean; timeMs: number; alignment: Array<{ ch: string; ok: boolean }> }>;
    const timings = selectedSession.groupTimings || [];
    const rows = (selectedSession.groups || []).map((g, idx) => {
      const timeMs = Math.max(0, Math.round(timings[idx]?.timeToCompleteMs || 0));
      const maxLen = Math.max(g.sent.length, g.received.length);
      const alignment = Array.from({ length: maxLen }).map((_, i) => ({ ch: g.received[i] || '', ok: g.received[i] === g.sent[i] }));
      return { idx, sent: g.sent, received: g.received, correct: g.correct, timeMs, alignment };
    });
    return rows;
  }, [selectedSession]);

  const bigramHeatmap = useMemo(() => {
    const lettersSet = new Set<string>();
    const counts: Record<string, Record<string, { wrong: number; total: number }>> = {};
    rangeFilteredSessions.forEach(s => {
      (s.groups || []).forEach(g => {
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
    const matrix = letters.map(row => letters.map(col => {
      const c = counts[row]?.[col];
      const total = c?.total || 0;
      const wrong = c?.wrong || 0;
      const rate = total > 0 ? wrong / total : 0;
      return { row, col, rate, total };
    }));
    return { letters, matrix };
  }, [rangeFilteredSessions]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-4 sm:p-6">
      <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow-xl ring-1 ring-black/5 p-4 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">Training Statistics</h2>
          <button
            onClick={onBack}
            className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm sm:text-base hover:bg-blue-700"
          >
            Back to Training
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-700">Accuracy Over Time</h3>
            </div>
            <div className="w-full h-[260px] sm:h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} onClick={(e: any) => {
                  const payload = e && e.activePayload && e.activePayload[0] && e.activePayload[0].payload;
                  if (payload && payload.timestamp) {
                    setSelectedSessionTs(payload.timestamp);
                  }
                }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="x" />
                  <YAxis domain={[0, 100]} />
                  <ReferenceLine y={Math.max(0, Math.min(100, thresholdPercent ?? 90))} stroke="#ef4444" strokeDasharray="4 4" />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="accuracy" stroke="#2563eb" strokeWidth={1.5} dot={{ r: 3 }} name="Session" />
                  <Brush dataKey="x" travellerWidth={8} height={24} onChange={(r: any) => {
                    if (!r) return;
                    if (typeof r.startIndex === 'number' && typeof r.endIndex === 'number') {
                      setRange({ startIndex: r.startIndex, endIndex: r.endIndex });
                    }
                  }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-700">Response Time (ms) by Day</h3>
              </div>
              <div className="w-full h-[260px] sm:h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={timingDailyAgg}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      dataKey="dayIndex"
                      ticks={timingDailyAgg.map(d => d.dayIndex)}
                      domain={[Math.min(0, (timingDailyAgg[0]?.dayIndex ?? 0) - 0.5), (timingDailyAgg[timingDailyAgg.length - 1]?.dayIndex ?? 0) + 0.5]}
                      tickFormatter={(v: number) => dayIndexToLabel[v] || ''}
                    />
                    <YAxis yAxisId="ms" />
                    <Tooltip
                      labelFormatter={(label: any) => dayIndexToLabel[Math.round(Number(label))] || ''}
                      formatter={(value: any, name: string) => [`${value} ms`, name]}
                    />
                    <Legend />
                    <Line yAxisId="ms" type="monotone" dataKey="averageMs" stroke="#f59e0b" strokeWidth={1.5} dot={{ r: 3 }} name="Avg ms" />
                    <Scatter yAxisId="ms" data={timingSamplesPoints} dataKey="ms" name="Sample ms" fill="#fb923c" fillOpacity={0.55} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-slate-700">Sessions</h3>
            <div className="max-h-[420px] overflow-auto pr-1">
              {sessionResults.length === 0 && (
                <p className="text-sm text-slate-500">No sessions yet.</p>
              )}
              {sessionsSorted
                .slice()
                .sort((a, b) => b.timestamp - a.timestamp)
                .map(s => (
                  <div key={s.timestamp} className={`flex items-center justify-between p-3 rounded-lg border ${selectedSessionTs === s.timestamp ? 'border-blue-300 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                    <div onClick={() => setSelectedSessionTs(s.timestamp)} className="cursor-pointer">
                      <p className="text-sm font-medium text-slate-800">{new Date(s.timestamp).toLocaleString()}</p>
                      <p className="text-xs text-slate-500">Accuracy: {(s.accuracy * 100).toFixed(1)}%{Array.isArray(s.groupTimings) && s.groupTimings.length ? ` • Avg time: ${Math.round(s.groupTimings.filter(t => (t?.timeToCompleteMs || 0) > 0).reduce((a, b) => a + (b.timeToCompleteMs || 0), 0) / Math.max(1, s.groupTimings.filter(t => (t?.timeToCompleteMs || 0) > 0).length))} ms` : ''}</p>
                    </div>
                    <button
                      onClick={() => onDelete(s.timestamp)}
                      className="px-2 py-1 text-xs rounded-md bg-rose-500 text-white hover:bg-rose-600"
                    >
                      Delete
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-slate-700">Letter Accuracy {range ? '(Selected Range)' : '(All Sessions)'}</h3>
              {range && (
                <button onClick={() => setRange(null)} className="text-xs px-2 py-1 rounded bg-slate-200 text-slate-700">Clear Range</button>
              )}
            </div>
            <div className="w-full h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={overallLetterStats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="letter" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Bar dataKey="accuracy" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-slate-700">Per-Session Letter Accuracy</h3>
              {selectedSessionTs && (
                <button onClick={() => setSelectedSessionTs(null)} className="text-xs px-2 py-1 rounded bg-slate-200 text-slate-700">Clear Selection</button>
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
              <p className="text-sm text-slate-500">Click a point on the chart or a session to view per-character stats.</p>
            )}
          </div>
        </div>

        {selectedSession && (
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-slate-700 mb-3">Session Details</h3>
            <div className="space-y-2">
              {selectedSessionDetails.map(row => (
                <div key={row.idx} className={`p-3 rounded-lg border ${row.correct ? 'border-emerald-200 bg-emerald-50/40' : 'border-rose-200 bg-rose-50/40'}`}>
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-mono"><span className="text-slate-500">Group {row.idx + 1}:</span> {row.sent}</div>
                    <div className="text-xs text-slate-600">{row.timeMs ? `${row.timeMs} ms` : '—'}</div>
                  </div>
                  <div className="mt-1 font-mono text-sm">
                    {row.alignment.map((a, i) => (
                      <span key={i} className={a.ok ? 'text-emerald-700' : 'text-rose-700'}>{a.ch || '·'}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bigram error heatmap */}
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-slate-700 mb-3">Error Heatmap by Previous and Current Letter {range ? '(Selected Range)' : '(All Sessions)'}</h3>
          {bigramHeatmap.letters.length === 0 ? (
            <p className="text-sm text-slate-500">No data yet.</p>
          ) : (
            <div className="overflow-auto border rounded-xl">
              <table className="min-w-max text-xs">
                <thead>
                  <tr>
                    <th className="p-2 text-left sticky left-0 bg-white">Prev \ Curr</th>
                    {bigramHeatmap.letters.map(l => (
                      <th key={l} className="p-2 text-center">{l}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bigramHeatmap.letters.map((rowL, rIdx) => (
                    <tr key={rowL}>
                      <td className="p-2 font-semibold sticky left-0 bg-white">{rowL}</td>
                      {bigramHeatmap.matrix[rIdx].map(cell => {
                        const color = cell.total === 0 ? '#f1f5f9' : `rgba(239,68,68,${Math.min(1, cell.rate)})`;
                        const title = `${rowL}→${cell.col}: ${(cell.rate * 100).toFixed(1)}% errors (${cell.total} samples)`;
                        return (
                          <td key={rowL + '_' + cell.col} className="p-0">
                            <div title={title} style={{ backgroundColor: color, width: 24, height: 24 }} />
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
      </div>
    </div>
  );
};

export default StatsView;


