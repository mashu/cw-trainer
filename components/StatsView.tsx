import React, { useMemo, useState } from 'react';
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Line, BarChart, Bar, Brush, ReferenceLine } from 'recharts';

interface SessionGroup {
  sent: string;
  received: string;
  correct: boolean;
}

export interface SessionResult {
  date: string;
  timestamp: number;
  groups: SessionGroup[];
  accuracy: number;
  letterAccuracy: Record<string, { correct: number; total: number }>;
}

interface StatsViewProps {
  sessionResults: SessionResult[];
  onBack: () => void;
  onDelete: (timestamp: number) => void;
}

const StatsView: React.FC<StatsViewProps> = ({ sessionResults, onBack, onDelete }) => {
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
                  <ReferenceLine y={90} stroke="#ef4444" strokeDasharray="4 4" />
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
                      <p className="text-xs text-slate-500">Accuracy: {(s.accuracy * 100).toFixed(1)}%</p>
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
      </div>
    </div>
  );
};

export default StatsView;


