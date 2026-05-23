'use client';

import React, { useMemo, useRef } from 'react';

import type { TrainingMode } from '@/types';

interface TrainingModeCarouselProps {
  readonly activeMode: TrainingMode;
  readonly onChangeMode: (mode: TrainingMode) => void;
}

const MODE_ITEMS: ReadonlyArray<{
  id: TrainingMode;
  label: string;
}> = [
  { id: 'group', label: 'Group' },
  { id: 'icr', label: 'ICR' },
  { id: 'echo', label: 'Echo' },
  { id: 'chase', label: 'Chase' },
  { id: 'player', label: 'Player' },
];

const SWIPE_THRESHOLD_PX = 50;

function clampIndex(index: number): number {
  return Math.max(0, Math.min(MODE_ITEMS.length - 1, index));
}

export function TrainingModeCarousel({
  activeMode,
  onChangeMode,
}: TrainingModeCarouselProps): JSX.Element {
  const startXRef = useRef<number | null>(null);
  const activeIndex = useMemo(
    () =>
      Math.max(
        0,
        MODE_ITEMS.findIndex((item) => item.id === activeMode),
      ),
    [activeMode],
  );

  const moveBy = (delta: number): void => {
    const next = MODE_ITEMS[clampIndex(activeIndex + delta)];
    if (next && next.id !== activeMode) {
      onChangeMode(next.id);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white/80 p-2">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => moveBy(-1)}
          disabled={activeIndex === 0}
          aria-label="Previous mode"
          className="h-8 w-8 rounded-full border border-slate-200 bg-white text-sm text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          ←
        </button>
        <div
          className="relative flex-1 overflow-hidden"
          onTouchStart={(event) => {
            startXRef.current = event.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(event) => {
            const startX = startXRef.current;
            const endX = event.changedTouches[0]?.clientX ?? null;
            startXRef.current = null;
            if (startX === null || endX === null) {
              return;
            }
            const delta = endX - startX;
            if (Math.abs(delta) < SWIPE_THRESHOLD_PX) {
              return;
            }
            moveBy(delta > 0 ? -1 : 1);
          }}
        >
          <div
            className="flex transition-transform duration-300 ease-out"
            style={{ transform: `translateX(${(1 - activeIndex) * 33.3333}%)` }}
          >
            {MODE_ITEMS.map((item, index) => {
              const distance = Math.abs(index - activeIndex);
              const isActive = index === activeIndex;
              const opacity = distance === 0 ? 1 : distance === 1 ? 0.65 : 0.35;
              const scale = distance === 0 ? 1 : distance === 1 ? 0.94 : 0.88;
              const colorClass = isActive
                ? 'border-emerald-500 bg-emerald-500 text-white shadow-lg'
                : 'border-slate-200 bg-slate-50 text-slate-600';

              return (
                <div key={item.id} className="basis-1/3 shrink-0 px-1">
                  <button
                    type="button"
                    onClick={() => onChangeMode(item.id)}
                    aria-pressed={isActive}
                    className={`w-full rounded-xl border px-3 py-2 text-center transition-all duration-300 ${colorClass}`}
                    style={{ opacity, transform: `scale(${scale})` }}
                  >
                    <div className="text-sm font-bold leading-5">{item.label}</div>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
        <button
          type="button"
          onClick={() => moveBy(1)}
          disabled={activeIndex === MODE_ITEMS.length - 1}
          aria-label="Next mode"
          className="h-8 w-8 rounded-full border border-slate-200 bg-white text-sm text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          →
        </button>
      </div>
    </div>
  );
}
