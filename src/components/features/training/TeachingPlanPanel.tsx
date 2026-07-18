'use client';

import React, { useMemo, useState } from 'react';

import { buildTeachingPlan, evaluateTeachingPlan } from '@/lib/curriculum';
import type { SpeedCertificateMatrix, StageProgress } from '@/lib/curriculum';
import type { SessionResult, TrainingSettings } from '@/types';

export interface TeachingPlanPanelProps {
  readonly sessions: readonly SessionResult[];
  readonly settings: Pick<TrainingSettings, 'kochLevel' | 'customSequence'>;
}

function GoalRow({ label, achieved, current, target }: {
  readonly label: string;
  readonly achieved: boolean;
  readonly current: number;
  readonly target: number;
}): JSX.Element {
  return (
    <li className="flex items-center gap-2 text-sm">
      <span aria-hidden className={achieved ? 'text-emerald-600' : 'text-slate-300'}>
        {achieved ? '✔' : '○'}
      </span>
      <span className={achieved ? 'text-slate-500 line-through decoration-emerald-300' : 'text-slate-700'}>
        {label}
      </span>
      {target > 1 ? (
        <span className="ml-auto text-xs text-slate-400 tabular-nums">
          {current}/{target}
        </span>
      ) : null}
    </li>
  );
}

