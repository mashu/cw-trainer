import {
  GROUP_START_BIGRAM_TOKEN,
  buildBigramHeatmapData,
  buildUnigramStats,
  isCharacterWrongAt,
} from '@/lib/scoring/letterErrorStats';

describe('isCharacterWrongAt', () => {
  it('treats missing received characters as wrong', () => {
    expect(isCharacterWrongAt('AB', 'A', 0)).toBe(false);
    expect(isCharacterWrongAt('AB', 'A', 1)).toBe(true);
  });

  it('does not count extra received characters beyond sent length', () => {
    expect(isCharacterWrongAt('A', 'AX', 0)).toBe(false);
  });
});

describe('buildBigramHeatmapData', () => {
  it('counts start-of-group transitions with the start token', () => {
    const { letters, matrix, maxRate } = buildBigramHeatmapData([
      { sent: 'A', received: 'A' },
    ]);

    expect(letters).toContain(GROUP_START_BIGRAM_TOKEN);
    expect(letters).toContain('A');
    const startRow = matrix.find((row) => row[0]?.row === GROUP_START_BIGRAM_TOKEN);
    const cell = startRow?.find((c) => c.col === 'A');
    expect(cell?.total).toBe(1);
    expect(cell?.wrong).toBe(0);
    expect(maxRate).toBe(0);
  });

  it('marks missing trailing characters as wrong without false positives on undefined', () => {
    const { matrix } = buildBigramHeatmapData([{ sent: 'AB', received: 'A' }]);
    const rowA = matrix.find((r) => r[0]?.row === 'A');
    const ab = rowA?.find((c) => c.col === 'B');
    expect(ab?.total).toBe(1);
    expect(ab?.wrong).toBe(1);
  });

  it('records wrong bigram when middle character mismatches', () => {
    const { matrix } = buildBigramHeatmapData([{ sent: 'AB', received: 'AX' }]);
    const rowA = matrix.find((r) => r[0]?.row === 'A');
    const ab = rowA?.find((c) => c.col === 'B');
    expect(ab?.wrong).toBe(1);
    expect(ab?.rate).toBe(1);
  });
});

describe('buildUnigramStats', () => {
  it('matches per-letter error counts', () => {
    const stats = buildUnigramStats([{ sent: 'AB', received: 'AX' }]);
    const a = stats.find((s) => s.letter === 'A');
    const b = stats.find((s) => s.letter === 'B');
    expect(a?.wrong).toBe(0);
    expect(b?.wrong).toBe(1);
  });
});
