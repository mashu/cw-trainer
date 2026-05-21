'use client';

import React, { useEffect, useState } from 'react';

import { ActivityHeatmap } from '@/components/ui/charts/ActivityHeatmap';
import { AutoLevelAdjustProgressCard } from '@/components/ui/training/AutoLevelAdjustProgressCard';
import { NewLetterPlayer } from '@/components/ui/training/NewLetterPlayer';
import { useAutoLevelAdjustProgress } from '@/hooks/useAutoLevelAdjustProgress';
import type { AutoAdjustProfileVariant } from '@/lib/kochAutoAdjust';
import { settingsToSharedAudioProps } from '@/lib/settingsToSharedAudioProps';
import type { TrainingSettings } from '@/types';

const DEFAULT_TIPS = [
  'Hear the group first, then type it—let it buffer so you recognize whole letters and words.',
  'Stay relaxed; short, regular sessions work better than long cramming.',
  'If you fall behind, skip to the next group to keep rhythm and avoid pile-up.',
];

const ROTATE_MS = 5000;

function TrainingTipsCarousel({
  tips,
}: {
  readonly tips: readonly string[];
}): JSX.Element {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (tips.length === 0) {
      return;
    }
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % tips.length);
    }, ROTATE_MS);
    return (): void => clearInterval(id);
  }, [tips]);

  return (
    <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50/80 to-orange-50/50 px-4 py-3 flex items-center gap-3 min-h-[3.25rem]">
      <span className="text-amber-600 shrink-0" aria-hidden>
        💡
      </span>
      <div className="flex-1 min-w-0 relative min-h-[1.5rem] overflow-hidden">
        {tips.map((tip, i) => (
          <p
            key={i}
            className="text-sm text-slate-700 absolute inset-0 transition-opacity duration-500 ease-in-out break-words overflow-hidden"
            style={{
              opacity: i === index ? 1 : 0,
              pointerEvents: i === index ? 'auto' : 'none',
            }}
            aria-hidden={i !== index}
            aria-live="polite"
          >
            {tip}
          </p>
        ))}
      </div>
      <div className="flex gap-1 shrink-0" aria-hidden>
        {tips.map((_, i) => (
          <span
            key={i}
            className={`inline-block w-1.5 h-1.5 rounded-full transition-opacity duration-300 ${i === index ? 'bg-amber-500 opacity-100' : 'bg-amber-300 opacity-40'}`}
          />
        ))}
      </div>
    </div>
  );
}

export interface TrainingHomeViewProps {
  readonly sessions: ReadonlyArray<{
    readonly date: string;
    readonly timestamp: number;
    readonly count: number;
    readonly durationMs?: number;
    readonly groupCount?: number;
    readonly accuracy?: number;
  }>;
  readonly settings: TrainingSettings;
  readonly lastAccuracyPercent: number;
  readonly sessionCount: number;
  readonly onStartTraining: () => void;
  readonly onViewStats: () => void;
  readonly title?: string;
  readonly description?: string;
  readonly startLabel?: string;
  readonly viewStatsLabel?: string;
  readonly listeningPrompt?: string;
  readonly tips?: readonly string[];
  /** Optional region (e.g. echo-mode Morse decoder warm-up) rendered between the intro card and tips. */
  readonly beforeTipsSlot?: React.ReactNode;
  /** Which auto-adjust profile counters to show (group vs echo). */
  readonly autoAdjustProfile?: AutoAdjustProfileVariant;
}

export function TrainingHomeView({
  sessions,
  settings,
  lastAccuracyPercent,
  sessionCount,
  onStartTraining,
  onViewStats,
  title = 'Group Training',
  description = 'Hear the group first, then answer from memory.',
  startLabel = '🚀 Start Training',
  viewStatsLabel = '📊 View Stats',
  listeningPrompt = 'New to this level? Listen to the letters:',
  tips = DEFAULT_TIPS,
  beforeTipsSlot,
  autoAdjustProfile = 'group',
}: TrainingHomeViewProps): JSX.Element {
  const levelAdjustProgress = useAutoLevelAdjustProgress(
    settings,
    autoAdjustProfile,
    sessionCount + lastAccuracyPercent,
  );
  const profileLabel = autoAdjustProfile === 'echo' ? 'Echo' : 'Group';
  const charSetMode = settings.charSetMode ?? 'koch';
  const levelKpiLabel =
    charSetMode === 'digits'
      ? 'Digits level'
      : charSetMode === 'mixed'
        ? 'Levels'
        : 'Koch level';
  const levelKpiValue =
    charSetMode === 'digits'
      ? String(settings.digitsLevel ?? 10)
      : charSetMode === 'mixed'
        ? `${settings.kochLevel} / ${settings.digitsLevel ?? 10}`
        : String(settings.kochLevel);

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-bold text-slate-800">{title}</h2>
        <p className="text-sm text-slate-600 mt-1">{description}</p>
      </header>

      <section aria-labelledby="practice-activity-heading">
        <h3
          id="practice-activity-heading"
          className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2"
        >
          Practice activity
        </h3>
        <ActivityHeatmap sessions={sessions} monthsPerPage={3} startOfWeek={1} />
      </section>

      {sessionCount > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-50 to-white border border-emerald-100">
            <p className="text-xs uppercase tracking-wide text-emerald-700 font-semibold">
              Last accuracy
            </p>
            <p className="text-2xl font-extrabold text-emerald-800 mt-0.5">
              {lastAccuracyPercent}%
            </p>
          </div>
          <div className="p-3 rounded-xl bg-gradient-to-br from-blue-50 to-white border border-blue-100">
            <p className="text-xs uppercase tracking-wide text-blue-700 font-semibold">
              Sessions
            </p>
            <p className="text-2xl font-extrabold text-blue-800 mt-0.5">{sessionCount}</p>
          </div>
          <div className="p-3 rounded-xl bg-gradient-to-br from-purple-50 to-white border border-purple-100">
            <p className="text-xs uppercase tracking-wide text-purple-700 font-semibold">
              {levelKpiLabel}
            </p>
            <p className="text-2xl font-extrabold text-purple-800 mt-0.5">{levelKpiValue}</p>
          </div>
        </div>
      )}

      <section className="flex flex-col gap-3 min-w-0" aria-label="Character preview">
        <div className="flex flex-col gap-3 p-3 rounded-xl border border-blue-100 bg-blue-50/50 min-w-0">
          <p className="text-sm text-slate-600">{listeningPrompt}</p>
          <div className="w-full min-w-0 overflow-x-auto">
            <NewLetterPlayer settings={settingsToSharedAudioProps(settings)} />
          </div>
        </div>
        {levelAdjustProgress !== null ? (
          <AutoLevelAdjustProgressCard
            progress={levelAdjustProgress}
            profileLabel={profileLabel}
          />
        ) : null}
      </section>

      {beforeTipsSlot != null ? beforeTipsSlot : null}

      <TrainingTipsCarousel tips={tips} />

      <div className="flex justify-center gap-3 flex-wrap pt-1">
        <button
          onClick={onStartTraining}
          className="px-12 py-4 bg-gradient-to-r from-emerald-500 to-green-600 text-white text-xl font-bold rounded-xl hover:from-emerald-600 hover:to-green-700 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl"
        >
          {startLabel}
        </button>
        <button
          onClick={onViewStats}
          className="px-12 py-4 bg-white text-slate-700 text-xl font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 transition-all duration-200 shadow-sm hover:shadow"
        >
          {viewStatsLabel}
        </button>
      </div>
    </div>
  );
}
