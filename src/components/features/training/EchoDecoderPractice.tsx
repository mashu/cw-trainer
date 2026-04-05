'use client';

import { useLayoutEffect, useState } from 'react';

import { useMorseDecoderPractice } from '@/hooks/useMorseDecoderPractice';
import type { TrainingSettings } from '@/types';

export interface EchoDecoderPracticeProps {
  readonly settings: TrainingSettings;
  readonly enabled: boolean;
}

export function EchoDecoderPractice({
  settings,
  enabled,
}: EchoDecoderPracticeProps): JSX.Element {
  const { segments, livePattern, clear } = useMorseDecoderPractice({ enabled, settings });
  const [mountedIds, setMountedIds] = useState<ReadonlySet<string>>(() => new Set());

  useLayoutEffect(() => {
    if (segments.length === 0) {
      setMountedIds(new Set());
      return;
    }
    const last = segments[segments.length - 1];
    if (!last) return;
    setMountedIds((prev) => new Set(prev).add(last.id));
  }, [segments]);

  return (
    <section
      className="rounded-2xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50/90 via-white to-slate-50/80 p-5 shadow-sm"
      aria-label="Morse decoder practice"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-indigo-800">
            Live decoder
          </h3>
          <p className="mt-1 text-sm text-slate-600 max-w-xl">
            Warm up before you start: use{' '}
            <kbd className="rounded border border-slate-300 bg-white px-1.5 py-0.5 font-mono text-xs text-slate-800 shadow-sm">
              [
            </kbd>{' '}
            and{' '}
            <kbd className="rounded border border-slate-300 bg-white px-1.5 py-0.5 font-mono text-xs text-slate-800 shadow-sm">
              ]
            </kbd>{' '}
            (or paddle keys). Letters appear after a short pause; a longer pause inserts a space
            between words.
          </p>
        </div>
        <button
          type="button"
          onClick={clear}
          className="shrink-0 self-start rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          Clear
        </button>
      </div>

      <div
        className="mt-4 min-h-[5.5rem] rounded-xl border border-indigo-100/90 bg-slate-900/95 px-4 py-3 shadow-inner"
        aria-live="polite"
        aria-atomic="false"
      >
        <div className="flex min-h-[3.25rem] flex-wrap items-end gap-2">
          {segments.map((seg) => {
            const isSpace = seg.display === ' ';
            const animated = mountedIds.has(seg.id);
            return (
              <span
                key={seg.id}
                className={[
                  'inline-flex select-none items-center justify-center rounded-lg font-mono font-bold tabular-nums transition-all duration-500 ease-out',
                  isSpace
                    ? 'min-w-[0.65rem] h-10 border border-indigo-400/30 bg-indigo-950/40'
                    : 'min-w-[2.25rem] h-12 border border-indigo-300/25 bg-gradient-to-b from-indigo-400/25 to-indigo-600/15 px-2 text-2xl text-indigo-50 shadow-md shadow-indigo-950/40',
                  animated
                    ? 'translate-y-0 scale-100 opacity-100'
                    : 'translate-y-1 scale-90 opacity-0',
                ].join(' ')}
              >
                {isSpace ? (
                  <span className="sr-only">space</span>
                ) : (
                  <span className="drop-shadow-[0_0_12px_rgba(165,180,252,0.45)]">
                    {seg.display}
                  </span>
                )}
              </span>
            );
          })}
          {livePattern.length > 0 && (
            <span className="inline-flex items-center rounded-md border border-amber-400/40 bg-amber-500/10 px-2 py-1 font-mono text-xs tracking-wider text-amber-100/90">
              {livePattern.replaceAll('.', '·').replaceAll('-', '—')}
            </span>
          )}
        </div>
        {segments.length === 0 && livePattern.length === 0 && (
          <p className="text-sm text-slate-400 italic">
            Your decoded characters will show up here…
          </p>
        )}
      </div>
    </section>
  );
}
