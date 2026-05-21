import {
  calibratedReactionMs,
  getBarFill,
  getReactionTextClass,
  micErrorMessage,
  pickRandomChar,
} from '@/lib/icrHelpers';

const buckets = { greenMax: 400, yellowMax: 600, orangeMax: 800 };

describe('pickRandomChar', () => {
  it('returns a character from the koch pool', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const ch = pickRandomChar({ kochLevel: 2 });
    expect(ch).toHaveLength(1);
    expect(ch).toMatch(/[A-Z0-9]/);
    jest.spyOn(Math, 'random').mockRestore();
  });

  it('falls back to koch pool when custom set is empty', () => {
    const ch = pickRandomChar({ kochLevel: 1, charSetMode: 'custom', customSet: [] });
    expect(ch).toMatch(/^[A-Z0-9]$/);
  });
});

describe('getReactionTextClass', () => {
  it('maps reaction buckets to tailwind classes', () => {
    expect(getReactionTextClass(undefined, buckets)).toBe('text-slate-600');
    expect(getReactionTextClass(300, buckets)).toMatch(/emerald/);
    expect(getReactionTextClass(500, buckets)).toMatch(/lime/);
    expect(getReactionTextClass(700, buckets)).toMatch(/orange/);
    expect(getReactionTextClass(900, buckets)).toMatch(/rose/);
  });
});

describe('getBarFill', () => {
  it('maps reaction buckets to chart colors', () => {
    expect(getBarFill(300, buckets)).toBe('#10b981');
    expect(getBarFill(900, buckets)).toBe('#ef4444');
  });
});

describe('micErrorMessage', () => {
  it('maps permission errors', () => {
    expect(micErrorMessage(new DOMException('denied', 'NotAllowedError'))).toMatch(/denied/i);
  });

  it('maps not-found errors', () => {
    expect(micErrorMessage(new DOMException('missing', 'NotFoundError'))).toMatch(/no microphone/i);
  });

  it('returns generic message for unknown errors', () => {
    expect(micErrorMessage('boom')).toMatch(/failed to start/i);
  });
});

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
