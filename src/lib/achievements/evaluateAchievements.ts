import { localDateForTimestamp } from '@/lib/localDate';
import type { SessionResult } from '@/types';

import { ACHIEVEMENT_BADGES } from './badges';
import { STREAK_MILESTONES } from './streakMilestones';
import type {
  AchievementEvaluationResult,
  AchievementId,
  AchievementProgress,
  AchievementRuleContext,
  UnlockedAchievement,
} from './types';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const DIGITS = '0123456789'.split('');
const MASTERED_MIN_ATTEMPTS = 5;
const MASTERED_MIN_ACCURACY = 0.9;
const DAY_MS = 24 * 60 * 60 * 1000;
const KOCH_GRADUATE_LEVEL = 40;

type UnlockCandidate = {
  readonly id: AchievementId;
  readonly session?: SessionResult | undefined;
};

const isGroupSession = (session: SessionResult): boolean =>
  session.mode === undefined || session.mode === 'group';

const toDateIndex = (date: string): number | null => {
  const timestamp = Date.parse(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp)) {
    return null;
  }
  return Math.floor(timestamp / DAY_MS);
};

const getUniqueDateIndexes = (sessions: readonly SessionResult[]): number[] => {
  const indexes = new Set<number>();
  sessions.forEach((session) => {
    const index = toDateIndex(session.date);
    if (index !== null) {
      indexes.add(index);
    }
  });
  return [...indexes].sort((a, b) => a - b);
};

const countLongestStreak = (dateIndexes: readonly number[]): number => {
  let longest = 0;
  let current = 0;
  let previous: number | null = null;

  dateIndexes.forEach((index) => {
    current = previous !== null && index === previous + 1 ? current + 1 : 1;
    longest = Math.max(longest, current);
    previous = index;
  });

  return longest;
};

const countCurrentStreak = (dateIndexes: readonly number[], todayIndex: number | null): number => {
  const latest = dateIndexes[dateIndexes.length - 1];
  if (latest === undefined) {
    return 0;
  }
  // A streak is only "current" if it reaches today or yesterday (still extendable
  // today). A run that ended further in the past is history, not a current streak.
  if (todayIndex !== null && latest < todayIndex - 1) {
    return 0;
  }

  let streak = 1;
  for (let index = dateIndexes.length - 2; index >= 0; index -= 1) {
    const current = dateIndexes[index];
    if (current === undefined || current !== latest - streak) {
      break;
    }
    streak += 1;
  }
  return streak;
};

const buildCharacterTotals = (
  sessions: readonly SessionResult[],
): Readonly<Record<string, { readonly correct: number; readonly total: number }>> => {
  const totals: Record<string, { correct: number; total: number }> = {};
  sessions.forEach((session) => {
    Object.entries(session.letterAccuracy).forEach(([character, stats]) => {
      const normalized = character.toUpperCase();
      const existing = totals[normalized] ?? { correct: 0, total: 0 };
      totals[normalized] = {
        correct: existing.correct + stats.correct,
        total: existing.total + stats.total,
      };
    });
  });
  return totals;
};

const getMasteredCharacters = (
  characters: readonly string[],
  totals: Readonly<Record<string, { readonly correct: number; readonly total: number }>>,
): string[] =>
  characters.filter((character) => {
    const stats = totals[character];
    if (!stats || stats.total < MASTERED_MIN_ATTEMPTS) {
      return false;
    }
    return stats.correct / stats.total >= MASTERED_MIN_ACCURACY;
  });

export const calculateAchievementProgress = (
  sessions: readonly SessionResult[],
  now = Date.now(),
): AchievementProgress => {
  const groupSessions = sessions.filter(isGroupSession);
  const totals = buildCharacterTotals(groupSessions);
  const masteredLetters = getMasteredCharacters(LETTERS, totals);
  const masteredDigits = getMasteredCharacters(DIGITS, totals);
  const dateIndexes = getUniqueDateIndexes(groupSessions);
  const todayIndex = toDateIndex(localDateForTimestamp(now));

  return {
    masteredLetters,
    masteredDigits,
    masteredLetterCount: masteredLetters.length,
    masteredDigitCount: masteredDigits.length,
    totalLetterCount: LETTERS.length,
    totalDigitCount: DIGITS.length,
    bestScore: groupSessions.reduce((best, session) => Math.max(best, session.score), 0),
    bestAccuracy: groupSessions.reduce((best, session) => Math.max(best, session.accuracy), 0),
    practiceDays: dateIndexes.length,
    currentStreakDays: countCurrentStreak(dateIndexes, todayIndex),
    longestStreakDays: countLongestStreak(dateIndexes),
  };
};

