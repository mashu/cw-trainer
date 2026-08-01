'use client';

import React, { useMemo, useState } from 'react';

import { buildTeachingPlan, evaluateTeachingPlan } from '@/lib/curriculum';
import type { StageProgress } from '@/lib/curriculum';
import type { SessionResult, TrainingSettings } from '@/types';

export interface TeachingPlanCompactCardProps {
  readonly sessions: readonly SessionResult[];
  readonly settings: Pick<TrainingSettings, 'kochLevel' | 'customSequence'>;
}

function CompactGoalIndicator({
  label,
  achieved,
  current,
  target,
}: {
  readonly label: string;
  readonly achieved: boolean;
  readonly current: number;
  readonly target: number;
}): JSX.Element {
  return (
    <div
      className="flex items-center gap-1.5"
      title={`${label}: ${current}/${target}`}
    >
      <span
        aria-hidden
        className={`text-sm ${achieved ? 'text-emerald-600' : 'text-slate-400'}`}
      >
        {achieved ? '✓' : '○'}
      </span>
      <span className={`text-xs ${achieved ? 'text-slate-500 line-through' : 'text-slate-700'}`}>
        {label}
      </span>
      {target > 1 ? (
        <span className="text-xs text-slate-400 tabular-nums">
          {current}/{target}
        </span>
      ) : null}
    </div>
  );
}

function MinimalStageRow({ stage }: { readonly stage: StageProgress }): JSX.Element {
  const { status, goals } = stage;
  const achievedCount = goals.filter((g) => g.achieved).length;
  const icon = status === 'complete' ? '✓' : status === 'active' ? '→' : '·';

  return (
    <div className="flex items-center gap-2 py-1 text-xs">
      <span
        aria-hidden
        className={status === 'complete' ? 'text-emerald-600' : 'text-slate-400'}
      >
        {icon}
      </span>
      <span className="text-slate-700 truncate flex-1">{stage.stage.title}</span>
      <span className="text-slate-400 tabular-nums shrink-0">
        {achievedCount}/{goals.length}
      </span>
    </div>
  );
}

