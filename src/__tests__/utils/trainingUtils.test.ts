import { computeCharPool, weightedRandomPick, generateGroup } from '@/lib/trainingUtils';

describe('weightedRandomPick', () => {
  it('returns empty string for empty pool', () => {
    expect(weightedRandomPick([], [])).toBe('');
  });

  it('returns the only element for a single-element pool', () => {
    expect(weightedRandomPick(['A'], [1])).toBe('A');
  });

  it('returns a pool element for uniform weights', () => {
    const pool = ['A', 'B', 'C'];
    const weights = [1, 1, 1];
    const result = weightedRandomPick(pool, weights);
    expect(pool).toContain(result);
  });

  it('falls back to uniform when weights array is empty', () => {
    const pool = ['X', 'Y'];
    const result = weightedRandomPick(pool, []);
    expect(pool).toContain(result);
  });

  it('heavily biases towards the character with the highest weight', () => {
    const pool = ['A', 'B'];
    const weights = [100, 0.01];
    const counts: Record<string, number> = { A: 0, B: 0 };
    for (let i = 0; i < 1000; i++) {
      const key = weightedRandomPick(pool, weights);
      counts[key] = (counts[key] ?? 0) + 1;
    }
    expect(counts['A']).toBeGreaterThan(900);
  });

  it('picks from every character with non-zero weights', () => {
    const pool = ['A', 'B', 'C'];
    const weights = [1, 1, 1];
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) {
      seen.add(weightedRandomPick(pool, weights));
    }
    expect(seen.size).toBe(3);
  });
});

describe('generateGroup with charWeights', () => {
  it('generates a group without weights (uniform)', () => {
    const group = generateGroup({
      kochLevel: 1,
      minGroupSize: 3,
      maxGroupSize: 3,
    });
    expect(group.length).toBe(3);
  });

  it('generates a group with charWeights', () => {
    const weights: Record<string, number> = { K: 10, M: 0.01 };
    const group = generateGroup(
      { kochLevel: 1, minGroupSize: 5, maxGroupSize: 5 },
      weights,
    );
    expect(group.length).toBe(5);
    for (const ch of group) {
      expect(['K', 'M']).toContain(ch);
    }
  });

  it('biases towards high-weight characters', () => {
    const weights: Record<string, number> = { K: 100, M: 0.01 };
    let kCount = 0;
    for (let i = 0; i < 200; i++) {
      const group = generateGroup(
        { kochLevel: 1, minGroupSize: 1, maxGroupSize: 1 },
        weights,
      );
      if (group === 'K') kCount++;
    }
    expect(kCount).toBeGreaterThan(150);
  });
});

describe('computeCharPool digits mode', () => {
  it('unlocks two digits at level 1', () => {
    const pool = computeCharPool({
      kochLevel: 1,
      charSetMode: 'digits',
      digitsLevel: 1,
    });
    expect(pool).toEqual(['0', '1']);
  });
});

describe('computeCharPool mixed mode', () => {
  it('returns union of alphabet and digits without duplicating digits', () => {
    // Mixed level 2 → 2 letters + 1 digit (K, M, 0).
    const pool = computeCharPool({
      kochLevel: 2,
      charSetMode: 'mixed',
      digitsLevel: 2,
      mixedLettersPercent: 70,
    });
    expect(pool).toContain('K');
    expect(pool).toContain('M');
    expect(pool).toContain('0');
    expect(pool).not.toContain('1');
    expect(pool.length).toBe(new Set(pool).size);
  });

  it('starts mixed mode with one letter and one digit at level 1', () => {
    const pool = computeCharPool({
      kochLevel: 1,
      charSetMode: 'mixed',
      digitsLevel: 1,
      mixedLettersPercent: 70,
    });
    expect(pool).toEqual(['K', '0']);
  });

  it('includes digits from sequence only once when they appear in both alphabet and digits level', () => {
    // LCWO has digits later in sequence. High koch level includes e.g. 5,9,2; digits level 3 = 0,1,2.
    // Union should have each digit once.
    const pool = computeCharPool({
      kochLevel: 25,
      charSetMode: 'mixed',
      digitsLevel: 3,
      mixedLettersPercent: 50,
    });
    const digitsInPool = pool.filter((c) => /^[0-9]$/.test(c));
    expect(new Set(digitsInPool).size).toBe(digitsInPool.length);
  });
});

describe('generateGroup mixed mode', () => {
  it('produces only characters from the combined pool', () => {
    const pool = computeCharPool({
      kochLevel: 1,
      charSetMode: 'mixed',
      digitsLevel: 2,
      mixedLettersPercent: 70,
    });
    for (let i = 0; i < 50; i++) {
      const group = generateGroup({
        kochLevel: 1,
        charSetMode: 'mixed',
        digitsLevel: 2,
        mixedLettersPercent: 70,
        minGroupSize: 1,
        maxGroupSize: 5,
      });
      for (const ch of group) {
        expect(pool).toContain(ch);
      }
    }
  });
});