const findFirst = (
  sessions: readonly SessionResult[],
  predicate: (session: SessionResult) => boolean,
): SessionResult | undefined => sessions.find(predicate);

const findComebackSession = (sessions: readonly SessionResult[]): SessionResult | undefined => {
  for (let index = 1; index < sessions.length; index += 1) {
    const previous = sessions[index - 1];
    const current = sessions[index];
    if (!previous || !current) {
      continue;
    }
    const previousDate = toDateIndex(previous.date);
    const currentDate = toDateIndex(current.date);
    if (
      previousDate !== null &&
      currentDate !== null &&
      currentDate - previousDate >= 7 &&
      current.accuracy >= 0.8
    ) {
      return current;
    }
  }
  return undefined;
};

const findSessionForStreak = (
  sessions: readonly SessionResult[],
  targetDays: number,
): SessionResult | undefined => {
  const dateToSession = new Map<number, SessionResult>();
  sessions.forEach((session) => {
    const dateIndex = toDateIndex(session.date);
    if (dateIndex !== null) {
      dateToSession.set(dateIndex, session);
    }
  });

  const dateIndexes = [...dateToSession.keys()].sort((a, b) => a - b);
  let streak = 0;
  let previous: number | null = null;
  for (const dateIndex of dateIndexes) {
    streak = previous !== null && dateIndex === previous + 1 ? streak + 1 : 1;
    if (streak >= targetDays) {
      return dateToSession.get(dateIndex);
    }
    previous = dateIndex;
  }
  return undefined;
};

const findSessionForPracticeDayCount = (
  sessions: readonly SessionResult[],
  targetDays: number,
): SessionResult | undefined => {
  const dateToSession = new Map<number, SessionResult>();
  sessions.forEach((session) => {
    const dateIndex = toDateIndex(session.date);
    if (dateIndex !== null) {
      dateToSession.set(dateIndex, session);
    }
  });

  const dateIndexes = [...dateToSession.keys()].sort((a, b) => a - b);
  const targetDateIndex = dateIndexes[targetDays - 1];
  if (targetDateIndex === undefined) {
    return undefined;
  }
  return dateToSession.get(targetDateIndex);
};

