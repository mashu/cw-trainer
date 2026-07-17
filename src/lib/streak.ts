import { localDateForTimestamp } from '@/lib/localDate';

/**
 * Freeze-aware practice streaks.
 *
 * The streak is derived deterministically from practice-day history on every
 * evaluation — nothing is stored, so it can never desync across devices.
 * Freezes are streak insurance: one is earned for every
 * {@link STREAK_FREEZE_EARN_DAYS} consecutive practiced days (holding at most
 * {@link MAX_STORED_FREEZES}), and a missed day silently consumes one instead
 * of breaking the streak. Losing a long streak to a single missed day is the
 * top reason streak users abandon habit apps entirely.
 *
 * Trophy streaks (achievements module) intentionally stay strict — freezes
 * only soften the day-to-day display, not the medals.
 */

export const STREAK_FREEZE_EARN_DAYS = 7;
export const MAX_STORED_FREEZES = 2;
/** A lapsed streak is shown as "lost" (rather than silently reset) for this many days. */
const LOST_VISIBILITY_DAYS = 7;

export type StreakState = 'none' | 'safe' | 'at-risk' | 'lost';

export interface StreakStatus {
  /** Current streak length in days (freeze-aware). */
  readonly days: number;
  /**
   * safe: practiced today. at-risk: streak alive but today not yet practiced.
   * lost: a streak of 2+ days recently ended. none: nothing to show.
   */
  readonly state: StreakState;
  readonly freezesAvailable: number;
  /** Freezes consumed within the currently displayed streak. */
  readonly freezesUsed: number;
  /** Length of the streak that just ended (only for state 'lost'). */
  readonly lostStreakDays?: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const toDayIndex = (date: string): number | null => {
  const ts = Date.parse(`${date}T00:00:00.000Z`);
  return Number.isFinite(ts) ? Math.floor(ts / DAY_MS) : null;
};

export function computeStreakStatus(
  practiceDates: readonly string[],
  now = Date.now(),
): StreakStatus {
  const dayIndexes = [
    ...new Set(
      practiceDates
        .map(toDayIndex)
        .filter((index): index is number => index !== null),
    ),
  ].sort((a, b) => a - b);

  const todayIndex = toDayIndex(localDateForTimestamp(now));
  if (todayIndex === null || dayIndexes.length === 0) {
    return { days: 0, state: 'none', freezesAvailable: 0, freezesUsed: 0 };
  }

  let streak = 0;
  let freezes = 0;
  let freezesUsed = 0;
  let daysSinceFreezeEarned = 0;
  let previous: number | null = null;

  const earnOnPracticedDay = (): void => {
    daysSinceFreezeEarned += 1;
    if (daysSinceFreezeEarned >= STREAK_FREEZE_EARN_DAYS) {
      freezes = Math.min(MAX_STORED_FREEZES, freezes + 1);
      daysSinceFreezeEarned = 0;
    }
  };

  for (const dayIndex of dayIndexes) {
    if (dayIndex > todayIndex) break; // ignore future-dated entries
    if (previous === null) {
      streak = 1;
      freezesUsed = 0;
      daysSinceFreezeEarned = 0;
      earnOnPracticedDay();
      previous = dayIndex;
      continue;
    }
    const gap = dayIndex - previous - 1;
    if (gap === 0) {
      streak += 1;
    } else if (gap > 0 && gap <= freezes) {
      freezes -= gap;
      freezesUsed += gap;
      streak += 1; // frozen days keep the run alive but don't count as practice
    } else {
      streak = 1;
      freezesUsed = 0;
      daysSinceFreezeEarned = 0;
    }
    earnOnPracticedDay();
    previous = dayIndex;
  }

  const lastPracticed = previous;
  if (lastPracticed === null) {
    return { days: 0, state: 'none', freezesAvailable: 0, freezesUsed: 0 };
  }

  if (lastPracticed === todayIndex) {
    return { days: streak, state: 'safe', freezesAvailable: freezes, freezesUsed };
  }

  // Days fully missed between the last practice day and today (today itself is
  // still in progress and never counts as missed).
  const missed = todayIndex - lastPracticed - 1;
  if (missed === 0) {
    return { days: streak, state: 'at-risk', freezesAvailable: freezes, freezesUsed };
  }
  if (missed <= freezes) {
    return {
      days: streak,
      state: 'at-risk',
      freezesAvailable: freezes - missed,
      freezesUsed: freezesUsed + missed,
    };
  }

  if (streak >= 2 && missed <= LOST_VISIBILITY_DAYS) {
    return {
      days: 0,
      state: 'lost',
      freezesAvailable: freezes,
      freezesUsed: 0,
      lostStreakDays: streak,
    };
  }

  return { days: 0, state: 'none', freezesAvailable: freezes, freezesUsed: 0 };
}
