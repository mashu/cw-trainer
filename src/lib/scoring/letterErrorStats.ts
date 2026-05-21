import { LCWO_SEQUENCE } from '@/lib/morseConstants';

/** Token for “start of group” in the bigram matrix (first character has no predecessor). */
export const GROUP_START_BIGRAM_TOKEN = '▸' as const;

export type LetterGroupSample = {
  readonly sent: string;
  readonly received: string;
};

export type BigramCellStat = {
  readonly row: string;
  readonly col: string;
  readonly rate: number;
  readonly total: number;
  readonly wrong: number;
};

export type UnigramStat = {
  readonly letter: string;
  readonly total: number;
  readonly wrong: number;
  readonly rate: number;
};

export type BigramHeatmapData = {
  readonly letters: readonly string[];
  readonly matrix: ReadonlyArray<ReadonlyArray<BigramCellStat>>;
  readonly maxRate: number;
};

/** Whether the typed character at `index` mismatches what was sent (missing counts as wrong). */
export function isCharacterWrongAt(
  sent: string,
  received: string,
  index: number,
): boolean {
  const expected = sent[index];
  if (expected === undefined) {
    return false;
  }
  const typed = received[index];
  if (typed === undefined) {
    return true;
  }
  return typed !== expected;
}

export function compareLcwoLetters(
  a: string,
  b: string,
  startToken: string = GROUP_START_BIGRAM_TOKEN,
): number {
  if (a === startToken) return -1;
  if (b === startToken) return 1;
  return LCWO_SEQUENCE.indexOf(a) - LCWO_SEQUENCE.indexOf(b);
}

export function buildBigramHeatmapData(
  groups: readonly LetterGroupSample[],
  startToken: string = GROUP_START_BIGRAM_TOKEN,
): BigramHeatmapData {
  const lettersSet = new Set<string>();
  const counts: Record<string, Record<string, { wrong: number; total: number }>> = {};

  for (const group of groups) {
    const sent = group.sent.toUpperCase();
    const rec = group.received.toUpperCase();
    for (let i = 0; i < sent.length; i += 1) {
      const prev = i === 0 ? startToken : sent[i - 1];
      const curr = sent[i];
      if (!prev || !curr) continue;
      lettersSet.add(prev);
      lettersSet.add(curr);
      if (!counts[prev]) counts[prev] = {};
      if (!counts[prev][curr]) counts[prev][curr] = { wrong: 0, total: 0 };
      counts[prev][curr].total += 1;
      if (isCharacterWrongAt(sent, rec, i)) {
        counts[prev][curr].wrong += 1;
      }
    }
  }

  const letters = Array.from(lettersSet).sort((a, b) => compareLcwoLetters(a, b, startToken));
  let maxRate = 0;
  const matrix = letters.map((row) =>
    letters.map((col) => {
      const c = counts[row]?.[col];
      const total = c?.total ?? 0;
      const wrong = c?.wrong ?? 0;
      const rate = total > 0 ? wrong / total : 0;
      if (rate > maxRate) maxRate = rate;
      return { row, col, rate, total, wrong };
    }),
  );

  return { letters, matrix, maxRate };
}

export function buildUnigramStats(
  groups: readonly LetterGroupSample[],
): readonly UnigramStat[] {
  const counts: Record<string, { wrong: number; total: number }> = {};

  for (const group of groups) {
    const sent = group.sent.toUpperCase();
    const rec = group.received.toUpperCase();
    for (let i = 0; i < sent.length; i += 1) {
      const ch = sent[i];
      if (!ch) continue;
      if (!counts[ch]) counts[ch] = { wrong: 0, total: 0 };
      counts[ch].total += 1;
      if (isCharacterWrongAt(sent, rec, i)) {
        counts[ch].wrong += 1;
      }
    }
  }

  return Object.entries(counts)
    .map(([letter, c]) => ({
      letter,
      total: c.total,
      wrong: c.wrong,
      rate: c.total > 0 ? c.wrong / c.total : 0,
    }))
    .sort((a, b) => compareLcwoLetters(a.letter, b.letter));
}
