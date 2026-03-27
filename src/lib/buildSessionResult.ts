import {
  calculateGroupLetterAccuracy,
  calculateOverallCharacterAccuracy,
} from '@/lib/groupAlignment';
import {
  calculateAlphabetSize,
  calculateEffectiveAlphabetSize,
  calculateTotalChars,
  computeAverageResponseMs,
  computeSessionScore,
} from '@/lib/score';
import type { SessionResult, SessionGroup, SessionTiming } from '@/types';

export interface BuildSessionResultInput {
  readonly sentGroups: readonly string[];
  readonly answers: readonly string[];
  readonly startedAt: number;
  readonly groupTimings: readonly SessionTiming[];
  readonly mode?: 'group' | 'echo';
}

/**
 * Build a complete SessionResult from raw training data.
 * Pure function — no React, no side effects.
 */
export function buildSessionResult(
  input: BuildSessionResultInput,
): SessionResult {
  const { sentGroups, answers, startedAt, groupTimings, mode } = input;

  const groups: SessionGroup[] = sentGroups.map((sent, idx) => ({
    sent,
    received: (answers[idx] || '').trim().toUpperCase(),
    correct: sent === (answers[idx] || '').trim().toUpperCase(),
  }));

  const letterAccuracy = calculateGroupLetterAccuracy(groups);
  const accuracy = calculateOverallCharacterAccuracy(groups);
  const alphabetSize = calculateAlphabetSize(groups);
  const effectiveAlphabetSize = calculateEffectiveAlphabetSize(groups, {
    applyMillerMadow: true,
  });
  const avgResponseMs = computeAverageResponseMs(
    groupTimings.map((t) => ({
      timeToCompleteMs:
        typeof t.perCharMs === 'number' ? t.perCharMs : t.timeToCompleteMs,
    })),
  );
  const totalChars = calculateTotalChars(groups);
  const score = computeSessionScore({
    effectiveAlphabetSize,
    alphabetSize,
    accuracy,
    avgResponseMs,
    totalChars,
  });

  const dateStr = new Date().toISOString().split('T')[0] ?? '1970-01-01';

  return {
    date: dateStr,
    timestamp: Date.now(),
    startedAt,
    finishedAt: Date.now(),
    groups,
    groupTimings: groupTimings.map((t) => ({ ...t })),
    accuracy,
    letterAccuracy,
    alphabetSize,
    totalChars,
    effectiveAlphabetSize,
    avgResponseMs,
    score,
    ...(mode ? { mode } : {}),
  };
}
