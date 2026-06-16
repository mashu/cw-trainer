'use client';

import React, { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { buildCharSamplingSnapshot } from '@/lib/training/charSampling';
import type { SessionResult, TrainingSettings } from '@/types';

type CharSamplingPanelProps = {
  readonly settings: TrainingSettings;
  readonly sessions: readonly SessionResult[];
  readonly compact?: boolean;
};

type ChartRow = {
  readonly character: string;
  readonly pErrorPct: number;
  readonly samplingPct: number;
  readonly sessionSamples: number;
};

export function CharSamplingPanel({
  settings,
  sessions,
  compact = false,
}: CharSamplingPanelProps): JSX.Element {
  const snapshot = useMemo(
    () => buildCharSamplingSnapshot(settings, sessions),
    [settings, sessions],
  );

  const chartData: ChartRow[] = useMemo(
    () =>
      snapshot.rows.map((row) => ({
        character: row.character,
        pErrorPct: Math.round(row.pError * 1000) / 10,
        samplingPct: Math.round(row.samplingProb * 1000) / 10,
        sessionSamples: row.sessionSamples,
      })),
    [snapshot.rows],
  );

  if (snapshot.pool.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
        No characters unlocked for the current level and character set.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-slate-800">Next-group draw mix</h3>
          <p className="mt-1 text-xs text-slate-500">
            P(error) = Bayesian Beta posterior; π = normalized sampling weight. Pool = current
            level. History = all group sessions
            {snapshot.thompsonSampling ? ' · Thompson on' : ''}.
          </p>
        </div>

        <div className={compact ? 'h-56' : 'h-72'}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="character" tick={{ fontSize: 12 }} />
              <YAxis
                tick={{ fontSize: 11 }}
                domain={[0, 100]}
                tickFormatter={(value: number) => `${value}%`}
              />
              <Tooltip
                formatter={(value: number, name: string) => [`${value}%`, name]}
                labelFormatter={(label: string) => `Character ${label}`}
              />
              <Legend />
              <Bar
                dataKey="pErrorPct"
                name="P(error)"
                fill="#f43f5e"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="samplingPct"
                name="Sampling π"
                fill="#6366f1"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="pb-2 pr-4">Char</th>
              <th className="pb-2 pr-4">Beta α</th>
              <th className="pb-2 pr-4">Beta β</th>
              <th className="pb-2 pr-4">P(error)</th>
              <th className="pb-2 pr-4">Weight</th>
              <th className="pb-2">π</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.rows.map((row) => (
              <tr key={row.character} className="border-t border-slate-100">
                <td className="py-2 pr-4 font-mono font-semibold text-slate-800">{row.character}</td>
                <td className="py-2 pr-4 tabular-nums text-slate-600">{row.alpha.toFixed(1)}</td>
                <td className="py-2 pr-4 tabular-nums text-slate-600">{row.beta.toFixed(1)}</td>
                <td className="py-2 pr-4 tabular-nums text-rose-700">
                  {(row.pError * 100).toFixed(1)}%
                </td>
                <td className="py-2 pr-4 tabular-nums text-indigo-700">
                  {row.samplingWeight.toFixed(2)}
                </td>
                <td className="py-2 tabular-nums text-slate-800">
                  {(row.samplingProb * 100).toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
