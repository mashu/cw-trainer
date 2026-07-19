/**
 * Operator ranks: a single always-growing ladder derived from lifetime XP.
 *
 * Unlike trophies (one-shot unlocks) and the teaching plan (syllabus stages),
 * the rank ladder never stalls — every session adds XP, so there is always a
 * visible next milestone. Titles follow the ham-radio license ladder into
 * old telegraphy slang; insignia are decorative Morse pips that grow with rank.
 */
export interface OperatorRank {
  /** Position on the ladder, 0-based. */
  readonly index: number;
  readonly title: string;
  /** Short flavor line shown under the title. */
  readonly motto: string;
  /** Lifetime XP required to hold this rank. */
  readonly minXp: number;
  /** Decorative Morse pips ('·' dot, '−' dash) rendered as the rank insignia. */
  readonly insignia: string;
}

export const OPERATOR_RANKS: readonly OperatorRank[] = [
  {
    index: 0,
    title: 'Listener',
    motto: 'Ears on the band, key at the ready.',
    minXp: 0,
    insignia: '·',
  },
  { index: 1, title: 'Novice', motto: 'First dits in the log.', minXp: 300, insignia: '··' },
  {
    index: 2,
    title: 'Apprentice',
    motto: 'The rhythm is settling in.',
    minXp: 800,
    insignia: '···',
  },
  { index: 3, title: 'Technician', motto: 'Copying with confidence.', minXp: 1600, insignia: '·−' },
  { index: 4, title: 'Operator', motto: 'A steady hand on the key.', minXp: 2800, insignia: '·−·' },
  { index: 5, title: 'General', motto: 'The bands are opening up.', minXp: 4500, insignia: '·−−' },
  { index: 6, title: 'Advanced', motto: 'Fast QSOs, clean copy.', minXp: 7000, insignia: '−·−' },
  { index: 7, title: 'Extra', motto: 'Top of the license ladder.', minXp: 10500, insignia: '−·−·' },
  {
    index: 8,
    title: 'Radio Officer',
    motto: 'Trusted with the ship’s traffic.',
    minXp: 15000,
    insignia: '−−·−',
  },
  {
    index: 9,
    title: 'Brass Pounder',
    motto: 'Old-school speed and swagger.',
    minXp: 21000,
    insignia: '·−−·−',
  },
  {
    index: 10,
    title: 'Master Telegrapher',
    motto: 'Every character, first time.',
    minXp: 30000,
    insignia: '−·−·−',
  },
  {
    index: 11,
    title: 'Morse Legend',
    motto: 'The key sings your name.',
    minXp: 45000,
    insignia: '·−·−·−',
  },
] as const;

/** Highest rank on the ladder. */
export const MAX_OPERATOR_RANK = OPERATOR_RANKS[OPERATOR_RANKS.length - 1] as OperatorRank;

/** Resolve the rank held at a given lifetime XP total. */
export function rankForXp(xp: number): OperatorRank {
  const safeXp = Number.isFinite(xp) && xp > 0 ? xp : 0;
  let held = OPERATOR_RANKS[0] as OperatorRank;
  for (const rank of OPERATOR_RANKS) {
    if (safeXp >= rank.minXp) {
      held = rank;
    } else {
      break;
    }
  }
  return held;
}

/** The rank above the given one, or null at the top of the ladder. */
export function nextRankAfter(rank: OperatorRank): OperatorRank | null {
  return OPERATOR_RANKS[rank.index + 1] ?? null;
}
