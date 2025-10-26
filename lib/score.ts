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

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

// Count unique characters used in the sent groups (case-insensitive A–Z, 0–9)
export function calculateAlphabetSize(groups: Array<{ sent: string }>): number {
  const uniqueChars = new Set<string>();
  groups.forEach((g) => {
    const s = (g?.sent || '').toUpperCase();
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (/^[A-Z0-9]$/.test(ch)) uniqueChars.add(ch);
    }
  });
  return Math.max(1, uniqueChars.size);
}

// Count total characters sent across all groups
export function calculateTotalChars(groups: Array<{ sent: string }>): number {
  let total = 0;
  groups.forEach((g) => {
    const s = (g?.sent || '').toUpperCase();
    total += s.length;
  });
  return Math.max(1, total);
}

// Shannon entropy (natural log) of character distribution over A–Z, 0–9
// Returns { entropy: H, effectiveAlphabetSize: exp(H), samples: N, support: K }
export function calculateEffectiveAlphabetSize(groups: Array<{ sent: string }>, opts?: { applyMillerMadow?: boolean }): number {
  const counts: Record<string, number> = {};
  let total = 0;
  (groups || []).forEach((g) => {
    const s = (g?.sent || '').toUpperCase();
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (/^[A-Z0-9]$/.test(ch)) {
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

export function computeAverageResponseMs(timings: Array<{ timeToCompleteMs?: number }>): number {
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
  const C = Math.max(1, Math.floor(params.totalChars || 0));

  const termAlphabet = Math.pow(N, c.alpha);
  const termAccuracy = Math.pow(A, c.beta);
  const termSpeed = Math.pow(c.K / tAvg, c.gamma); // sqrt for gamma=0.5
  const termVolume = Math.pow(C, c.delta);

  const score = termVolume * termAlphabet * termAccuracy * termSpeed;
  // Round to 2 decimals for stability in UI and comparisons
  return Math.round(score * 100) / 100;
}

// Deterministic public numeric ID from Firebase UID (djb2 variant), 6 digits minimum
export function derivePublicIdFromUid(uid: string): number {
  let hash = 5381;
  for (let i = 0; i < uid.length; i++) {
    hash = ((hash << 5) + hash) + uid.charCodeAt(i); // hash * 33 + char
    hash |= 0; // 32-bit
  }
  const positive = Math.abs(hash);
  const id = (positive % 900000) + 100000; // 100000..999999
  return id;
}


