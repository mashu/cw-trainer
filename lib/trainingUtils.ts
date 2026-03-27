import type { TrainingSettings } from '@/components/ui/forms/TrainingSettingsForm';

import { LCWO_SEQUENCE } from './morseConstants';

const DIGITS_SET = new Set<string>(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);

export interface TrainingSettingsLite {
  kochLevel: number;
  minGroupSize: number;
  maxGroupSize: number;
  // Optional character set controls (fallbacks maintain backward compatibility)
  charSetMode?: 'koch' | 'digits' | 'custom' | 'mixed';
  digitsLevel?: number; // 1..10
  /** When charSetMode is 'mixed': 0–100 = percent of characters that are letters. Default 70. */
  mixedLettersPercent?: number;
  customSet?: string[]; // explicit pool when in custom mode
  customSequence?: string[]; // custom sequence order for Koch mode
  slidingWindowStart?: number; // 1-based start index in unlocked sequence
  slidingWindowEnd?: number;    // 1-based end index (inclusive)
}

const DIGITS_ASC: string[] = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

export function computeCharPool(
  settings: Pick<TrainingSettings, 'kochLevel' | 'charSetMode' | 'digitsLevel' | 'mixedLettersPercent' | 'customSet' | 'customSequence' | 'slidingWindowStart' | 'slidingWindowEnd'>,
): string[] {
  const mode = settings.charSetMode || 'koch';
  if (mode === 'mixed') {
    // Union of alphabet (Koch) pool and digits pool. In mixed we always use all unlocked letters (no Practice slice).
    const sequence = Array.isArray(settings.customSequence) && settings.customSequence.length > 0
      ? settings.customSequence
      : LCWO_SEQUENCE;
    const nUnlocked = Math.max(2, Math.min(settings.kochLevel + 1, sequence.length));
    const kochPool = computeCharPool({
      ...settings,
      charSetMode: 'koch',
      slidingWindowStart: 1,
      slidingWindowEnd: nUnlocked,
    });
    const digitsCount = Math.max(1, Math.min(10, settings.digitsLevel ?? 10));
    const digitsPool = DIGITS_ASC.slice(0, digitsCount);
    const union = Array.from(new Set([...kochPool, ...digitsPool]));
    return union.length >= 2 ? union : (kochPool.length >= 2 ? kochPool : union);
  }
  if (mode === 'digits') {
    const count = Math.max(1, Math.min(10, settings.digitsLevel || 10));
    const fullUnlocked = DIGITS_ASC.slice(0, count);
    const n = fullUnlocked.length;
    if (n === 0) return fullUnlocked;
    const start1 = Math.max(1, Math.min(settings.slidingWindowStart ?? 1, n));
    const end1 = Math.max(1, Math.min(settings.slidingWindowEnd ?? 40, n));
    const startIdx = Math.min(start1, end1);
    const endIdx = Math.max(start1, end1);
    const pool = fullUnlocked.slice(startIdx - 1, endIdx);
    return pool.length >= 2 ? pool : fullUnlocked.slice(-2);
  }
  if (mode === 'custom') {
    const set = Array.isArray(settings.customSet) ? settings.customSet : [];
    const pool = Array.from(
      new Set(set.map((c) => (c || '').toString().trim().toUpperCase()).filter(Boolean)),
    );
    if (pool.length > 0) return pool;
    // Fallback to Koch if empty custom set
  }
  // Use custom sequence if available, otherwise fall back to LCWO_SEQUENCE
  const sequence = Array.isArray(settings.customSequence) && settings.customSequence.length > 0
    ? settings.customSequence
    : LCWO_SEQUENCE;
  // Level 1 = 2 characters, Level 2 = 3 characters, etc. (characters = level + 1)
  const level = settings.kochLevel || 1;
  const charCount = Math.min(level + 1, sequence.length);
  const fullUnlocked = sequence.slice(0, Math.max(2, charCount));
  const n = fullUnlocked.length;
  if (n === 0) return fullUnlocked;
  const start1 = Math.max(1, Math.min(settings.slidingWindowStart ?? 1, n));
  const end1 = Math.max(1, Math.min(settings.slidingWindowEnd ?? 40, n));
  const startIdx = Math.min(start1, end1);
  const endIdx = Math.max(start1, end1);
  const pool = fullUnlocked.slice(startIdx - 1, endIdx);
  return pool.length >= 2 ? pool : fullUnlocked.slice(-2);
}

