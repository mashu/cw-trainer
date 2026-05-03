import { shuffleArray } from '@/lib/utils/shuffleArray';

describe('shuffleArray', () => {
  it('returns empty array for empty input', () => {
    expect(shuffleArray([])).toEqual([]);
  });

  it('preserves length and multiset of elements', () => {
    const input = ['a', 'b', 'b', 'c'];
    const out = shuffleArray(input);
    expect(out).toHaveLength(input.length);
    expect(out.slice().sort()).toEqual(input.slice().sort());
    expect(input).toEqual(['a', 'b', 'b', 'c']);
  });

  it('returns single element unchanged', () => {
    expect(shuffleArray(['x'])).toEqual(['x']);
  });
});
