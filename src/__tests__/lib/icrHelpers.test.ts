import { calibratedReactionMs } from '@/lib/icrHelpers';

describe('calibratedReactionMs', () => {
  it('returns raw when no calibration', () => {
    expect(calibratedReactionMs(200, null)).toBe(200);
    expect(calibratedReactionMs(200, undefined)).toBe(200);
    expect(calibratedReactionMs(200, 0)).toBe(200);
  });

  it('subtracts calibration and floors at 0', () => {
    expect(calibratedReactionMs(250, 50)).toBe(200);
    expect(calibratedReactionMs(30, 80)).toBe(0);
  });
});
