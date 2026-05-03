import React, { useEffect, useRef, useState } from 'react';

const BAR_COUNT = 14;

export type IcrTrainingVoiceHudProps = {
  readonly active: boolean;
  readonly measureInputLevel: () => number;
  readonly armedRef: React.MutableRefObject<boolean>;
  readonly vadThreshold: number;
  readonly vadHoldMs: number;
  /** True while countdown overlay is visible — pause “listening” semantics */
  readonly listeningPaused: boolean;
  /** Current trial: voice (or keyboard) stopped the reaction timer, waiting for letter */
  readonly reactionLocked: boolean;
  readonly lockedReactionMs: number | null;
};

/**
 * Live mic / VAD visualization for ICR training only.
 * Owns its own rAF loop so the parent does not re-render every frame (preserves input focus).
 */
export function IcrTrainingVoiceHud({
  active,
  measureInputLevel,
  armedRef,
  vadThreshold,
  vadHoldMs,
  listeningPaused,
  reactionLocked,
  lockedReactionMs,
}: IcrTrainingVoiceHudProps): JSX.Element | null {
  const [level, setLevel] = useState(0);
  const [armed, setArmed] = useState(false);
  const [holdMs, setHoldMs] = useState(0);
  const [, setFrameTick] = useState(0);
  const phaseRef = useRef(0);

  useEffect(() => {
    if (!active || reactionLocked) {
      setLevel(0);
      setArmed(false);
      setHoldMs(0);
      return;
    }

    let frameId = 0;
    let holdStart: number | null = null;

    const tick = (): void => {
      phaseRef.current += 1;
      const lv = measureInputLevel();
      const isArmed = armedRef.current;
      const now = performance.now();

      let nextHold = 0;
      if (isArmed && !listeningPaused && lv >= vadThreshold) {
        if (holdStart == null) holdStart = now;
        nextHold = now - holdStart;
      } else {
        holdStart = null;
      }

      setLevel(lv);
      setArmed(isArmed);
      setHoldMs(nextHold);
      setFrameTick((n) => n + 1);

      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return (): void => cancelAnimationFrame(frameId);
  }, [active, reactionLocked, armedRef, listeningPaused, measureInputLevel, vadThreshold]);

  const pct = Math.min(100, level * 100);
  const threshPct = Math.min(100, vadThreshold * 100);
  const holdRatio = vadHoldMs > 0 ? Math.min(1, holdMs / vadHoldMs) : 0;
  const aboveThreshold = level >= vadThreshold;

  const t = phaseRef.current;
  const barHeights: number[] = [];
  for (let i = 0; i < BAR_COUNT; i++) {
    const wobble = 0.35 + 0.65 * Math.abs(Math.sin((i / BAR_COUNT) * Math.PI * 2 + t * 0.08));
    barHeights.push(Math.min(100, pct * wobble));
  }

  if (!active) return null;

  const status =
    listeningPaused ? 'Ready' : reactionLocked ? 'Saved' : armed ? 'Listen' : 'Play';

  return (
    <div
      className="w-full overflow-hidden rounded-2xl border border-slate-200/90 bg-gradient-to-b from-slate-50/90 to-white shadow-sm shadow-slate-900/5"
      aria-label="Voice activity and reaction timer status"
    >
      <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 bg-white/70 px-3 py-2">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Voice stop</div>
          <div className="text-xs font-medium text-slate-800">{status}</div>
        </div>
        <span
          className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ${
            reactionLocked
              ? 'bg-emerald-100 text-emerald-800'
              : armed && !listeningPaused
                ? 'bg-indigo-100 text-indigo-900'
                : 'bg-slate-200/80 text-slate-600'
          }`}
        >
          {reactionLocked && lockedReactionMs != null
            ? `${lockedReactionMs} ms`
            : armed && !listeningPaused
              ? `${Math.round(holdMs)}/${vadHoldMs} ms`
              : '—'}
        </span>
      </div>

      {reactionLocked && lockedReactionMs != null ? (
        <div className="px-3 py-3 bg-emerald-50">
          <div className="flex items-baseline justify-center gap-2">
            <span className="text-3xl font-bold tabular-nums text-emerald-800">{lockedReactionMs}</span>
            <span className="text-sm text-emerald-700">ms</span>
          </div>
          <p className="mt-1 text-center text-[11px] text-emerald-800/90">Type the letter below.</p>
        </div>
      ) : (
        <div className="px-3 py-2.5 space-y-2">
          <div className="flex items-end justify-center gap-0.5 h-12" aria-hidden>
            {barHeights.map((h, i) => (
              <div
                key={i}
                className={`w-1.5 rounded-t ${
                  aboveThreshold && armed && !listeningPaused
                    ? 'bg-indigo-500'
                    : 'bg-slate-300'
                }`}
                style={{ height: `${Math.max(6, h * 0.4)}%` }}
              />
            ))}
          </div>

          <div className="relative h-2.5 rounded-full bg-slate-200">
            <div
              className={`h-full rounded-full ${
                aboveThreshold && armed && !listeningPaused ? 'bg-indigo-500' : 'bg-slate-400'
              }`}
              style={{ width: `${pct}%` }}
            />
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-amber-500 pointer-events-none"
              style={{ left: `${threshPct}%`, transform: 'translateX(-50%)' }}
            />
          </div>

          <div className="flex items-center gap-2">
            <svg className="shrink-0 w-9 h-9 -rotate-90" viewBox="0 0 36 36" aria-hidden>
              <circle cx="18" cy="18" r="15.5" fill="none" className="stroke-slate-200" strokeWidth="3" />
              <circle
                cx="18"
                cy="18"
                r="15.5"
                fill="none"
                className={armed && !listeningPaused ? (holdRatio >= 1 ? 'stroke-emerald-500' : 'stroke-indigo-500') : 'stroke-slate-300'}
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${holdRatio * 97.4} 97.4`}
              />
            </svg>
            <p className="text-[11px] leading-snug text-slate-500">
              {listeningPaused
                ? 'Starts after countdown.'
                : armed
                  ? 'Hold past the line to lock reaction time.'
                  : 'Arms when the tone ends.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
