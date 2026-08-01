import type { SessionResult } from '@/types';

import { evaluateCharacterCoverage, type CharacterCoverage } from './characterCoverage';
import { evaluateSpeedCertificateMatrix, type SpeedCertificateMatrix } from './speedCertificates';
import {
  COPY_TEST_MIN_CHARS,
  QUALITY_ACCURACY,
  QUALITY_SESSIONS_TARGET,
  buildTeachingPlan,
  type CurriculumStage,
} from './teachingPlan';

export type StageGoalId = 'reach-level' | 'quality-sessions' | 'copy-test';

export interface StageGoalProgress {
  readonly id: StageGoalId;
  readonly label: string;
  readonly achieved: boolean;
  /** Current progress toward `target` (clamped to target). */
  readonly current: number;
  readonly target: number;
}

export type StageStatus = 'complete' | 'active' | 'upcoming';

export interface StageProgress {
  readonly stage: CurriculumStage;
  readonly status: StageStatus;
  readonly goals: readonly StageGoalProgress[];
  /** Stage characters transmitted by sessions eligible for this stage. */
  readonly coverage: CharacterCoverage;
  /** Stage characters transmitted by qualifying quality sessions. */
  readonly qualityCoverage: CharacterCoverage;
  /** Stage characters transmitted by passed copy tests. */
  readonly copyTestCoverage: CharacterCoverage;
  /** Best copy-test accuracy achieved at this stage's level (0..1), if attempted. */
  readonly bestCopyTestAccuracy?: number;
}

export interface TeachingPlanProgress {
  readonly stages: readonly StageProgress[];
  /** Index of the first incomplete stage; equals stages.length when the plan is finished. */
  readonly activeStageIndex: number;
  /** Per-(stage × speed) certificate matrix; earned by single-session at-speed runs. */
  readonly certificates: SpeedCertificateMatrix;
  /** Total stages completed. */
  readonly completedStageCount: number;
}

const isGroupSession = (session: SessionResult): boolean =>
  session.mode === undefined || session.mode === 'group';

/** Sessions that can prove progress for a stage: group sessions with a recorded level at/above the stage's exit level. */
const sessionsAtOrAboveLevel = (
  sessions: readonly SessionResult[],
  level: number,
): SessionResult[] =>
  sessions.filter(
    (session) =>
      isGroupSession(session) &&
      typeof session.kochLevel === 'number' &&
      session.kochLevel >= level &&
      (session.charSetMode === undefined ||
        session.charSetMode === 'koch' ||
        session.charSetMode === 'mixed'),
  );

const isCopyTestSession = (session: SessionResult): boolean =>
  session.totalChars >= COPY_TEST_MIN_CHARS && session.accuracy >= QUALITY_ACCURACY;

/**
 * Evaluate the whole teaching plan against session history.
 *
 * Sessions recorded at a level at or above a stage's exit level count toward
 * that stage, so practicing at level 20 retroactively completes the stages
 * below it — the plan recognises demonstrated skill, it never demands
 * re-grinding earlier material.
 */
export function evaluateTeachingPlan(
  sessions: readonly SessionResult[],
  currentKochLevel: number,
  stages: readonly CurriculumStage[] = buildTeachingPlan(),
): TeachingPlanProgress {
  const stageProgress: StageProgress[] = [];
  let activeStageIndex = stages.length;

  stages.forEach((stage) => {
    const qualifying = sessionsAtOrAboveLevel(sessions, stage.levelEnd);
    const qualitySessions = qualifying.filter((s) => s.accuracy >= QUALITY_ACCURACY);
    const copyTests = qualifying.filter(isCopyTestSession);
    const copyTestAttempts = qualifying.filter((s) => s.totalChars >= COPY_TEST_MIN_CHARS);

    const levelReached = currentKochLevel >= stage.levelEnd || qualifying.length > 0;
    const coverage = evaluateCharacterCoverage(qualifying, stage.characters);
    const qualityCoverage = evaluateCharacterCoverage(qualitySessions, stage.characters);
    const copyTestCoverage = evaluateCharacterCoverage(copyTests, stage.characters);
    const reachedLevel = levelReached && coverage.missingCharacters.length === 0;
    const qualityAchieved =
      qualitySessions.length >= QUALITY_SESSIONS_TARGET &&
      qualityCoverage.missingCharacters.length === 0;
    const copyTestPassed = copyTests.length > 0 && copyTestCoverage.missingCharacters.length === 0;

    const goals: StageGoalProgress[] = [
      {
        id: 'reach-level',
        label: `Reach level ${stage.levelEnd} (${stage.characters.join(' ')})`,
        achieved: reachedLevel,
        current: reachedLevel ? 1 : 0,
        target: 1,
      },
      {
        id: 'quality-sessions',
        label: `${QUALITY_SESSIONS_TARGET} sessions at ≥${Math.round(QUALITY_ACCURACY * 100)}% session accuracy`,
        achieved: qualityAchieved,
        current: Math.min(qualitySessions.length, QUALITY_SESSIONS_TARGET),
        target: QUALITY_SESSIONS_TARGET,
      },
      {
        id: 'copy-test',
        label: `Copy test: ${COPY_TEST_MIN_CHARS}+ characters at ≥${Math.round(QUALITY_ACCURACY * 100)}% session accuracy`,
        achieved: copyTestPassed,
        current: copyTestPassed ? 1 : 0,
        target: 1,
      },
    ];

    const complete = goals.every((goal) => goal.achieved);
    const bestCopyTestAccuracy = copyTestAttempts.reduce<number | undefined>(
      (best, s) => (best === undefined || s.accuracy > best ? s.accuracy : best),
      undefined,
    );

    stageProgress.push({
      stage,
      status: complete ? 'complete' : 'upcoming',
      goals,
      coverage,
      qualityCoverage,
      copyTestCoverage,
      ...(bestCopyTestAccuracy !== undefined ? { bestCopyTestAccuracy } : {}),
    });
  });

  // The active stage is the first incomplete one; everything after stays upcoming.
  for (let i = 0; i < stageProgress.length; i += 1) {
    const progress = stageProgress[i];
    if (progress && progress.status !== 'complete') {
      stageProgress[i] = { ...progress, status: 'active' };
      activeStageIndex = i;
      break;
    }
  }

  const certificates = evaluateSpeedCertificateMatrix(sessions, stages);

  return {
    stages: stageProgress,
    activeStageIndex,
    certificates,
    completedStageCount: stageProgress.filter((s) => s.status === 'complete').length,
  };
}
