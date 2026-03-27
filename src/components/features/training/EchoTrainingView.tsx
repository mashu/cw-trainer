'use client';

import React from 'react';

import { EchoProgressRing } from '@/components/ui/training/EchoProgressRing';
import { ProgressHeader } from '@/components/ui/training/ProgressHeader';
import type { EchoCharacterProgress } from '@/hooks/useEchoTrainingSession';

interface EchoTrainingViewProps {
  readonly currentGroup: number;
  readonly sentGroups: string[];
  readonly currentCharacterIndex: number;
  readonly currentCharacterState:
    | 'idle'
    | 'playing'
    | 'awaiting'
    | 'receiving'
    | 'correct'
    | 'error';
  readonly currentSymbols: string;
  readonly revealedCharacter: string | null;
  readonly currentGroupProgress: readonly EchoCharacterProgress[];
  readonly correctCharacters: number;
  readonly incorrectCharacters: number;
  readonly onStop: () => void;
}

export function EchoTrainingView({
  currentGroup,
  sentGroups,
  currentCharacterIndex,
  currentCharacterState,
  currentSymbols,
  revealedCharacter,
  currentGroupProgress,
  correctCharacters,
  incorrectCharacters,
  onStop,
}: EchoTrainingViewProps): JSX.Element {
  const activeGroup = sentGroups[currentGroup] ?? '';
  const sendingScore = correctCharacters - incorrectCharacters;

  return (
    <div className="space-y-8">
      <ProgressHeader currentGroup={currentGroup} totalGroups={sentGroups.length} />

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-indigo-50 p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Echo Sending</h2>
              <p className="text-sm text-slate-600 mt-1">
                Hear the character, then send it back with your paddle.
              </p>
            </div>
            <div className="rounded-2xl bg-white/80 px-4 py-3 border border-slate-200 text-right">
              <div className="text-xs uppercase tracking-wide text-slate-500">
                Sending Score
              </div>
              <div
                className={`text-3xl font-black ${
                  sendingScore >= 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {sendingScore >= 0 ? '+' : ''}
                {sendingScore}
              </div>
            </div>
          </div>

          <EchoProgressRing
            state={currentCharacterState}
            revealedCharacter={revealedCharacter}
            symbols={currentSymbols}
          />

          <div className="mt-8 rounded-2xl border border-slate-200 bg-white/80 p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="text-sm font-semibold text-slate-700">
                Current Group
              </h3>
              <span className="text-xs text-slate-500">
                Character {Math.min(currentCharacterIndex + 1, Math.max(activeGroup.length, 1))}
                /{Math.max(activeGroup.length, 1)}
              </span>
            </div>
            <div className="flex flex-wrap gap-3">
              {activeGroup.split('').map((_, index) => {
                const progress = currentGroupProgress[index];
                const isCurrent =
                  index === currentCharacterIndex &&
                  progress?.status === 'pending';
                const baseClass =
                  progress?.status === 'correct'
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                    : progress?.status === 'error'
                      ? 'border-rose-300 bg-rose-50 text-rose-700'
                      : isCurrent
                        ? 'border-sky-300 bg-sky-50 text-sky-700 shadow-sm'
                        : 'border-slate-200 bg-slate-50 text-slate-400';
                return (
                  <div
                    key={`${currentGroup}-${index}`}
                    className={`h-14 w-14 rounded-2xl border text-xl font-black flex items-center justify-center transition-colors ${baseClass}`}
                  >
                    {progress?.revealedCharacter ?? '•'}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="text-xs uppercase tracking-wide text-emerald-700">
                Correct
              </div>
              <div className="mt-2 text-3xl font-black text-emerald-700">
                {correctCharacters}
              </div>
            </div>
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
              <div className="text-xs uppercase tracking-wide text-rose-700">
                Wrong
              </div>
              <div className="mt-2 text-3xl font-black text-rose-700">
                {incorrectCharacters}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-600">
                Keys
              </div>
              <div className="mt-2 text-lg font-black text-slate-700">
                [ ]
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">
              How It Works
            </h3>
            <div className="space-y-2 text-sm text-slate-600">
              <p>1. Listen to the character that plays.</p>
              <p>2. Send it back using `[` for dot and `]` for dash.</p>
              <p>3. Blue means receiving, green means correct, red means wrong.</p>
            </div>
          </div>

          <button
            onClick={onStop}
            className="w-full px-8 py-4 bg-white text-slate-700 text-lg font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 transition-all duration-200 shadow-sm"
          >
            Stop Session
          </button>
        </div>
      </div>
    </div>
  );
}
