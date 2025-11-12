'use client';

import { useMemo } from 'react';

import type { IcrSessionResult } from '@/types';

import { useIcrSessionsState } from './useIcrSessions';

export interface IcrAnalyticsSummary {
  readonly totalSessions: number;
  readonly totalTrials: number;
  readonly averageReactionMs: number;
  readonly averageAccuracyPercent: number;
  readonly bestLetter?: {
    readonly letter: string;
    readonly accuracyPercent: number;
    readonly total: number;
  };
  readonly needsWorkLetter?: {
    readonly letter: string;
    readonly accuracyPercent: number;
    readonly total: number;
  };
  readonly lastSessionAt?: number;
}

const aggregateLetters = (
  sessions: readonly IcrSessionResult[],
): Map<string, { correct: number; total: number }> => {
  const aggregate = new Map<string, { correct: number; total: number }>();

  sessions.forEach((session) => {
    if (!session.perLetter) return;
    Object.entries(session.perLetter).forEach(([letter, stats]) => {
      const current = aggregate.get(letter) ?? { correct: 0, total: 0 };
      current.correct += stats.correct;
      current.total += stats.total;
      aggregate.set(letter, current);
    });
  });

  return aggregate;
};

export function useIcrAnalytics(): IcrAnalyticsSummary {
  const { icrSessions } = useIcrSessionsState();

  return useMemo<IcrAnalyticsSummary>(() => {
    if (!icrSessions || !icrSessions.length) {
      return {
        totalSessions: 0,
        totalTrials: 0,
        averageReactionMs: 0,
        averageAccuracyPercent: 0,
      };
    }

    const totalSessions = icrSessions.length;
    const totalTrials = icrSessions.reduce((sum, session) => sum + session.trials.length, 0);
    const sumReaction = icrSessions.reduce((sum, session) => sum + session.averageReactionMs, 0);
    const sumAccuracy = icrSessions.reduce((sum, session) => sum + session.accuracyPercent, 0);
    const lastSessionAt = icrSessions[icrSessions.length - 1]?.timestamp;

    const letterAggregate = aggregateLetters(icrSessions);
    const sortedLetters = Array.from(letterAggregate.entries())
      .filter(([, stats]) => stats.total > 0)
      .map(([letter, stats]) => ({
        letter,
        accuracyPercent: (stats.correct / stats.total) * 100,
        total: stats.total,
      }))
      .sort((a, b) => b.accuracyPercent - a.accuracyPercent);

    const bestLetter = sortedLetters[0];
    const needsWorkLetterIdx = sortedLetters.length > 0 ? sortedLetters.length - 1 : -1;
    const needsWorkLetter = needsWorkLetterIdx >= 0 ? sortedLetters[needsWorkLetterIdx] : undefined;

    return {
      totalSessions,
      totalTrials,
      averageReactionMs: Math.round(sumReaction / totalSessions),
      averageAccuracyPercent: Math.round(sumAccuracy / totalSessions),
      ...(bestLetter ? { bestLetter } : {}),
      ...(needsWorkLetter ? { needsWorkLetter } : {}),
      ...(lastSessionAt !== undefined ? { lastSessionAt } : {}),
    };
  }, [icrSessions]);
}