/**
 * Pick a random element from `pool` proportional to `weights`.
 * If weights is empty/missing or pool has one element, falls back to uniform.
 */
export function weightedRandomPick(pool: readonly string[], weights: readonly number[]): string {
  if (pool.length === 0) return '';
  if (pool.length === 1 || weights.length === 0) return pool[Math.floor(Math.random() * pool.length)] ?? '';

  let totalWeight = 0;
  for (let i = 0; i < pool.length; i++) {
    totalWeight += weights[i] ?? 1;
  }
  if (totalWeight <= 0) return pool[Math.floor(Math.random() * pool.length)] ?? '';

  let r = Math.random() * totalWeight;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i] ?? 1;
    if (r <= 0) return pool[i] ?? '';
  }
  return pool[pool.length - 1] ?? '';
}

export function generateGroup(
  settings: TrainingSettingsLite,
  charWeights?: Readonly<Record<string, number>>,
): string {
  const poolSettings: Pick<TrainingSettings, 'kochLevel' | 'charSetMode' | 'digitsLevel' | 'mixedLettersPercent' | 'customSet' | 'customSequence' | 'slidingWindowStart' | 'slidingWindowEnd'> = {
    kochLevel: settings.kochLevel,
    ...(settings.charSetMode !== undefined ? { charSetMode: settings.charSetMode } : {}),
    ...(settings.digitsLevel !== undefined ? { digitsLevel: settings.digitsLevel } : {}),
    ...(settings.mixedLettersPercent !== undefined ? { mixedLettersPercent: settings.mixedLettersPercent } : {}),
    ...(settings.customSet !== undefined ? { customSet: settings.customSet } : {}),
    ...(settings.customSequence !== undefined ? { customSequence: settings.customSequence } : {}),
    ...(settings.slidingWindowStart !== undefined ? { slidingWindowStart: settings.slidingWindowStart } : {}),
    ...(settings.slidingWindowEnd !== undefined ? { slidingWindowEnd: settings.slidingWindowEnd } : {}),
  };
  const availableChars = computeCharPool(poolSettings);
  const groupSize =
    Math.floor(Math.random() * (settings.maxGroupSize - settings.minGroupSize + 1)) +
    settings.minGroupSize;
  let group = '';
  const fallbackSequence = Array.isArray(settings.customSequence) && settings.customSequence.length > 0
    ? settings.customSequence
    : LCWO_SEQUENCE;
  // Level 1 = 2 characters, Level 2 = 3 characters, etc. (characters = level + 1)
  const charCount = Math.min((settings.kochLevel || 1) + 1, fallbackSequence.length);
  const safePool =
    Array.isArray(availableChars) && availableChars.length > 0
      ? availableChars
      : fallbackSequence.slice(0, charCount);

  const isMixed = settings.charSetMode === 'mixed';
  const mixedLettersPct = Math.max(0, Math.min(100, settings.mixedLettersPercent ?? 70)) / 100;
  const lettersSubset = isMixed ? safePool.filter((c) => !DIGITS_SET.has(c)) : [];
  const digitsSubset = isMixed ? safePool.filter((c) => DIGITS_SET.has(c)) : [];
  const useMixedBiased = isMixed && (lettersSubset.length > 0 || digitsSubset.length > 0);

  const useWeighted = charWeights && Object.keys(charWeights).length > 0;
  if (useMixedBiased) {
    for (let i = 0; i < groupSize; i++) {
      const pickFromLetters = Math.random() < mixedLettersPct;
      const pool = pickFromLetters ? lettersSubset : digitsSubset;
      const fallbackPool = pool.length > 0 ? pool : safePool;
      const chosen = fallbackPool[Math.floor(Math.random() * fallbackPool.length)] ?? '';
      if (chosen) group += chosen;
      else group += safePool[Math.floor(Math.random() * safePool.length)] ?? '';
    }
  } else if (useWeighted) {
    const weights = safePool.map((ch) => charWeights[ch] ?? 1);
    for (let i = 0; i < groupSize; i++) {
      group += weightedRandomPick(safePool, weights);
    }
  } else {
    for (let i = 0; i < groupSize; i++) {
      group += safePool[Math.floor(Math.random() * safePool.length)];
    }
  }
  return group;
}
