import { averageWpm, formatWpmRange } from '@/lib/utils/wpm-display';

describe('wpm-display', () => {
  it('formats a fixed WPM as a single value', () => {
    expect(formatWpmRange(20, 20)).toBe('20');
  });

  it('formats a WPM range with an en dash', () => {
    expect(formatWpmRange(18, 22)).toBe('18–22');
  });

  it('computes the rounded average WPM', () => {
    expect(averageWpm(18, 22)).toBe(20);
    expect(averageWpm(19, 20)).toBe(20);
  });
});
