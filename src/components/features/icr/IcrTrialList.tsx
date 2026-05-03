import React from 'react';

import { getReactionTextClass } from '@/lib/icrHelpers';

export interface IcrTrialDisplay {
  readonly target: string;
  readonly reactionMs?: number;
  readonly typed?: string;
  readonly correct?: boolean;
}

interface IcrTrialListProps {
  readonly trials: readonly IcrTrialDisplay[];
  readonly buckets: { greenMax: number; yellowMax: number; orangeMax: number };
}

export function IcrTrialList({ trials, buckets }: IcrTrialListProps): JSX.Element {
  return (
    <div className="max-h-60 overflow-y-auto text-sm">
      {trials.map((t, i) => (
        <div key={i} className="flex gap-3 py-1 border-b">
          <div className="w-10">{t.target}</div>
          <div className={`w-24 ${getReactionTextClass(t.reactionMs ?? null, buckets)}`}>
            {t.reactionMs != null ? `${t.reactionMs} ms` : '—'}
          </div>
          <div className={`w-24 ${typeof t.correct === 'boolean' ? (t.correct ? 'text-emerald-600 font-medium' : 'text-rose-600 font-medium') : 'text-slate-600'}`}>
            {t.typed ?? '—'}
          </div>
          <div className="w-10">
            {typeof t.correct === 'boolean' ? (t.correct ? <span className="text-emerald-600">✓</span> : <span className="text-rose-600">✗</span>) : ''}
          </div>
        </div>
      ))}
    </div>
  );
}
