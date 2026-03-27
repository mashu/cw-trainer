'use client';

import React from 'react';

type EchoRingState =
  | 'idle'
  | 'playing'
  | 'awaiting'
  | 'receiving'
  | 'correct'
  | 'error';

interface EchoProgressRingProps {
  readonly state: EchoRingState;
  readonly revealedCharacter: string | null;
  readonly symbols: string;
}

const formatSymbols = (symbols: string): string =>
  symbols.replace(/\./g, '·').replace(/-/g, '−');

export function EchoProgressRing({
  state,
  revealedCharacter,
  symbols,
}: EchoProgressRingProps): JSX.Element {
  const palette =
    state === 'correct'
      ? {
          ring: 'from-emerald-400 via-emerald-500 to-emerald-600',
          shell: 'border-emerald-200 bg-emerald-50/80 text-emerald-900',
          label: 'Correct',
        }
      : state === 'error'
        ? {
            ring: 'from-rose-400 via-rose-500 to-rose-600',
            shell: 'border-rose-200 bg-rose-50/80 text-rose-900',
            label: 'Wrong',
          }
        : state === 'playing'
          ? {
              ring: 'from-violet-400 via-indigo-500 to-blue-600',
              shell: 'border-indigo-200 bg-indigo-50/80 text-indigo-900',
              label: 'Listen',
            }
          : {
              ring: 'from-sky-400 via-blue-500 to-cyan-500',
              shell: 'border-sky-200 bg-sky-50/80 text-sky-900',
              label: symbols.length > 0 ? 'Receiving' : 'Ready',
            };

  const showSpinner =
    state === 'playing' || state === 'awaiting' || state === 'receiving';

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative h-56 w-56 sm:h-64 sm:w-64">
        <div
          className={`absolute inset-0 rounded-full bg-gradient-to-br ${palette.ring} ${
            showSpinner ? 'animate-spin' : ''
          }`}
          style={{ animationDuration: '1.6s' }}
        />
        <div className="absolute inset-[14px] rounded-full bg-white/85 backdrop-blur-md" />
        <div
          className={`absolute inset-[28px] rounded-full border ${palette.shell} shadow-inner flex flex-col items-center justify-center px-6 text-center transition-colors duration-300`}
        >
          <div className="text-xs font-semibold uppercase tracking-[0.24em] opacity-70">
            {palette.label}
          </div>
          <div className="mt-4 h-20 w-20 flex items-center justify-center">
            {revealedCharacter ? (
              <span className="text-6xl sm:text-7xl font-black tracking-wide leading-none flex items-center justify-center">
                {revealedCharacter}
              </span>
            ) : (
              <span className="text-5xl sm:text-6xl font-black leading-none opacity-40 flex items-center justify-center">
                ?
              </span>
            )}
          </div>
          <div className="mt-4 h-7 text-lg font-mono tracking-[0.35em]">
            {symbols.length > 0 ? formatSymbols(symbols) : <span className="opacity-40">···</span>}
          </div>
        </div>
      </div>
      <p className="text-xs sm:text-sm text-slate-500 text-center max-w-sm">
        Send <code>[</code> for dot and <code>]</code> for dash. The character is
        revealed only after the attempt finishes.
      </p>
    </div>
  );
}
