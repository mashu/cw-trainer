import { alignGroup } from '@/lib/groupAlignment';
import type { SessionResult } from '@/types';

import { CERTIFICATE_SPEEDS_WPM, buildTeachingPlan, type CurriculumStage } from './teachingPlan';

/**
 * Speed certificates, modelled on the historic FCC code exams but generalised
 * to the Koch ladder.
 *
 * A certificate cell is (stage × speed). It is earned by a SINGLE SESSION —
 * like the real exam, it's one sustained run, not an accumulation: at least
 * {@link CERT_MIN_CORRECT_CHARS} correctly copied characters from groups that
 * were actually PLAYED at or above the certificate speed, with at-speed
 * accuracy of at least {@link CERT_MIN_ACCURACY}, in a session at or above the
 * stage's exit level. With variable-speed settings only the groups that met
 * the speed count — per-group speeds are recorded in `groupTimings[].charWpm`.
 *
 * The final stage covers the complete character sequence, so its cells are the
 * true historic equivalents (5/13/20 WPM over the full alphabet); those also
 * unlock trophy-case achievements.
 */

export const CERT_MIN_CORRECT_CHARS = 100;
export const CERT_MIN_ACCURACY = 0.9;

export interface SessionSpeedRun {
  readonly speed: number;
  /** Characters correctly copied from groups played at >= speed. */
  readonly correctChars: number;
  /** Characters sent in groups played at >= speed. */
  readonly totalChars: number;
  /** Accuracy among at-speed characters (0 when none). */
  readonly accuracy: number;
  /** Whether this single session satisfies the certificate. */
  readonly achieved: boolean;
}

const isGroupSession = (session: SessionResult): boolean =>
  session.mode === undefined || session.mode === 'group';

const isAlphabetSession = (session: SessionResult): boolean =>
  session.charSetMode === undefined ||
  session.charSetMode === 'koch' ||
  session.charSetMode === 'mixed';

/**
 * Evaluate one session's copy run at a certificate speed.
 * Groups without a recorded per-group speed fall back to the session-level
 * charWpm snapshot (the range minimum) — conservative for legacy sessions.
 */
export function evaluateSessionSpeedRun(session: SessionResult, speed: number): SessionSpeedRun {
  let correctChars = 0;
  let totalChars = 0;

  session.groups.forEach((group, index) => {
    const timing = session.groupTimings[index];
    const groupSpeed =
      typeof timing?.charWpm === 'number' && timing.charWpm >= 1
        ? timing.charWpm
        : session.charWpm;
    if (typeof groupSpeed !== 'number' || groupSpeed < speed) return;
    const alignment = alignGroup(group.sent, group.received);
    alignment.forEach((pair) => {
      if (pair.sentChar === null) return; // ignore insertions
      totalChars += 1;
      if (pair.match) correctChars += 1;
    });
  });

  const accuracy = totalChars > 0 ? correctChars / totalChars : 0;
  return {
    speed,
    correctChars,
    totalChars,
    accuracy,
    achieved: correctChars >= CERT_MIN_CORRECT_CHARS && accuracy >= CERT_MIN_ACCURACY,
  };
}

export interface CertificateCell {
  readonly speed: number;
  readonly earned: boolean;
  readonly earnedSessionTimestamp?: number;
  /** Best single-session attempt so far (highest correct-at-speed count). */
  readonly bestCorrectChars: number;
  readonly bestAccuracy: number;
  readonly targetChars: number;
}

export interface CertificateStageRow {
  readonly stage: CurriculumStage;
  readonly cells: readonly CertificateCell[];
}

export interface SpeedCertificateMatrix {
  readonly rows: readonly CertificateStageRow[];
  readonly earnedCount: number;
  readonly totalCells: number;
  /** Earned cells of the final (full character set) stage — the historic certificates. */
  readonly fullAlphabetEarnedSpeeds: readonly number[];
}

/** The stage a session attempts: the highest stage whose exit level the session reaches. */
export function attemptedStageForLevel(
  stages: readonly CurriculumStage[],
  kochLevel: number | undefined,
): CurriculumStage | null {
  if (typeof kochLevel !== 'number') return null;
  let attempted: CurriculumStage | null = null;
  for (const stage of stages) {
    if (kochLevel >= stage.levelEnd) attempted = stage;
    else break;
  }
  return attempted;
}

export function evaluateSpeedCertificateMatrix(
  sessions: readonly SessionResult[],
  stages: readonly CurriculumStage[] = buildTeachingPlan(),
  speeds: readonly number[] = CERTIFICATE_SPEEDS_WPM,
): SpeedCertificateMatrix {
  const eligible = sessions.filter(
    (session) => isGroupSession(session) && isAlphabetSession(session),
  );

  const rows: CertificateStageRow[] = stages.map((stage) => {
    const qualifying = eligible.filter(
      (session) =>
        typeof session.kochLevel === 'number' && session.kochLevel >= stage.levelEnd,
    );
    const cells: CertificateCell[] = speeds.map((speed) => {
      let earned = false;
      let earnedSessionTimestamp: number | undefined;
      let bestCorrectChars = 0;
      let bestAccuracy = 0;
      qualifying.forEach((session) => {
        const run = evaluateSessionSpeedRun(session, speed);
        if (run.correctChars > bestCorrectChars ||
            (run.correctChars === bestCorrectChars && run.accuracy > bestAccuracy)) {
          bestCorrectChars = run.correctChars;
          bestAccuracy = run.accuracy;
        }
        if (run.achieved && !earned) {
          earned = true;
          earnedSessionTimestamp = session.timestamp;
        }
      });
      return {
        speed,
        earned,
        ...(earnedSessionTimestamp !== undefined ? { earnedSessionTimestamp } : {}),
        bestCorrectChars,
        bestAccuracy,
        targetChars: CERT_MIN_CORRECT_CHARS,
      };
    });
    return { stage, cells };
  });

  const earnedCount = rows.reduce(
    (sum, row) => sum + row.cells.filter((cell) => cell.earned).length,
    0,
  );
  const lastRow = rows[rows.length - 1];
  const fullAlphabetEarnedSpeeds = lastRow
    ? lastRow.cells.filter((cell) => cell.earned).map((cell) => cell.speed)
    : [];

  return {
    rows,
    earnedCount,
    totalCells: rows.length * speeds.length,
    fullAlphabetEarnedSpeeds,
  };
}