export function TeachingPlanCompactCard({
  sessions,
  settings,
}: TeachingPlanCompactCardProps): JSX.Element {
  const [showAll, setShowAll] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const plan = useMemo(() => {
    const sequence =
      Array.isArray(settings.customSequence) && settings.customSequence.length > 0
        ? settings.customSequence
        : undefined;
    return sequence ? buildTeachingPlan(sequence) : buildTeachingPlan();
  }, [settings.customSequence]);

  const progress = useMemo(
    () => evaluateTeachingPlan(sessions, settings.kochLevel, plan),
    [sessions, settings.kochLevel, plan],
  );

  const activeStage = progress.stages[progress.activeStageIndex];
  const completedPercent = Math.round(
    (progress.completedStageCount / Math.max(1, progress.stages.length)) * 100,
  );

  const visibleStages = showAll
    ? progress.stages
    : activeStage
      ? [activeStage]
      : [];

  const certSummary = useMemo(() => {
    const earned = progress.certificates.earnedCount;
    const total = progress.certificates.totalCells;
    return { earned, total };
  }, [progress.certificates]);

  return (
    <section
      aria-labelledby="teaching-plan-heading"
      className="rounded-xl border border-slate-200 bg-white p-3 space-y-2"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 id="teaching-plan-heading" className="text-sm font-bold text-slate-800">
            🎓 Teaching plan
          </h3>
          <button
            type="button"
            onClick={() => setShowHelp((v) => !v)}
            className="inline-flex items-center justify-center w-4 h-4 text-[10px] rounded-full bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200"
            title="How this works"
            aria-label="Show teaching plan help"
          >
            ?
          </button>
        </div>
        <span className="text-xs text-slate-500 tabular-nums">
          {progress.completedStageCount}/{progress.stages.length}
        </span>
      </div>

      {/* Overall progress bar */}
      <div className="h-1 rounded-full bg-slate-100 overflow-hidden" aria-hidden>
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all"
          style={{ width: `${completedPercent}%` }}
        />
      </div>

      {/* Help section - collapsible */}
      {showHelp ? (
        <div className="rounded-lg bg-indigo-50/50 border border-indigo-100 p-2 space-y-1 text-xs text-slate-700">
          <p>
            <span className="font-semibold">Stages</span> use session accuracy (≥90% in quality
            sessions). Letter mastery (Stats/trophies) is separate.
          </p>
          <p>
            <span className="font-semibold">Certificates</span> are independent speed milestones
            (5/13/20 WPM). Details in Stats.
          </p>
        </div>
      ) : null}

      {/* Active stage or completion */}
      {activeStage ? (
        <div className="space-y-1.5">
          {/* Stage name */}
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-semibold text-slate-800 truncate">
              {activeStage.stage.title}
            </span>
          </div>

          {/* Goals - compact indicators */}
          <div className="space-y-0.5">
            {activeStage.goals.map((goal) => {
              // Extract short labels
              let shortLabel = goal.label;
              if (goal.id === 'reach-level') {
                const match = goal.label.match(/level (\d+)/i);
                shortLabel = match ? `Level ${match[1]}` : 'Reach level';
              } else if (goal.id === 'quality-sessions') {
                shortLabel = 'Quality';
              } else if (goal.id === 'copy-test') {
                shortLabel = 'Copy test';
              }

              return (
                <CompactGoalIndicator
                  key={goal.id}
                  label={shortLabel}
                  achieved={goal.achieved}
                  current={goal.current}
                  target={goal.target}
                />
              );
            })}
          </div>

          {/* Exposure - compact */}
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-xs text-slate-600">
              {activeStage.coverage.coveredCharacters.length}/{activeStage.stage.characters.length}{' '}
              exposed
            </span>
            <div
              className="h-1 min-w-12 flex-1 overflow-hidden rounded-full bg-indigo-100"
              role="progressbar"
              aria-label={`Exposure: ${activeStage.coverage.coveredCharacters.length} of ${activeStage.stage.characters.length}`}
              aria-valuenow={activeStage.coverage.coveredCharacters.length}
              aria-valuemin={0}
              aria-valuemax={activeStage.stage.characters.length}
            >
              <div
                className="h-full rounded-full bg-indigo-500"
                style={{
                  width: `${Math.round((activeStage.coverage.coveredCharacters.length / Math.max(1, activeStage.stage.characters.length)) * 100)}%`,
                }}
              />
            </div>
          </div>

          {/* Missing characters - one line only if there are any */}
          {activeStage.coverage.missingCharacters.length > 0 &&
          activeStage.coverage.missingCharacters.length <= 10 ? (
            <p className="text-[11px] text-slate-500">
              Missing:{' '}
              <span className="font-mono font-semibold">
                {activeStage.coverage.missingCharacters.join(' ')}
              </span>
            </p>
          ) : null}

          {/* Next action - very short */}
          {((): JSX.Element | null => {
            const nextGoal = activeStage.goals.find((g) => !g.achieved);
            if (!nextGoal) return null;
            let action = nextGoal.label;
            if (nextGoal.id === 'reach-level') {
              const match = action.match(/level (\d+)/i);
              action = match ? `Reach level ${match[1]}` : action;
            } else if (nextGoal.id === 'quality-sessions') {
              action = `${nextGoal.target - nextGoal.current} more quality sessions`;
            } else if (nextGoal.id === 'copy-test') {
              action = 'Pass copy test (100+ chars at 90%)';
            }
            return <p className="text-[11px] text-slate-600">Next: {action}</p>;
          })()}
        </div>
      ) : (
        <p className="text-sm text-emerald-700 font-semibold">Plan complete! 🎉</p>
      )}

      {/* Certificates - tiny summary */}
      <div className="flex items-center justify-between pt-1 border-t border-slate-100">
        <span className="text-xs text-slate-600">Speed certs</span>
        <span className="text-xs text-slate-500 tabular-nums">
          {certSummary.earned}/{certSummary.total}
        </span>
      </div>

      {/* Show all toggle */}
      {progress.stages.length > 1 ? (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="w-full text-xs text-blue-600 hover:text-blue-800 font-semibold"
        >
          {showAll ? 'Show current only' : `Show all ${progress.stages.length} stages`}
        </button>
      ) : null}

      {/* All stages - minimal rows */}
      {showAll && visibleStages.length > 1 ? (
        <div className="pt-1 border-t border-slate-100 space-y-0">
          {progress.stages.map((stage) => (
            <MinimalStageRow key={stage.stage.id} stage={stage} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
