import { computeStreakStatus } from '@/lib/streak';

const dayMs = 24 * 60 * 60 * 1000;
const dateAt = (base: number, offsetDays: number): string =>
  new Date(base + offsetDays * dayMs).toISOString().slice(0, 10);

// Noon UTC keeps the local calendar date stable for test runners within ±11h of UTC.
const NOW = Date.parse('2026-07-17T12:00:00.000Z');
const TODAY = Date.parse('2026-07-17T00:00:00.000Z');

describe('computeStreakStatus', () => {
  it('returns none with no history', () => {
    expect(computeStreakStatus([], NOW).state).toBe('none');
  });

  it('is safe when practiced today', () => {
    const dates = [dateAt(TODAY, -2), dateAt(TODAY, -1), dateAt(TODAY, 0)];
    const status = computeStreakStatus(dates, NOW);
    expect(status.state).toBe('safe');
    expect(status.days).toBe(3);
  });

  it('is at risk when the streak reaches yesterday but not today', () => {
    const dates = [dateAt(TODAY, -3), dateAt(TODAY, -2), dateAt(TODAY, -1)];
    const status = computeStreakStatus(dates, NOW);
    expect(status.state).toBe('at-risk');
    expect(status.days).toBe(3);
  });

  it('earns a freeze after 7 practiced days and spends it on a missed day', () => {
    // 7 consecutive days earn one freeze, then one missed day, then practice resumes.
    const dates = [
      ...Array.from({ length: 7 }, (_, i) => dateAt(TODAY, -10 + i)), // days -10..-4
      // day -3 missed (freeze consumed)
      dateAt(TODAY, -2),
      dateAt(TODAY, -1),
      dateAt(TODAY, 0),
    ];
    const status = computeStreakStatus(dates, NOW);
    expect(status.state).toBe('safe');
    expect(status.days).toBe(10); // 7 + frozen continuation + 3 more practiced days
    expect(status.freezesUsed).toBe(1);
  });

  it('breaks the streak when the gap exceeds available freezes', () => {
    const dates = [
      dateAt(TODAY, -8),
      dateAt(TODAY, -7),
      dateAt(TODAY, -6),
      // -5..-3 missed: 3-day gap, no freezes earned yet
      dateAt(TODAY, -2),
      dateAt(TODAY, -1),
      dateAt(TODAY, 0),
    ];
    const status = computeStreakStatus(dates, NOW);
    expect(status.state).toBe('safe');
    expect(status.days).toBe(3);
  });

  it('reports a recently lost streak', () => {
    const dates = [dateAt(TODAY, -6), dateAt(TODAY, -5), dateAt(TODAY, -4)];
    const status = computeStreakStatus(dates, NOW);
    expect(status.state).toBe('lost');
    expect(status.days).toBe(0);
    expect(status.lostStreakDays).toBe(3);
  });

  it('shows nothing once a lapse is old news', () => {
    const dates = [dateAt(TODAY, -40), dateAt(TODAY, -39)];
    expect(computeStreakStatus(dates, NOW).state).toBe('none');
  });

  it('keeps an at-risk streak alive across missed days covered by banked freezes', () => {
    // 14 practiced days bank two freezes; yesterday missed, today not yet practiced.
    const dates = Array.from({ length: 14 }, (_, i) => dateAt(TODAY, -16 + i)); // -16..-3
    // day -2 missed, day -1 missed → both covered by the two banked freezes
    const status = computeStreakStatus(dates, NOW);
    expect(status.state).toBe('at-risk');
    expect(status.days).toBe(14);
    expect(status.freezesAvailable).toBe(0);
    expect(status.freezesUsed).toBe(2);
  });
});
