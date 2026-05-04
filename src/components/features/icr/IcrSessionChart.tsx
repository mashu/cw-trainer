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

/** Recharts passes composed shape + original row; keep extraction tolerant. */
function letterFromRechartsItem(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null) return undefined;
  const o = data as { readonly letter?: unknown; readonly payload?: { readonly letter?: unknown } };
  const top = o.letter;
  if (typeof top === 'string' && top.length > 0) return top;
  const p = o.payload?.letter;
  if (typeof p === 'string' && p.length > 0) return p;
  return undefined;
}

interface IcrSessionChartProps {
  readonly bars: readonly LetterBarPoint[];
  readonly dotsCorrectCat: readonly ReactionScatterPoint[];
  readonly dotsWrongCat: readonly ReactionScatterPoint[];
  readonly icrSettings: IcrSettings;
  /** Play Morse for the letter when the user clicks a bar or scatter point (e.g. after session). */
  readonly onLetterClick?: (letter: string) => void;
}

export function IcrSessionChart({
  bars,
  dotsCorrectCat,
  dotsWrongCat,
  icrSettings,
  onLetterClick,
}: IcrSessionChartProps): JSX.Element {
  const buckets = {
    greenMax: icrSettings.bucketGreenMaxMs ?? 400,
    yellowMax: icrSettings.bucketYellowMaxMs ?? 600,
    orangeMax: icrSettings.bucketOrangeMaxMs ?? 800,
  };

  const handleShapeClick = (item: unknown): void => {
    if (!onLetterClick) return;
    const letter = letterFromRechartsItem(item);
    if (!letter) return;
    onLetterClick(letter);
  };

  const barClickProps = onLetterClick
    ? ({
        style: { cursor: 'pointer' as const },
        onClick: (d: unknown) => {
          handleShapeClick(d);
        },
      } as const)
    : ({ style: { cursor: 'default' as const } } as const);

  const scatterClickProps = onLetterClick
    ? ({
        style: { cursor: 'pointer' as const },
        onClick: (d: unknown) => {
          handleShapeClick(d);
        },
      } as const)
    : ({ style: { cursor: 'default' as const } } as const);

  return (
    <>
      {onLetterClick && bars.length > 0 ? (
        <p className="mb-2 text-center text-[11px] text-slate-500">Click a bar or dot to hear that letter.</p>
      ) : null}
      <div className="h-96 w-full">
        <ResponsiveContainer>
          <ComposedChart data={[...bars]} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="letter" xAxisId={0} type="category" allowDuplicatedCategory={false} />
            <YAxis yAxisId={0} label={{ value: 'ms', angle: -90, position: 'insideLeft' }} />
            <Tooltip labelFormatter={formatLetterTooltipLabel} />
            <Bar
              yAxisId={0}
              xAxisId={0}
              dataKey="adjAvg"
              name="Weighted Avg (ms)"
              {...barClickProps}
            >
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
            <Scatter name="Correct" data={[...dotsCorrectCat]} fill="#3b82f6" {...scatterClickProps} />
            <Scatter name="Wrong" data={[...dotsWrongCat]} fill="#ef4444" {...scatterClickProps} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

export type { LetterBarPoint, ReactionScatterPoint };
