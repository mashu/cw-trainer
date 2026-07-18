'use client';

import React, { useMemo } from 'react';

import { aggregateHistoricalBeliefs, betaPosteriorMeanError } from '@/lib/training/charSampling';
import { computeCharPool } from '@/lib/trainingUtils';
import type { SessionResult, TrainingSettings } from '@/types';

export interface TodaysFocusCardProps {
  readonly sessions: readonly SessionResult[];
  readonly settings: TrainingSettings;
}

const MIN_ATTEMPTS = 5;
const MIN_ERROR_TO_SHOW = 0.12;
const MAX_FOCUS_CHARS = 3;

/**
 * Surfaces the adaptive sampler's judgement on the home screen. Bayesian
 * weak-character targeting is what the trainer will emphasize in the current
 * practice pool — not a syllabus milestone (see Teaching plan) and not the
 * frequentist mastery/slow diagnostics on the Stats overview.
 */
export function TodaysFocusCard({ sessions, settings }: TodaysFocusCardProps): JSX.Element | null {
  const focus = useMemo(() => {
    // Settings loaded from storage can predate newer fields — treat every
    // optional-shaped field defensively even where the type claims otherwise.
    const customSet = Array.isArray(settings.customSet) ? settings.customSet : [];
    const customSequence = Array.isArray(settings.customSequence) ? settings.customSequence : [];
    const pool = computeCharPool({
      kochLevel: settings.kochLevel,
      charSetMode: settings.charSetMode,
      digitsLevel: settings.digitsLevel,
      ...(customSet.length > 0 ? { customSet: [...customSet] } : {}),
      ...(customSequence.length > 0 ? { customSequence: [...customSequence] } : {}),
      ...(settings.slidingWindowStart !== undefined
        ? { slidingWindowStart: settings.slidingWindowStart }
        : {}),
      ...(settings.slidingWindowEnd !== undefined
        ? { slidingWindowEnd: settings.slidingWindowEnd }
        : {}),
    });
    const beliefs = aggregateHistoricalBeliefs(
      sessions.filter((s) => s && typeof s.letterAccuracy === 'object' && s.letterAccuracy !== null),
    );
    return pool
      .map((character) => {
        const belief = beliefs[character];
        if (!belief) return null;
        const attempts = belief.alpha + belief.beta - 2; // subtract Beta(1,1) prior
        if (attempts < MIN_ATTEMPTS) return null;
        const pError = betaPosteriorMeanError(belief);
        if (pError < MIN_ERROR_TO_SHOW) return null;
        return { character, pError };
      })
      .filter((entry): entry is { character: string; pError: number } => entry !== null)
      .sort((a, b) => b.pError - a.pError)
      .slice(0, MAX_FOCUS_CHARS);
  }, [sessions, settings]);

  if (focus.length === 0) return null;

  return (
    <div className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white px-4 py-3 flex items-center gap-3 flex-wrap">
      <span className="text-lg shrink-0" aria-hidden>
        🧠
      </span>
      <p className="text-sm text-violet-900">
        <span className="font-semibold">Trainer focus (current set):</span> the adaptive sampler will
        lean on these weak spots — separate from Teaching plan stages
      </p>
      <span className="flex gap-1.5">
        {focus.map(({ character, pError }) => (
          <span
            key={character}
            title={`Missed about ${Math.round(pError * 100)}% of the time recently (Bayesian)`}
            className="inline-flex items-center justify-center min-w-[1.75rem] h-7 px-1.5 rounded-lg bg-white border border-violet-300 text-violet-800 font-mono font-bold"
          >
            {character}
          </span>
        ))}
      </span>
    </div>
  );
}
