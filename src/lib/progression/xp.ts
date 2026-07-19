import type { SessionResult } from '@/types';

import { nextRankAfter, rankForXp, type OperatorRank } from './ranks';

/** XP granted per correctly copied character. */
export const XP_PER_CORRECT_CHAR = 2;

/** Floor so every finished session with audible characters feels rewarded. */
export const MIN_SESSION_XP = 5;

/** Per-session XP receipt, split into the parts the results screen explains. */
export interface SessionXpBreakdown {
  /** Correct characters credited (accuracy × totalChars, rounded). */
  readonly correctChars: number;
  /** correctChars × XP_PER_CORRECT_CHAR, before multipliers. */
  readonly baseXp: number;
  /** Accuracy multiplier: 1, 1.15 (≥80%), 1.3 (≥90%) or 1.5 (≥98%). */
  readonly accuracyMultiplier: number;
  /** Additive speed multiplier from the session's effective WPM (0 to 0.5). */
  readonly speedBonus: number;
  /** Final XP for the session (≥ MIN_SESSION_XP when any characters played). */
  readonly totalXp: number;
}

const accuracyMultiplierFor = (accuracy: number): number => {
  if (accuracy >= 0.98) return 1.5;
  if (accuracy >= 0.9) return 1.3;
  if (accuracy >= 0.8) return 1.15;
  return 1;
};

const speedBonusFor = (effectiveWpm: number | undefined): number => {
  if (typeof effectiveWpm !== 'number' || !Number.isFinite(effectiveWpm)) return 0;
  if (effectiveWpm >= 25) return 0.5;
  if (effectiveWpm >= 20) return 0.35;
  if (effectiveWpm >= 15) return 0.2;
  if (effectiveWpm >= 10) return 0.1;
  return 0;
};

/**
 * Deterministic XP for one session, derived only from the stored result so the
 * lifetime total can always be recomputed from history (same pattern as
 * achievements and the teaching plan — nothing extra to persist or migrate).
 */
export function sessionXpBreakdown(
  session: Pick<SessionResult, 'accuracy' | 'totalChars'> & { readonly effectiveWpm?: number },
): SessionXpBreakdown {
  const totalChars =
    Number.isFinite(session.totalChars) && session.totalChars > 0 ? session.totalChars : 0;
  const accuracy =
    Number.isFinite(session.accuracy) && session.accuracy > 0 ? Math.min(session.accuracy, 1) : 0;
  const correctChars = Math.round(accuracy * totalChars);
  const baseXp = correctChars * XP_PER_CORRECT_CHAR;
  const accuracyMultiplier = accuracyMultiplierFor(accuracy);
  const speedBonus = speedBonusFor(session.effectiveWpm);
  const earned = Math.round(baseXp * (accuracyMultiplier + speedBonus));
  const totalXp = totalChars > 0 ? Math.max(earned, MIN_SESSION_XP) : 0;
  return { correctChars, baseXp, accuracyMultiplier, speedBonus, totalXp };
}

/** Final XP for one session. */
export function sessionXp(
  session: Pick<SessionResult, 'accuracy' | 'totalChars'> & { readonly effectiveWpm?: number },
): number {
  return sessionXpBreakdown(session).totalXp;
}

/** Lifetime XP across every stored session (all training modes count). */
export function totalXp(sessions: readonly SessionResult[]): number {
  return sessions.reduce((sum, session) => sum + sessionXp(session), 0);
}

/** Where the operator stands on the rank ladder right now. */
export interface OperatorProgress {
  readonly totalXp: number;
  readonly rank: OperatorRank;
  /** Next rank up, or null when the top of the ladder is held. */
  readonly nextRank: OperatorRank | null;
  /** XP accumulated inside the current rank band. */
  readonly xpIntoRank: number;
  /** XP still needed to reach the next rank (0 at the top). */
  readonly xpToNextRank: number;
  /** 0–100 progress through the current rank band (100 at the top rank). */
  readonly percentToNextRank: number;
}

/** Evaluate rank standing for a lifetime XP total. */
export function operatorProgressForXp(xp: number): OperatorProgress {
  const safeXp = Number.isFinite(xp) && xp > 0 ? Math.floor(xp) : 0;
  const rank = rankForXp(safeXp);
  const nextRank = nextRankAfter(rank);
  const xpIntoRank = safeXp - rank.minXp;
  if (!nextRank) {
    return {
      totalXp: safeXp,
      rank,
      nextRank: null,
      xpIntoRank,
      xpToNextRank: 0,
      percentToNextRank: 100,
    };
  }
  const span = nextRank.minXp - rank.minXp;
  return {
    totalXp: safeXp,
    rank,
    nextRank,
    xpIntoRank,
    xpToNextRank: nextRank.minXp - safeXp,
    percentToNextRank: Math.max(0, Math.min(100, Math.round((xpIntoRank / span) * 100))),
  };
}

/** Evaluate rank standing from full session history. */
export function computeOperatorProgress(sessions: readonly SessionResult[]): OperatorProgress {
  return operatorProgressForXp(totalXp(sessions));
}
