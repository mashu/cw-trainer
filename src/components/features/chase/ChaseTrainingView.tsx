'use client';

import React, { useEffect, useMemo, useRef } from 'react';

import type { ChaseNote, ChaseRecentLetter } from '@/hooks/useChaseTrainingSession';
import {
  KARAOKE_LANE_COUNT,
  KARAOKE_TONE_MAX_HZ,
  KARAOKE_TONE_MIN_HZ,
  KARAOKE_TONE_STEP_HZ,
} from '@/lib/chase';

interface ChaseTrainingViewProps {
  readonly notes: readonly ChaseNote[];
  readonly recentLetters: readonly ChaseRecentLetter[];
  readonly wpm: number;
  readonly wpmMin: number;
  readonly wpmMax: number;
  readonly calm: boolean;
  readonly level: number;
  readonly score: number;
  readonly combo: number;
  readonly bestCombo: number;
  readonly levelProgress: number;
  readonly lettersHeard: number;
  readonly correctCount: number;
  readonly wrongCount: number;
  readonly missedCount: number;
  readonly onKeystroke: (char: string) => void;
  readonly onStop: () => void;
}

/** Horizontal position (%) of the hit line where notes become audible. */
const HIT_X = 26;
/** Notes spawn just off the right edge... */
const SPAWN_X = 103;
/** ...and drift off the left edge once their window has passed. */
const EXIT_X = -9;
/** Vertical padding (%) above the top lane and below the bottom lane. */
const LANE_PAD = 4;

function laneHue(toneHz: number): number {
  const t = (toneHz - KARAOKE_TONE_MIN_HZ) / (KARAOKE_TONE_MAX_HZ - KARAOKE_TONE_MIN_HZ);
  return 185 + t * 115;
}

function laneTopPercent(laneIndex: number): number {
  const usable = 100 - 2 * LANE_PAD;
  const fromTop = (KARAOKE_LANE_COUNT - 1 - laneIndex) / (KARAOKE_LANE_COUNT - 1);
  return LANE_PAD + fromTop * usable;
}

function noteXPercent(note: ChaseNote, now: number): number {
  const t = note.resolvedAt !== undefined ? Math.min(note.resolvedAt, now) : now;
  if (t <= note.hitAt) {
    const travel = Math.max(1, note.hitAt - note.spawnedAt);
    const p = Math.max(0, Math.min(1, (t - note.spawnedAt) / travel));
    return SPAWN_X + (HIT_X - SPAWN_X) * p;
  }
  const window = Math.max(1, note.windowEndAt - note.hitAt);
  const p = Math.max(0, Math.min(1, (t - note.hitAt) / window));
  return HIT_X + (EXIT_X - HIT_X) * p;
}

function noteClasses(note: ChaseNote): string {
  switch (note.status) {
    case 'correct':
      return 'border-emerald-300 bg-emerald-500/25 text-emerald-100 shadow-[0_0_26px_rgba(52,211,153,0.55)] animate-[chase-note-pop_480ms_ease-out] opacity-0';
    case 'wrong':
      return 'border-rose-300 bg-rose-500/25 text-rose-100 shadow-[0_0_24px_rgba(244,63,94,0.5)] animate-[chase-note-pop_480ms_ease-out] opacity-0';
    case 'missed':
      return 'border-slate-400/50 bg-slate-700/40 text-slate-300 animate-[chase-note-drift_900ms_ease-out] opacity-0';
    case 'heard':
      return 'border-white/70 bg-slate-900/90 text-white scale-110 animate-[chase-note-live_900ms_ease-in-out_infinite]';
    default:
      return 'border-white/25 bg-slate-900/80 text-slate-200';
  }
}