const buildUnlockCandidates = ({
  sessions,
  progress,
}: AchievementRuleContext): readonly UnlockCandidate[] => {
  const groupSessions = sessions.filter(isGroupSession).sort((a, b) => a.timestamp - b.timestamp);
  const candidates: UnlockCandidate[] = [];
  const firstSession = groupSessions[0];

  if (firstSession) {
    candidates.push({ id: 'first-session', session: firstSession });
  }

  const tenthSession = groupSessions[9];
  if (tenthSession) {
    candidates.push({ id: 'getting-warm', session: tenthSession });
  }

  if (progress.masteredLetterCount >= 1) {
    candidates.push({ id: 'first-letter', session: firstSession });
  }
  if (progress.masteredDigitCount >= 1) {
    candidates.push({ id: 'first-digit', session: firstSession });
  }
  if (progress.masteredDigitCount >= 5) {
    candidates.push({ id: 'number-pad', session: firstSession });
  }
  if (progress.masteredDigitCount >= progress.totalDigitCount) {
    candidates.push({ id: 'full-keypad', session: firstSession });
  }
  if (progress.masteredLetterCount >= Math.ceil(progress.totalLetterCount * 0.25)) {
    candidates.push({ id: 'quarter-alphabet', session: firstSession });
  }
  if (progress.masteredLetterCount >= Math.ceil(progress.totalLetterCount * 0.5)) {
    candidates.push({ id: 'half-alphabet', session: firstSession });
  }
  if (progress.masteredLetterCount >= Math.ceil(progress.totalLetterCount * 0.75)) {
    candidates.push({ id: 'three-quarter-alphabet', session: firstSession });
  }
  if (progress.masteredLetterCount >= progress.totalLetterCount) {
    candidates.push({ id: 'full-alphabet', session: firstSession });
  }

  const cleanCopy = findFirst(
    groupSessions,
    (session) => session.accuracy >= 1 && session.totalChars >= 25,
  );
  if (cleanCopy) {
    candidates.push({ id: 'clean-copy', session: cleanCopy });
  }

  const flawlessRun = findFirst(
    groupSessions,
    (session) => session.accuracy >= 1 && session.totalChars >= 50,
  );
  if (flawlessRun) {
    candidates.push({ id: 'flawless-run', session: flawlessRun });
  }

  const ninetyClub = findFirst(
    groupSessions,
    (session) => session.accuracy >= 0.9 && session.effectiveAlphabetSize >= 10,
  );
  if (ninetyClub) {
    candidates.push({ id: 'ninety-club', session: ninetyClub });
  }

  const pressureCopy = findFirst(
    groupSessions,
    (session) =>
      session.accuracy >= 0.9 && session.avgResponseMs > 0 && session.avgResponseMs <= 1500,
  );
  if (pressureCopy) {
    candidates.push({ id: 'pressure-copy', session: pressureCopy });
  }

  const lightningCopy = findFirst(
    groupSessions,
    (session) =>
      session.accuracy >= 0.9 && session.avgResponseMs > 0 && session.avgResponseMs <= 1000,
  );
  if (lightningCopy) {
    candidates.push({ id: 'lightning-copy', session: lightningCopy });
  }

  const longHaul = findFirst(
    groupSessions,
    (session) => session.accuracy >= 0.9 && session.totalChars >= 100,
  );
  if (longHaul) {
    candidates.push({ id: 'long-haul', session: longHaul });
  }

  STREAK_MILESTONES.forEach(({ id, days }) => {
    const streakSession = findSessionForStreak(groupSessions, days);
    if (streakSession) {
      candidates.push({ id, session: streakSession });
    }
  });

  const dailyOperator = findSessionForPracticeDayCount(groupSessions, 10);
  if (dailyOperator) {
    candidates.push({ id: 'daily-operator', session: dailyOperator });
  }

  const comeback = findComebackSession(groupSessions);
  if (comeback) {
    candidates.push({ id: 'comeback', session: comeback });
  }

  const score1000 = findFirst(groupSessions, (session) => session.score >= 1000);
  if (score1000) {
    candidates.push({ id: 'score-1000', session: score1000 });
  }

  const score2500 = findFirst(groupSessions, (session) => session.score >= 2500);
  if (score2500) {
    candidates.push({ id: 'score-2500', session: score2500 });
  }

  const score5000 = findFirst(groupSessions, (session) => session.score >= 5000);
  if (score5000) {
    candidates.push({ id: 'score-5000', session: score5000 });
  }

  const megawatt = findFirst(groupSessions, (session) => session.score >= 7500);
  if (megawatt) {
    candidates.push({ id: 'megawatt', session: megawatt });
  }

  const kochGraduate = findFirst(
    groupSessions,
    (session) =>
      session.kochLevel !== undefined &&
      session.kochLevel >= KOCH_GRADUATE_LEVEL &&
      session.accuracy >= 0.8,
  );
  if (kochGraduate) {
    candidates.push({ id: 'koch-graduate', session: kochGraduate });
  }

  return candidates;
};

export const evaluateAchievements = (
  sessions: readonly SessionResult[],
  existing: readonly UnlockedAchievement[],
  now = Date.now(),
): AchievementEvaluationResult => {
  const progress = calculateAchievementProgress(sessions, now);
  const existingById = new Map(
    existing.map((achievement) => [achievement.id, achievement] as const),
  );
  const candidates = buildUnlockCandidates({ sessions, progress });
  const newlyUnlocked: UnlockedAchievement[] = [];
  const unlockedById = new Map(existingById);

  candidates.forEach((candidate) => {
    if (unlockedById.has(candidate.id)) {
      return;
    }
    const unlocked: UnlockedAchievement = {
      id: candidate.id,
      unlockedAt: now,
      ...(candidate.session ? { sourceSessionTimestamp: candidate.session.timestamp } : {}),
    };
    unlockedById.set(candidate.id, unlocked);
    newlyUnlocked.push(unlocked);
  });

  const badgeOrder = new Map<AchievementId, number>(
    ACHIEVEMENT_BADGES.map((badge, index) => [badge.id, index] as const),
  );
  const unlocked = [...unlockedById.values()].sort(
    (a, b) => (badgeOrder.get(a.id) ?? 0) - (badgeOrder.get(b.id) ?? 0),
  );

  return { unlocked, newlyUnlocked, progress };
};
