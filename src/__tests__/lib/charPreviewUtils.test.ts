import { describe, expect, it } from '@jest/globals';

import {
  defaultCharPreviewIndex,
  isDigitChar,
  splitLettersAndDigits,
} from '@/lib/charPreviewUtils';

describe('charPreviewUtils', () => {
  it('splits mixed pools into letters and digits', () => {
    expect(splitLettersAndDigits(['K', 'M', '3', '7'])).toEqual({
      letters: ['K', 'M'],
      digits: ['3', '7'],
    });
  });

  it('identifies digit characters', () => {
    expect(isDigitChar('5')).toBe(true);
    expect(isDigitChar('K')).toBe(false);
  });

  it('defaults preview index to the last newly unlocked character', () => {
    expect(defaultCharPreviewIndex(['K', 'M', 'U'], ['K', 'M'])).toBe(2);
    expect(defaultCharPreviewIndex(['0', '1', '2'], ['0', '1'])).toBe(2);
  });
});
