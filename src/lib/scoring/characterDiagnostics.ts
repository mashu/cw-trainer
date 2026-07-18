import { LCWO_SEQUENCE } from '@/lib/morseConstants';
import type { SessionResult } from '@/types';

/** Minimum attempts before a character can be classified as mastered/building. */
export const MASTERED_MIN_ATTEMPTS = 5;
/** Accuracy (0..1) required for mastered — same bar as trophy-case mastery. */
export const MASTERED_MIN_ACCURACY = 0.9;
/** Accuracy (0..1) floor for “building” (in progress, not yet mastered). */
export const BUILDING_MIN_ACCURACY = 0.7;
/**
 * Average response time (ms) at or above which a mastered/building character is
 * flagged as slow. Timing is a separate signal from mastery.
 */
export const SLOW_AVG_MS = 800;

export type CharacterMasteryStatus = 'mastered' | 'building' | 'weak';

export interface LetterAggregate {
  readonly letter: string;
  /** Accuracy as 0..100 percent. */
  readonly accuracy: number;
  readonly total: number;
  readonly correct: number;
}

export interface CharacterDiagnostic {
  readonly letter: string;
  /** Accuracy as 0..100 percent. */
  readonly accuracy: number;
  readonly avgMs: number;
  readonly total: number;
  readonly correct: number;
  readonly status: CharacterMasteryStatus;
  /** True when status is mastered/building and avgMs >= {@link SLOW_AVG_MS}. */
  readonly isSlow: boolean;
}

/**
 * Classify frequentist mastery from accuracy (0..1) and attempt count.
 * Shared by stats diagnostics and trophy-case “letters mastered”.
 */
export function classifyMastery(
  accuracy01: number,
  attempts: number,
): CharacterMasteryStatus {
  if (attempts < MASTERED_MIN_ATTEMPTS) {
    return 'weak';
  }
  if (accuracy01 >= MASTERED_MIN_ACCURACY) {
    return 'mastered';
  }
  if (accuracy01 >= BUILDING_MIN_ACCURACY) {
    return 'building';
  }
  return 'weak';
}

/** Whether a character with the given mastery status and avg response is “slow”. */
export function isSlowResponse(
  status: CharacterMasteryStatus,
  avgMs: number,
): boolean {
  return (status === 'mastered' || status === 'building') && avgMs >= SLOW_AVG_MS;
}

/**
 * Aggregate per-character accuracy across sessions (letterAccuracy totals).
 * Characters are uppercased; order follows LCWO when known.
 */
export function aggregateLetterStats(sessions: readonly SessionResult[]): LetterAggregate[] {
  const aggregate: Record<string, { correct: number; total: number }> = {};

  sessions.forEach((session) => {
    Object.entries(session.letterAccuracy).forEach(([letter, stats]) => {
      const key = letter.toUpperCase();
      const existing = aggregate[key] ?? { correct: 0, total: 0 };
      aggregate[key] = {
        correct: existing.correct + stats.correct,
        total: existing.total + stats.total,
      };
    });
  });

  return Object.entries(aggregate)
    .map(([letter, stats]) => ({
      letter,
      accuracy: stats.total > 0 ? (stats.correct / stats.total) * 100 : 0,
      total: stats.total,
      correct: stats.correct,
    }))
    .sort((a, b) => LCWO_SEQUENCE.indexOf(a.letter) - LCWO_SEQUENCE.indexOf(b.letter));
}

/**
 * Approximate per-character response times from group timings (ms distributed
 * evenly across characters in each group).
 */
export function aggregateLetterTimings(
  sessions: readonly SessionResult[],
): ReadonlyMap<string, number> {
  const timingByLetter: Record<string, number[]> = {};

  sessions.forEach((session) => {
    const groups = session.groups ?? [];
    const timings = session.groupTimings ?? [];
    groups.forEach((group, idx) => {
      const timing = timings[idx];
      const ms = typeof timing?.timeToCompleteMs === 'number' ? timing.timeToCompleteMs : 0;
      if (ms <= 0 || !Number.isFinite(ms)) return;
      const sent = group?.sent || '';
      const perLetterMs = ms / Math.max(1, sent.length);
      for (const char of sent.toUpperCase()) {
        const bucket = timingByLetter[char] ?? [];
        bucket.push(perLetterMs);
        timingByLetter[char] = bucket;
      }
    });
  });

  const averages = new Map<string, number>();
  Object.entries(timingByLetter).forEach(([letter, samples]) => {
    if (samples.length === 0) return;
    const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
    averages.set(letter, Math.round(avg));
  });
  return averages;
}

export interface BuildCharacterDiagnosticsOptions {
  readonly sessions: readonly SessionResult[];
  /** Optional avg-ms map; when omitted, timings are derived from sessions. */
  readonly avgMsByLetter?: ReadonlyMap<string, number>;
  /**
   * When set, only characters in this practice pool are included (current set).
   * Characters in the pool with no history are omitted (no data yet).
   */
  readonly pool?: readonly string[];
}

/**
 * Build per-character diagnostics: shared mastery status plus a separate slow flag.
 */
export function buildCharacterDiagnostics(
  options: BuildCharacterDiagnosticsOptions,
): CharacterDiagnostic[] {
  const { sessions, pool } = options;
  const aggregates = aggregateLetterStats(sessions);
  const avgMsByLetter = options.avgMsByLetter ?? aggregateLetterTimings(sessions);
  const poolSet =
    pool === undefined
      ? null
      : new Set(pool.map((c) => c.toUpperCase()));

  const diagnostics = aggregates
    .filter((stat) => poolSet === null || poolSet.has(stat.letter))
    .map((stat) => {
      const avgMs = avgMsByLetter.get(stat.letter) ?? 0;
      const status = classifyMastery(stat.accuracy / 100, stat.total);
      return {
        letter: stat.letter,
        accuracy: stat.accuracy,
        avgMs,
        total: stat.total,
        correct: stat.correct,
        status,
        isSlow: isSlowResponse(status, avgMs),
      };
    });

  const statusOrder: Record<CharacterMasteryStatus, number> = {
    weak: 0,
    building: 1,
    mastered: 2,
  };

  return diagnostics.sort((a, b) => {
    if (statusOrder[a.status] !== statusOrder[b.status]) {
      return statusOrder[a.status] - statusOrder[b.status];
    }
    return a.accuracy - b.accuracy;
  });
}

/**
 * Characters from `candidates` that meet the shared mastered bar given totals.
 */
export function getMasteredCharacters(
  candidates: readonly string[],
  totals: Readonly<Record<string, { readonly correct: number; readonly total: number }>>,
): string[] {
  return candidates.filter((character) => {
    const stats = totals[character];
    if (!stats) return false;
    return classifyMastery(stats.correct / stats.total, stats.total) === 'mastered';
  });
}
