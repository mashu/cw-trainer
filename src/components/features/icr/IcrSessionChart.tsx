import React from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Scatter,
  Line,
  ScatterChart,
  Legend,
  Cell,
} from 'recharts';

import { getBarFill } from '@/lib/icrHelpers';
import type { IcrSettings } from '@/types';

type LetterBarPoint = {
  readonly letter: string;
  readonly index: number;
  readonly adjAvg: number;
  readonly avg: number;
  readonly acc: number;
  readonly total: number;
};

type ReactionScatterPoint = {
  readonly letter: string;
  readonly reaction: number;
};

type LetterChartPayload = { letter?: string; acc?: number };
const isLetterPayloadArray = (value: unknown): value is Array<{ payload?: LetterChartPayload }> =>
  Array.isArray(value);

const formatLetterTooltipLabel = (label: string | number, payload: unknown): string => {
  if (isLetterPayloadArray(payload)) {
    const entry = payload[0]?.payload;
    if (entry?.letter) {
      const accPct = Math.round((entry.acc ?? 0) * 100);
      return `${entry.letter} • acc ${accPct}%`;
    }
  }
  return typeof label === 'string' ? label : String(label);
};

interface IcrSessionChartProps {
  readonly bars: readonly LetterBarPoint[];
  readonly dotsCorrectCat: readonly ReactionScatterPoint[];
  readonly dotsWrongCat: readonly ReactionScatterPoint[];
  readonly icrSettings: IcrSettings;
}

export function IcrSessionChart({
  bars,
  dotsCorrectCat,
  dotsWrongCat,
  icrSettings,
}: IcrSessionChartProps): JSX.Element {
  const buckets = {
    greenMax: icrSettings.bucketGreenMaxMs ?? 400,
    yellowMax: icrSettings.bucketYellowMaxMs ?? 600,
    orangeMax: icrSettings.bucketOrangeMaxMs ?? 800,
  };

  return (
    <>
      <div className="h-96 w-full">
        <ResponsiveContainer>
          <ComposedChart data={[...bars]} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="letter" xAxisId={0} type="category" allowDuplicatedCategory={false} />
            <YAxis yAxisId={0} label={{ value: 'ms', angle: -90, position: 'insideLeft' }} />
            <Tooltip labelFormatter={formatLetterTooltipLabel} />
            <Bar yAxisId={0} xAxisId={0} dataKey="adjAvg" name="Weighted Avg (ms)">
              {bars.map((entry, idx) => (
                <Cell key={`cell-${idx}`} fill={getBarFill(entry.adjAvg, buckets)} />
              ))}
            </Bar>
            <Line yAxisId={0} xAxisId={0} dataKey="avg" name="Unweighted Avg (ms)" stroke="#3b82f6" strokeWidth={2} dot={{ r: 2, fill: '#3b82f6' }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="h-72 w-full mt-4">
        <ResponsiveContainer>
          <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="letter" type="category" allowDuplicatedCategory={false} />
            <YAxis dataKey="reaction" type="number" name="Reaction (ms)" label={{ value: 'ms', angle: -90, position: 'insideLeft' }} />
            <Tooltip />
            <Legend />
            <Scatter name="Correct" data={[...dotsCorrectCat]} fill="#3b82f6" />
            <Scatter name="Wrong" data={[...dotsWrongCat]} fill="#ef4444" />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

export type { LetterBarPoint, ReactionScatterPoint };