function KaraokeNote({ note }: { readonly note: ChaseNote }): JSX.Element {
  const elRef = useRef<HTMLDivElement | null>(null);
  const hue = laneHue(note.toneHz);
  const resolved =
    note.status === 'correct' || note.status === 'wrong' || note.status === 'missed';

  useEffect(() => {
    if (resolved) {
      // Freeze resolved notes where they were answered; CSS handles the fade.
      const el = elRef.current;
      if (el) el.style.left = `${noteXPercent(note, Date.now())}%`;
      return undefined;
    }
    let raf = 0;
    const step = (): void => {
      const el = elRef.current;
      if (el) el.style.left = `${noteXPercent(note, Date.now())}%`;
      raf = window.requestAnimationFrame(step);
    };
    raf = window.requestAnimationFrame(step);
    return (): void => window.cancelAnimationFrame(raf);
  }, [note, resolved]);

  return (
    <div
      ref={elRef}
      data-testid={`chase-note-${note.id}`}
      className={`absolute z-10 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xl border-2 text-lg font-black transition-transform sm:h-11 sm:w-11 ${noteClasses(note)}`}
      style={{
        left: `${noteXPercent(note, Date.now())}%`,
        top: `${laneTopPercent(note.laneIndex)}%`,
        ...(note.status === 'incoming' || note.status === 'heard'
          ? {
              borderColor: `hsl(${hue} 85% 65% / 0.75)`,
              boxShadow: `0 0 18px hsl(${hue} 85% 60% / 0.4)`,
            }
          : {}),
      }}
    >
      {resolved ? note.char : '♪'}
      {note.status === 'wrong' && note.typedChar ? (
        <span className="absolute -bottom-4 text-[0.6rem] font-bold text-rose-300 line-through">
          {note.typedChar}
        </span>
      ) : null}
    </div>
  );
}

const OUTCOME_TILE: Record<ChaseRecentLetter['outcome'], string> = {
  correct: 'border-emerald-400/60 bg-emerald-400/15 text-emerald-200',
  wrong: 'border-rose-400/60 bg-rose-400/15 text-rose-200',
  missed: 'border-slate-500/50 bg-slate-500/15 text-slate-400',
};

