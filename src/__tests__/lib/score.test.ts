import { MAX_SCORED_CHARS, computeSessionScore } from '@/lib/score';

describe('computeSessionScore', () => {
  const base = {
    effectiveAlphabetSize: 10,
    accuracy: 0.95,
    avgResponseMs: 1000,
  };

  it('rewards more characters up to the volume cap', () => {
    const short = computeSessionScore({ ...base, totalChars: 50 });
    const longer = computeSessionScore({ ...base, totalChars: MAX_SCORED_CHARS });
    expect(longer).toBeGreaterThan(short);
  });

  it('stops rewarding volume beyond the cap so grinding cannot outscore skill', () => {
    const atCap = computeSessionScore({ ...base, totalChars: MAX_SCORED_CHARS });
    const wayPastCap = computeSessionScore({ ...base, totalChars: MAX_SCORED_CHARS * 50 });
    expect(wayPastCap).toBe(atCap);
  });

  it('still ranks accuracy and speed above capped volume', () => {
    const grinder = computeSessionScore({ ...base, accuracy: 0.8, totalChars: 100000 });
    const sharpshooter = computeSessionScore({ ...base, accuracy: 1, totalChars: MAX_SCORED_CHARS });
    expect(sharpshooter).toBeGreaterThan(grinder);
  });
});
