'use client';

import React, { useMemo } from 'react';

import {
  attemptedStageForLevel,
  buildTeachingPlan,
  CERT_MIN_ACCURACY,
  evaluateSessionSpeedRun,
  evaluateSpeedCertificateMatrix,
  evaluateTeachingPlan,
} from '@/lib/curriculum';
import type { SessionResult, TrainingSettings } from '@/types';

export interface NextGoalCardProps {
  readonly sessions: readonly SessionResult[];
  readonly settings: Pick<TrainingSettings, 'kochLevel' | 'customSequence'>;
  readonly lastScore: number;
}

const isGroupSession = (session: SessionResult): boolean =>
  session.mode === undefined || session.mode === 'group';

/**
 * Results-screen cliffhanger: how this session compares to the personal best,
 * and the nearest unfinished teaching-plan goal — a concrete reason to press
 * "Train Again" instead of closing the tab.
 */
export function NextGoalCard({ sessions, settings, lastScore }: NextGoalCardProps): JSX.Element | null {
  const bestLine = useMemo(() => {
    const otherScores = sessions
      .filter(isGroupSession)
      .map((s) => s.score)
      .filter((score) => Number.isFinite(score));
    const best = otherScores.length > 0 ? Math.max(...otherScores) : 0;
    if (best <= 0) return null;
    if (lastScore >= best) {
      return { emoji: '🏆', text: 'New personal best score!' };
    }
    const gap = Math.max(1, Math.round(best - lastScore));
    return { emoji: '📈', text: `${gap} points off your personal best (${Math.round(best)}).` };
  }, [sessions, lastScore]);

  const goalLine = useMemo(() => {
    const sequence =
      Array.isArray(settings.customSequence) && settings.customSequence.length > 0
        ? settings.customSequence
        : undefined;
    const plan = sequence ? buildTeachingPlan(sequence) : buildTeachingPlan();
    const progress = evaluateTeachingPlan(sessions, settings.kochLevel, plan);
    const active = progress.stages[progress.activeStageIndex];
    if (!active) return null;
    const nextGoal = active.goals.find((goal) => !goal.achieved);
    if (!nextGoal) return null;
    const stageNumber = active.stage.index + 1;
    if (nextGoal.id === 'quality-sessions') {
      const remaining = Math.max(1, nextGoal.target - nextGoal.current);
      return `${remaining} more session${remaining > 1 ? 's' : ''} at ≥90% completes a Stage ${stageNumber} goal.`;
    }
    if (nextGoal.id === 'copy-test') {
      return `Pass the Stage ${stageNumber} copy test: 100+ characters at ≥90%.`;
    }
    return `Next up: reach level ${active.stage.levelEnd} to work on Stage ${stageNumber}.`;
  }, [sessions, settings.kochLevel, settings.customSequence]);

  const certLine = useMemo(() => {
    const groupSessions = sessions.filter(isGroupSession);
    const latest = groupSessions[groupSessions.length - 1];
    if (!latest) return null;
    const sequence =
      Array.isArray(settings.customSequence) && settings.customSequence.length > 0
        ? settings.customSequence
        : undefined;
    const plan = sequence ? buildTeachingPlan(sequence) : buildTeachingPlan();
    const stage = attemptedStageForLevel(plan, latest.kochLevel);
    if (!stage) return null;
    const matrix = evaluateSpeedCertificateMatrix(sessions, plan);
    const row = matrix.rows[stage.index];
    if (!row) return null;
    const stageLabel =
      stage.index === matrix.rows.length - 1 ? 'full-alphabet' : `Stage ${stage.index + 1}`;

    // Newly earned this session beats any near-miss message.
    const earnedNow = row.cells.find(
      (cell) => cell.earned && cell.earnedSessionTimestamp === latest.timestamp,
    );
    if (earnedNow) {
      return {
        emoji: '🏅',
        text: `Certificate earned: ${stageLabel} solid copy at ${earnedNow.speed} WPM!`,
      };
    }

    // Nearest miss among unearned speeds: the run with the most progress this session.
    let best: { speed: number; run: ReturnType<typeof evaluateSessionSpeedRun> } | null = null;
    for (const cell of row.cells) {
      if (cell.earned) continue;
      const run = evaluateSessionSpeedRun(latest, cell.speed);
      if (run.totalChars === 0) continue;
      if (!best || run.correctChars > best.run.correctChars) {
        best = { speed: cell.speed, run };
      }
    }
    if (!best || best.run.correctChars === 0) return null;
    const { run, speed } = best;
    if (run.correctChars < run.totalChars || run.correctChars < 100) {
      const short = Math.max(0, 100 - run.correctChars);
      if (short > 0) {
        return {
          emoji: '📜',
          text: `${stageLabel} certificate at ${speed} WPM: ${run.correctChars}/100 correct at speed — ${short} short. One more run?`,
        };
      }
    }
    if (run.accuracy < CERT_MIN_ACCURACY) {
      return {
        emoji: '📜',
        text: `${stageLabel} certificate at ${speed} WPM: enough characters, but ${Math.round(run.accuracy * 100)}% at-speed accuracy — need ${Math.round(CERT_MIN_ACCURACY * 100)}%.`,
      };
    }
    return null;
  }, [sessions, settings.customSequence]);

  if (!bestLine && !goalLine && !certLine) return null;

  return (
    <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-4 space-y-1.5">
      {bestLine ? (
        <p className="text-sm text-indigo-900">
          <span aria-hidden className="mr-1.5">{bestLine.emoji}</span>
          {bestLine.text}
        </p>
      ) : null}
      {certLine ? (
        <p className="text-sm text-indigo-900">
          <span aria-hidden className="mr-1.5">{certLine.emoji}</span>
          {certLine.text}
        </p>
      ) : null}
      {goalLine ? (
        <p className="text-sm text-indigo-900">
          <span aria-hidden className="mr-1.5">🎯</span>
          {goalLine}
        </p>
      ) : null}
    </div>
  );
}
