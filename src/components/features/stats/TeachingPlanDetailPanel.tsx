'use client';

import React, { useMemo } from 'react';

import { CERT_MIN_CORRECT_CHARS, buildTeachingPlan, evaluateTeachingPlan } from '@/lib/curriculum';
import type {
  CharacterCoverage,
  SpeedCertificateMatrix,
  StageProgress,
} from '@/lib/curriculum';
import {
  MASTERED_MIN_ACCURACY,
  MASTERED_MIN_ATTEMPTS,
  buildCharacterDiagnostics,
} from '@/lib/scoring/characterDiagnostics';
import type { SessionResult, TrainingSettings } from '@/types';

export interface TeachingPlanDetailPanelProps {
  readonly sessions: readonly SessionResult[];
  readonly settings: Pick<TrainingSettings, 'kochLevel' | 'customSequence'>;
}

function GoalRow({
  label,
  achieved,
  current,
  target,
  helpText,
}: {
  readonly label: string;
  readonly achieved: boolean;
  readonly current: number;
  readonly target: number;
  readonly helpText?: string;
}): JSX.Element {
  return (
    <li className="flex items-center gap-2 text-sm">
      <span aria-hidden className={achieved ? 'text-emerald-600' : 'text-slate-300'}>
        {achieved ? '✔' : '○'}
      </span>
      <span
        className={
          achieved ? 'text-slate-500 line-through decoration-emerald-300' : 'text-slate-700'
        }
        title={helpText}
      >
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

function CoverageSummary({
  coverage,
  requiredCount,
  label = 'Exposure',
}: {
  readonly coverage: CharacterCoverage;
  readonly requiredCount: number;
  readonly label?: string;
}): JSX.Element {
  const exposedCount = coverage.coveredCharacters.length;
  const exposurePercent = Math.round((exposedCount / Math.max(1, requiredCount)) * 100);

  return (
    <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 px-2.5 py-2">
      <div className="flex items-center gap-2">
        <p className="shrink-0 text-xs font-semibold text-indigo-800">
          {label}: {exposedCount}/{requiredCount} exposed
        </p>
        <div
          role="progressbar"
          aria-label={`${label}: ${exposedCount} of ${requiredCount} characters exposed`}
          aria-valuemin={0}
          aria-valuemax={requiredCount}
          aria-valuenow={exposedCount}
          className="h-1.5 min-w-12 flex-1 overflow-hidden rounded-full bg-indigo-100"
        >
          <div
            className="h-full rounded-full bg-indigo-500 transition-all"
            style={{ width: `${exposurePercent}%` }}
          />
        </div>
      </div>
      {coverage.missingCharacters.length > 0 ? (
        <p className="mt-1 text-[11px] text-slate-600">
          Missing:{' '}
          <span className="font-mono font-semibold">{coverage.missingCharacters.join(' ')}</span>
        </p>
      ) : null}
    </div>
  );
}

function StageDetailCard({
  progress,
  sessions,
  showMastery,
}: {
  readonly progress: StageProgress;
  readonly sessions: readonly SessionResult[];
  readonly showMastery: boolean;
}): JSX.Element {
  const {
    stage,
    status,
    goals,
    coverage,
    qualityCoverage,
    copyTestCoverage,
    bestCopyTestAccuracy,
  } = progress;

  const achievedCount = goals.filter((g) => g.achieved).length;
  const qualityGoal = goals.find((goal) => goal.id === 'quality-sessions');
  const copyTestGoal = goals.find((goal) => goal.id === 'copy-test');

  const qualityCoverageBlocksProgress =
    qualityGoal !== undefined &&
    qualityGoal.current === qualityGoal.target &&
    !qualityGoal.achieved &&
    qualityCoverage.missingCharacters.length > 0;

  const copyTestCoverageBlocksProgress =
    copyTestGoal !== undefined &&
    copyTestGoal.current === copyTestGoal.target &&
    !copyTestGoal.achieved &&
    copyTestCoverage.missingCharacters.length > 0;

  const border =
    status === 'complete'
      ? 'border-emerald-200 bg-emerald-50/50'
      : status === 'active'
        ? 'border-blue-200 bg-blue-50/50'
        : 'border-slate-200 bg-white';

  const mastery = useMemo(() => {
    if (!showMastery) return null;
    const stageChars = new Set(stage.characters.map((c) => c.toUpperCase()));
    const pool = Array.from(stageChars);
    const diagnostics = buildCharacterDiagnostics({ sessions, pool });
    const masteredCount = diagnostics.filter((d) => d.status === 'mastered').length;
    return { masteredCount, totalCharacters: pool.length };
  }, [showMastery, stage.characters, sessions]);

  return (
    <div className={`rounded-xl border px-4 py-3 ${border}`}>
      <div className="flex items-center gap-2 mb-2">
        <span aria-hidden className="text-base">
          {status === 'complete' ? '🏁' : status === 'active' ? '📍' : '🔒'}
        </span>
        <p className="text-sm font-semibold text-slate-800">{stage.title}</p>
        <span className="ml-auto text-xs text-slate-500 tabular-nums shrink-0">
          {achievedCount}/{goals.length}
        </span>
      </div>

      {mastery && mastery.totalCharacters > 0 ? (
        <div className="mb-2 rounded bg-emerald-50 border border-emerald-200 px-2 py-1.5">
          <p className="text-xs text-emerald-800">
            <span className="font-semibold">Mastery bonus:</span> {mastery.masteredCount}/
            {mastery.totalCharacters} stage letters mastered (≥{MASTERED_MIN_ATTEMPTS} attempts, ≥
            {Math.round(MASTERED_MIN_ACCURACY * 100)}% letter accuracy — separate from stage
            completion)
          </p>
        </div>
      ) : null}

      <ul className="space-y-1.5">
        {goals.map((goal) => (
          <GoalRow
            key={goal.id}
            label={goal.label}
            achieved={goal.achieved}
            current={goal.current}
            target={goal.target}
            {...(goal.id === 'quality-sessions' || goal.id === 'copy-test'
              ? { helpText: 'Based on session accuracy' }
              : {})}
          />
        ))}
        <li>
          <CoverageSummary
            coverage={coverage}
            requiredCount={stage.characters.length}
            label="Exposure (transmitted, not accuracy)"
          />
        </li>
        {qualityCoverageBlocksProgress ? (
          <li>
            <CoverageSummary
              coverage={qualityCoverage}
              requiredCount={stage.characters.length}
              label="Quality-session exposure"
            />
          </li>
        ) : null}
        {copyTestCoverageBlocksProgress ? (
          <li>
            <CoverageSummary
              coverage={copyTestCoverage}
              requiredCount={stage.characters.length}
              label="Copy-test exposure"
            />
          </li>
        ) : null}
        {bestCopyTestAccuracy !== undefined ? (
          <li className="text-xs text-slate-500 pl-6">
            Best copy-test session accuracy: {Math.round(bestCopyTestAccuracy * 100)}%
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function CertificateMatrixTable({
  matrix,
}: {
  readonly matrix: SpeedCertificateMatrix;
}): JSX.Element {
  const lastIndex = matrix.rows.length - 1;

  return (
    <div className="overflow-x-auto">
      <table className="text-xs w-full">
        <thead>
          <tr>
            <th className="text-left font-semibold text-slate-600 py-1 pr-2">Stage</th>
            {matrix.rows[0]?.cells.map((cell) => (
              <th key={cell.speed} className="text-center font-semibold text-slate-600 py-1 px-2">
                {cell.speed} WPM
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.rows.map((row) => (
            <tr key={row.stage.id} className="border-t border-slate-100">
              <td
                className="py-1.5 pr-2 text-slate-700 whitespace-nowrap"
                title={row.stage.characters.join(' ')}
              >
                {row.stage.index === lastIndex ? '★ Full alphabet' : `Stage ${row.stage.index + 1}`}
              </td>
              {row.cells.map((cell) => (
                <td key={cell.speed} className="text-center py-1.5 px-2">
                  {cell.earned ? (
                    <span
                      title={`Earned: ${cell.targetChars}+ correct at ≥${cell.speed} WPM in one session`}
                    >
                      🏅
                    </span>
                  ) : cell.bestCorrectChars > 0 ? (
                    <span
                      className="text-slate-500 tabular-nums"
                      title={`Best run: ${cell.bestCorrectChars}/${cell.targetChars} correct at speed (${Math.round(cell.bestAccuracy * 100)}% at-speed accuracy)`}
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
  );
}

async function shareCertificates(matrix: SpeedCertificateMatrix): Promise<void> {
  const fullSet = matrix.fullAlphabetEarnedSpeeds.map((speed) => `${speed} WPM (full alphabet)`);
  if (fullSet.length === 0) return;
  const text = `Solid-copy Morse certificates earned: ${fullSet.join(', ')} — trained with CW Trainer. 🎧🔑`;
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

export function TeachingPlanDetailPanel({
  sessions,
  settings,
}: TeachingPlanDetailPanelProps): JSX.Element {
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

  return (
    <section
      aria-labelledby="teaching-plan-detail-heading"
      className="rounded-xl border border-slate-200 bg-white p-4 space-y-4"
    >
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 id="teaching-plan-detail-heading" className="text-lg font-bold text-slate-800">
            🎓 Teaching Plan Progress
          </h3>
          <span className="text-sm text-slate-600 tabular-nums">
            {progress.completedStageCount}/{progress.stages.length} stages
          </span>
        </div>

        <div className="h-2 rounded-full bg-slate-100 overflow-hidden mb-3" aria-hidden>
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all"
            style={{ width: `${completedPercent}%` }}
          />
        </div>

        <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-1.5 text-sm text-slate-700">
          <p>
            <span className="font-semibold">Stage completion</span> uses{' '}
            <span className="font-semibold text-indigo-700">session accuracy</span> (≥90% in
            quality sessions, 100+ chars in copy test).
          </p>
          <p>
            <span className="font-semibold">Letter mastery</span> (shown in mastery bonus, trophies)
            uses <span className="font-semibold text-emerald-700">letter accuracy</span> (≥90% over
            ≥5 attempts per letter).
          </p>
          <p>
            <span className="font-semibold">Exposure</span> = characters transmitted in group
            practice (not the same as accuracy).
          </p>
        </div>
      </div>

      {/* Stages */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-slate-700">Stages</h4>
        {progress.stages.map((stageProgress) => (
          <StageDetailCard
            key={stageProgress.stage.id}
            progress={stageProgress}
            sessions={sessions}
            showMastery={stageProgress.status === 'active'}
          />
        ))}
        {activeStage === undefined ? (
          <p className="text-sm text-emerald-700 font-semibold">
            All stages complete — every stage passed! 🎉
          </p>
        ) : null}
      </div>

      {/* Speed Certificates */}
      <div className="pt-3 border-t border-slate-200 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-700">Speed Certificates</h4>
          {progress.certificates.fullAlphabetEarnedSpeeds.length > 0 ? (
            <button
              type="button"
              onClick={() => void shareCertificates(progress.certificates)}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800"
              title="Share your earned full-alphabet certificates"
            >
              Share
            </button>
          ) : null}
        </div>

        <div className="rounded-lg bg-amber-50/50 border border-amber-100 p-3 space-y-1.5 text-sm text-slate-700">
          <p>
            Historic exam milestones at <span className="font-semibold">5 / 13 / 20 WPM</span>{' '}
            (Novice / General / Extra). Earned in a single session: {CERT_MIN_CORRECT_CHARS}+
            correct characters from groups played at that speed, ≥90%{' '}
            <span className="font-semibold text-amber-800">at-speed accuracy</span>.
          </p>
          <p>
            <span className="font-semibold">Certificates are independent from stages</span> — you
            can earn one without completing a stage, or complete a stage without earning a
            certificate. Full-alphabet certificates unlock trophies.
          </p>
        </div>

        <CertificateMatrixTable matrix={progress.certificates} />
      </div>
    </section>
  );
}
