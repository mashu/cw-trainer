import React from 'react';

interface IcrBucketLegendProps {
  readonly buckets: { greenMax: number; yellowMax: number; orangeMax: number };
}

export function IcrBucketLegend({ buckets }: IcrBucketLegendProps): JSX.Element {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 mb-3 text-sm text-slate-600">
      <span className="inline-flex items-center gap-1.5">
        <span className="w-3.5 h-3.5 rounded-sm bg-emerald-500 shrink-0" aria-hidden />
        Green &lt;{buckets.greenMax} ms
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="w-3.5 h-3.5 rounded-sm bg-lime-500 shrink-0" aria-hidden />
        Yellow (ICR) &lt;{buckets.yellowMax} ms
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="w-3.5 h-3.5 rounded-sm bg-orange-500 shrink-0" aria-hidden />
        Orange &lt;{buckets.orangeMax} ms
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="w-3.5 h-3.5 rounded-sm bg-rose-500 shrink-0" aria-hidden />
        Red &gt;{buckets.orangeMax} ms
      </span>
    </div>
  );
}
