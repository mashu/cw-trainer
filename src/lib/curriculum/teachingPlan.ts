import { LCWO_SEQUENCE } from '@/lib/morseConstants';

/**
 * Structured teaching plan for Morse code.
 *
 * The plan turns the raw Koch-level ladder into named stages with explicit,
 * checkable goals. Each stage covers a slice of the character sequence and is
 * completed by demonstrating quality copy — including a "copy test", the
 * digital equivalent of the classic solid-copy exam: a sustained run of at
 * least {@link COPY_TEST_MIN_CHARS} characters at ≥{@link QUALITY_ACCURACY}
 * accuracy with the stage's alphabet.
 *
 * Speed certificates mirror the historic FCC licence exams (5 / 13 / 20 WPM
 * received code): they are earned by a solid-copy session at or above the
 * certificate speed, independent of stage progress.
 */

export interface CurriculumStage {
  /** Stable id, e.g. `stage-3`. */
  readonly id: string;
  /** 0-based position in the plan. */
  readonly index: number;
  readonly title: string;
  /** First Koch level covered by this stage (inclusive). */
  readonly levelStart: number;
  /** Last Koch level covered by this stage (inclusive) — the stage's exit level. */
  readonly levelEnd: number;
  /** Characters introduced while progressing through this stage. */
  readonly characters: readonly string[];
}

/** Sessions at/above a stage's exit level demonstrating this accuracy count as quality copy. */
export const QUALITY_ACCURACY = 0.9;
/** Number of quality sessions required to complete a stage. */
export const QUALITY_SESSIONS_TARGET = 2;
/** Minimum characters copied in one session for it to count as a copy test. */
export const COPY_TEST_MIN_CHARS = 100;
/** Historic FCC code-test speeds (Novice / General / Extra), in WPM. */
export const CERTIFICATE_SPEEDS_WPM: readonly number[] = [5, 13, 20];

const DEFAULT_STAGE_SIZE = 5;

/**
 * Build the staged teaching plan for a character sequence.
 *
 * Koch level L unlocks the first L+1 characters of the sequence, so a
 * sequence of N characters spans levels 1..N-1. Stages chunk that ladder
 * into groups of `stageSize` levels.
 */
export function buildTeachingPlan(
  sequence: readonly string[] = LCWO_SEQUENCE,
  stageSize: number = DEFAULT_STAGE_SIZE,
): CurriculumStage[] {
  const maxLevel = Math.max(1, sequence.length - 1);
  const size = Math.max(1, Math.floor(stageSize));
  const stages: CurriculumStage[] = [];

  for (let levelStart = 1; levelStart <= maxLevel; levelStart += size) {
    const levelEnd = Math.min(levelStart + size - 1, maxLevel);
    const index = stages.length;
    // Level L introduces sequence[L]; the first stage also owns the two
    // baseline characters available at level 1 (sequence[0..1]).
    const firstCharIndex = index === 0 ? 0 : levelStart;
    const characters = sequence.slice(firstCharIndex, levelEnd + 1);
    stages.push({
      id: `stage-${index + 1}`,
      index,
      title: `Stage ${index + 1}: ${characters.join(' ')}`,
      levelStart,
      levelEnd,
      characters,
    });
  }

  return stages;
}