function StageCard({ progress, expanded }: {
  readonly progress: StageProgress;
  readonly expanded: boolean;
}): JSX.Element {
  const { stage, status, goals, bestCopyTestAccuracy } = progress;
  const achievedCount = goals.filter((g) => g.achieved).length;
  const border =
    status === 'complete'
      ? 'border-emerald-200 bg-emerald-50/50'
      : status === 'active'
        ? 'border-blue-200 bg-blue-50/50'
        : 'border-slate-200 bg-white';

  return (
    <div className={`rounded-xl border px-3 py-2 ${border}`}>
      <div className="flex items-center gap-2">
        <span aria-hidden className="text-base">
          {status === 'complete' ? '🏁' : status === 'active' ? '📍' : '🔒'}
        </span>
        <p className="text-sm font-semibold text-slate-800 truncate">{stage.title}</p>
        <span className="ml-auto text-xs text-slate-500 tabular-nums shrink-0">
          {achievedCount}/{goals.length}
        </span>
      </div>
      {expanded ? (
        <ul className="mt-2 space-y-1">
          {goals.map((goal) => (
            <GoalRow
              key={goal.id}
              label={goal.label}
              achieved={goal.achieved}
              current={goal.current}
              target={goal.target}
            />
          ))}
          {bestCopyTestAccuracy !== undefined ? (
            <li className="text-xs text-slate-500 pl-6">
              Best copy-test accuracy: {Math.round(bestCopyTestAccuracy * 100)}%
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * Structured teaching plan: staged goals over the Koch sequence with copy
 * tests, plus historic-exam-style speed certificates. All progress is derived
 * from saved session history — regular training sessions are the tests.
 */
export function TeachingPlanPanel({ sessions, settings }: TeachingPlanPanelProps): JSX.Element {
  const [showAll, setShowAll] = useState(false);

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
  const visibleStages = showAll
    ? progress.stages
    : progress.stages.filter(
        (s, i) => s.status === 'active' || i === progress.activeStageIndex - 1,
      );

  return (
    <section
      aria-labelledby="teaching-plan-heading"
      className="rounded-xl border border-slate-200 bg-white p-4 space-y-3"
    >
      <div className="flex items-center gap-2 flex-wrap">
        <h3 id="teaching-plan-heading" className="text-sm font-bold text-slate-800">
          🎓 Teaching plan
        </h3>
        <span className="text-xs text-slate-500">
          {progress.completedStageCount}/{progress.stages.length} stages complete
        </span>
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="ml-auto text-xs font-semibold text-blue-600 hover:text-blue-800"
        >
          {showAll ? 'Show current' : 'Show all stages'}
        </button>
      </div>

      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden" aria-hidden>
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all"
          style={{
            width: `${Math.round((progress.completedStageCount / Math.max(1, progress.stages.length)) * 100)}%`,
          }}
        />
      </div>

      <div className="space-y-2">
        {visibleStages.map((stageProgress) => (
          <StageCard
            key={stageProgress.stage.id}
            progress={stageProgress}
            expanded={showAll || stageProgress.status === 'active'}
          />
        ))}
        {activeStage === undefined ? (
          <p className="text-sm text-emerald-700 font-semibold">
            Plan complete — every stage passed. 🎉
          </p>
        ) : null}
      </div>

      <CertificateMatrixTable
        matrix={progress.certificates}
        activeStageIndex={progress.activeStageIndex}
        showAll={showAll}
      />
    </section>
  );
}

/**
 * Speed-certificate matrix: one row per stage, one column per exam speed.
 * A cell is earned by a SINGLE session — 100+ characters copied correctly from
 * groups played at or above that speed, at ≥90% at-speed accuracy, at or above
 * the stage's exit level. The final row spans the full character set: those are
 * the historic 5/13/20 WPM certificates and unlock trophies.
 */
function CertificateMatrixTable({
  matrix,
  activeStageIndex,
  showAll,
}: {
  readonly matrix: SpeedCertificateMatrix;
  readonly activeStageIndex: number;
  readonly showAll: boolean;
}): JSX.Element {
  const lastIndex = matrix.rows.length - 1;
  const visibleRows = showAll
    ? matrix.rows
    : matrix.rows.filter(
        (row) =>
          row.stage.index <= activeStageIndex ||
          row.stage.index === lastIndex ||
          row.cells.some((cell) => cell.earned),
      );

  return (
    <div className="space-y-1 pt-1">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Speed certificates
        </p>
        <span className="text-xs text-slate-400">
          {matrix.earnedCount}/{matrix.totalCells} earned
        </span>
        {matrix.earnedCount > 0 ? (
          <button
            type="button"
            onClick={() => void shareCertificates(matrix)}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800"
            title="Share your earned copy certificates"
          >
            Share
          </button>
        ) : null}
      </div>
      <div className="overflow-x-auto">
        <table className="text-xs w-full max-w-md">
          <thead>
            <tr>
              <th className="text-left font-semibold text-slate-500 py-1 pr-2">Stage</th>
              {matrix.rows[0]?.cells.map((cell) => (
                <th key={cell.speed} className="text-center font-semibold text-slate-500 py-1 px-2">
                  {cell.speed} WPM
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={row.stage.id} className="border-t border-slate-100">
                <td
                  className="py-1 pr-2 text-slate-600 whitespace-nowrap"
                  title={row.stage.characters.join(' ')}
                >
                  {row.stage.index === lastIndex ? '★ Full set' : `Stage ${row.stage.index + 1}`}
                </td>
                {row.cells.map((cell) => (
                  <td key={cell.speed} className="text-center py-1 px-2">
                    {cell.earned ? (
                      <span title={`Earned: ${cell.targetChars}+ correct at ≥${cell.speed} WPM in one session`}>
                        🏅
                      </span>
                    ) : cell.bestCorrectChars > 0 ? (
                      <span
                        className="text-slate-500 tabular-nums"
                        title={`Best run: ${cell.bestCorrectChars}/${cell.targetChars} correct at speed (${Math.round(cell.bestAccuracy * 100)}% accuracy)`}
                      >
                        {cell.bestCorrectChars}/{cell.targetChars}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-400">
        Earned in a single session: {matrix.rows[0]?.cells[0]?.targetChars ?? 100}+ characters
        copied correctly from groups played at the certificate speed, ≥90% accuracy at speed. With
        variable speed only the groups that met the speed count.
      </p>
    </div>
  );
}

async function shareCertificates(matrix: SpeedCertificateMatrix): Promise<void> {
  const fullSet = matrix.fullAlphabetEarnedSpeeds.map((speed) => `${speed} WPM (full alphabet)`);
  const summary =
    fullSet.length > 0
      ? fullSet.join(', ')
      : `${matrix.earnedCount} stage certificate${matrix.earnedCount > 1 ? 's' : ''}`;
  const text = `Solid-copy Morse certificates earned: ${summary} — trained with CW Trainer. 🎧🔑`;
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      await navigator.share({ text });
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
    }
  } catch {
    /* user cancelled or share unavailable */
  }
}
