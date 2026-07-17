export type ScoreConstants = {
  alpha: number; // exponent for alphabet size (N)
  beta: number; // exponent for accuracy (A)
  gamma: number; // exponent for speed term
  K: number; // scaling constant for time in ms
  delta: number; // exponent for total characters term
};

export const DEFAULT_SCORE_CONSTANTS: ScoreConstants = {
  alpha: 1.5,
  beta: 2.0,
  gamma: 0.5,
  K: 1000,
  delta: 0.5,
};

/**
 * Cap on the character-volume term. Without it the C^delta term is unbounded,
 * so on a best-session leaderboard the longest good session always wins —
 * rewarding stamina over skill. 200 characters (~2 sustained copy tests) is
 * where extra volume stops proving anything new.
 */
export const MAX_SCORED_CHARS = 200;

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/**
 * Counts only valid letters (A-Z, 0-9) in a string, ignoring dots, dashes, spaces, and other characters.
 * This ensures we count actual characters trained, not morse code representations.
 */
function countValidLetters(text: string): number {
  const s = (text || '').toUpperCase();
  let count = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch && /^[A-Z0-9]$/.test(ch)) {
      count += 1;
    }
  }
  return count;
}

// Count unique characters used in the sent groups (case-insensitive A–Z, 0–9)
export function calculateAlphabetSize(groups: ReadonlyArray<{ readonly sent: string }>): number {
  const uniqueChars = new Set<string>();
  groups.forEach((g) => {
    const s = (g?.sent || '').toUpperCase();
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch !== undefined && /^[A-Z0-9]$/.test(ch)) uniqueChars.add(ch);
    }
  });
  return Math.max(1, uniqueChars.size);
}

// Count total characters sent across all groups (only valid letters A-Z, 0-9)
export function calculateTotalChars(groups: ReadonlyArray<{ readonly sent: string }>): number {
  let total = 0;
  groups.forEach((g) => {
    total += countValidLetters(g?.sent || '');
  });
  return Math.max(1, total);
}

// Shannon entropy (natural log) of character distribution over A–Z, 0–9
// Returns { entropy: H, effectiveAlphabetSize: exp(H), samples: N, support: K }
export function calculateEffectiveAlphabetSize(groups: ReadonlyArray<{ readonly sent: string }>, opts?: { applyMillerMadow?: boolean }): number {
  const counts: Record<string, number> = {};
  let total = 0;
  (groups || []).forEach((g) => {
    const s = (g?.sent || '').toUpperCase();
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch !== undefined && /^[A-Z0-9]$/.test(ch)) {
        counts[ch] = (counts[ch] || 0) + 1;
        total += 1;
      }
    }
  });
  const keys = Object.keys(counts);
  const K = keys.length;
  if (total <= 0 || K === 0) return 1;
  let H = 0;
  keys.forEach((k) => {
    const p = (counts[k] || 0) / total;
    if (p > 0) H += -p * Math.log(p);
  });
  // Optional Miller–Madow small-sample bias correction (natural log base):
  // H_MM = H_MLE + (K - 1) / (2N)
  if (opts?.applyMillerMadow) {
    H += (Math.max(0, K - 1)) / (2 * total);
  }
  const N_eff = Math.max(1, Math.min(36, Math.exp(H)));
  return N_eff;
}

export function computeAverageResponseMs(timings: ReadonlyArray<{ readonly timeToCompleteMs?: number }>): number {
  const samples: number[] = [];
  (timings || []).forEach((t) => {
    const v = typeof t?.timeToCompleteMs === 'number' ? t.timeToCompleteMs : 0;
    if (Number.isFinite(v) && v > 0) samples.push(v);
  });
  if (samples.length === 0) return DEFAULT_SCORE_CONSTANTS.K; // neutral speed multiplier ≈ 1
  const sum = samples.reduce((a, b) => a + b, 0);
  return sum / samples.length;
}

export function computeSessionScore(params: {
  alphabetSize?: number; // legacy breadth metric (unique chars)
  effectiveAlphabetSize?: number; // entropy-based breadth metric
  accuracy: number; // 0..1
  avgResponseMs: number; // ms
  totalChars: number; // total characters used in session
  constants?: Partial<ScoreConstants>;
}): number {
  const c = { ...DEFAULT_SCORE_CONSTANTS, ...(params.constants || {}) } as ScoreConstants;
  const N = Math.max(1, Number((params.effectiveAlphabetSize ?? params.alphabetSize) || 0));
  const A = clampNumber(params.accuracy || 0, 0, 1);
  const tAvg = Math.max(1, Math.round(params.avgResponseMs || 0));
  const C = Math.min(MAX_SCORED_CHARS, Math.max(1, Math.floor(params.totalChars || 0)));

  const termAlphabet = Math.pow(N, c.alpha);
  const termAccuracy = Math.pow(A, c.beta);
  const termSpeed = Math.pow(c.K / tAvg, c.gamma); // sqrt for gamma=0.5
  const termVolume = Math.pow(C, c.delta);

  const score = termVolume * termAlphabet * termAccuracy * termSpeed;
  // Round to 2 decimals for stability in UI and comparisons
  return Math.round(score * 100) / 100;
}

// Deterministic public numeric ID from a Firebase UID.
//
// New users get a 9-digit ID (FNV-1a over the UID): a 900M space keeps
// birthday-collision odds negligible until ~35k users, versus ~1.1k users for
// the legacy 6-digit space. Existing users keep their stored 6-digit IDs —
// ensurePublicId never rewrites an ID that already exists, so share URLs
// stay stable and the two ranges cannot collide with each other.
export function derivePublicIdFromUid(uid: string): number {
  let hash = 0x811c9dc5; // FNV-1a offset basis
  for (let i = 0; i < uid.length; i++) {
    hash ^= uid.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193); // FNV prime
  }
  const positive = hash >>> 0;
  const id = (positive % 900000000) + 100000000; // 100000000..999999999
  return id;
}

/** @deprecated Legacy 6-digit derivation — kept only to document the historical range. */
export function deriveLegacyPublicIdFromUid(uid: string): number {
  let hash = 5381;
  for (let i = 0; i < uid.length; i++) {
    hash = ((hash << 5) + hash) + uid.charCodeAt(i); // hash * 33 + char
    hash |= 0; // 32-bit
  }
  const positive = Math.abs(hash);
  return (positive % 900000) + 100000; // 100000..999999
}