export function ChaseTrainingView({
  notes,
  recentLetters,
  wpm,
  wpmMin,
  wpmMax,
  calm,
  level,
  score,
  combo,
  bestCombo,
  levelProgress,
  lettersHeard,
  correctCount,
  wrongCount,
  missedCount,
  onKeystroke,
  onStop,
}: ChaseTrainingViewProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const id = window.setInterval(() => {
      inputRef.current?.focus();
    }, 750);
    return (): void => window.clearInterval(id);
  }, []);

  const laneLabels = useMemo(
    () =>
      Array.from({ length: KARAOKE_LANE_COUNT }, (_, i) => {
        const laneIndex = KARAOKE_LANE_COUNT - 1 - i;
        return KARAOKE_TONE_MIN_HZ + laneIndex * KARAOKE_TONE_STEP_HZ;
      }),
    [],
  );

  const resolvedTotal = correctCount + wrongCount + missedCount;
  const copyPercent = resolvedTotal > 0 ? Math.round((correctCount / resolvedTotal) * 100) : 100;
  const wpmSpan = Math.max(1, wpmMax - wpmMin);
  const wpmFill = Math.max(0, Math.min(1, (wpm - wpmMin) / wpmSpan));

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-900 bg-slate-950 text-white shadow-2xl">
      <div className="grid grid-cols-2 gap-3 border-b border-white/10 bg-slate-900/80 p-4 sm:grid-cols-5">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Score</p>
          <p className="text-2xl font-black text-amber-300">{score}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Combo</p>
          <p
            className={`text-2xl font-black ${combo > 0 ? 'text-emerald-300' : 'text-slate-500'}`}
            key={combo > 0 ? `combo-${combo}` : 'combo-idle'}
          >
            ×{combo}
            <span className="ml-2 text-xs font-bold text-slate-500">best ×{bestCombo}</span>
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Copy</p>
          <p className="text-2xl font-black text-cyan-300">{copyPercent}%</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Level</p>
          <p className="text-2xl font-black text-fuchsia-300">{level}</p>
        </div>
        <button
          type="button"
          onClick={onStop}
          className="self-center rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-bold text-slate-100 transition hover:bg-white/20"
        >
          Finish
        </button>
      </div>

      <div
        className="relative h-[26rem] select-none overflow-hidden bg-[radial-gradient(circle_at_top_right,rgba(168,85,247,0.14),transparent_40%),radial-gradient(circle_at_bottom_left,rgba(34,211,238,0.12),transparent_45%),linear-gradient(180deg,#020617,#0b1120_60%,#020617)] sm:h-[28rem]"
        onMouseDown={() => inputRef.current?.focus()}
      >
        {/* Lane grid + tone labels */}
        {laneLabels.map((tone, i) => {
          const laneIndex = KARAOKE_LANE_COUNT - 1 - i;
          return (
            <div
              key={tone}
              className="absolute inset-x-0 border-t border-white/[0.05]"
              style={{ top: `${laneTopPercent(laneIndex)}%` }}
            >
              <span
                className="absolute left-2 -translate-y-1/2 font-mono text-[0.6rem] tracking-wide"
                style={{ color: `hsl(${laneHue(tone)} 60% 62% / 0.55)` }}
              >
                {tone} Hz
              </span>
            </div>
          );
        })}

        {/* Answer window: everything left of the hit line is "type it now" space */}
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-slate-950/0 via-cyan-400/[0.06] to-cyan-300/[0.12]"
          style={{ width: `${HIT_X}%` }}
        />

        {/* Hit line */}
        <div
          className="absolute inset-y-0 z-0 w-[3px] animate-[chase-hitline-pulse_2.4s_ease-in-out_infinite] bg-gradient-to-b from-cyan-300/20 via-cyan-300/80 to-cyan-300/20 shadow-[0_0_24px_rgba(34,211,238,0.55)]"
          style={{ left: `${HIT_X}%` }}
        >
          <span className="absolute -top-0.5 left-2 text-[0.6rem] font-black uppercase tracking-[0.3em] text-cyan-200/80">
            Now
          </span>
        </div>

        {calm ? (
          <div className="pointer-events-none absolute inset-0 z-20 animate-[chase-calm-breathe_3s_ease-in-out_infinite] bg-indigo-400/[0.05]">
            <div className="absolute right-4 top-3 rounded-full border border-indigo-300/40 bg-indigo-500/20 px-3 py-1 text-xs font-bold uppercase tracking-[0.25em] text-indigo-200">
              ☕ Breather
            </div>
          </div>
        ) : null}

        {notes.map((note) => (
          <KaraokeNote key={note.id} note={note} />
        ))}
      </div>

      <div className="space-y-3 border-t border-cyan-300/10 bg-slate-950/95 p-4">
        {/* Pace gauge */}
        <div className="flex items-center gap-3">
          <span className="w-14 text-right font-mono text-sm font-bold text-cyan-200">
            {wpm.toFixed(0)} <span className="text-[0.6rem] text-slate-400">WPM</span>
          </span>
          <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                calm
                  ? 'bg-gradient-to-r from-indigo-400 to-violet-300'
                  : 'bg-gradient-to-r from-cyan-400 to-fuchsia-400'
              }`}
              style={{ width: `${Math.round(wpmFill * 100)}%` }}
            />
          </div>
          <span className="text-[0.65rem] font-bold uppercase tracking-wide text-slate-400">
            {calm ? 'cruising' : 'pace'}
          </span>
        </div>

        {/* Conversation copy ticker */}
        <div className="flex min-h-8 flex-wrap items-center gap-1" data-testid="chase-ticker">
          {recentLetters.length === 0 ? (
            <span className="text-xs text-slate-500">
              Copy each letter as it crosses the line — heard {lettersHeard} so far.
            </span>
          ) : (
            recentLetters.map((letter) => (
              <span
                key={letter.id}
                className={`inline-flex h-7 w-7 items-center justify-center rounded-md border font-mono text-sm font-bold ${OUTCOME_TILE[letter.outcome]}`}
              >
                {letter.char}
              </span>
            ))
          )}
        </div>

        <input
          ref={inputRef}
          value=""
          onChange={(event) => {
            for (const char of event.target.value) {
              onKeystroke(char);
            }
          }}
          className="w-full rounded-xl border border-cyan-300/40 bg-slate-950 px-4 py-3 text-center text-lg font-black uppercase tracking-[0.3em] text-cyan-100 outline-none ring-cyan-300/30 transition placeholder:text-slate-600 focus:ring-4"
          placeholder="TYPE WHAT YOU HEAR"
          autoComplete="off"
          autoFocus
          spellCheck={false}
        />
        <p className="text-xs text-slate-400">
          Missed one? Let it go — the next letter matters more. Typing a later letter drops the
          ones before it.
        </p>

        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-300 transition-all"
            style={{ width: `${Math.round(levelProgress * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
