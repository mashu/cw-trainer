import { computeMorseDotMsFromSettings } from '@/lib/training/morseTiming';

describe('computeMorseDotMsFromSettings', () => {
  it('uses average of char WPM bounds for dot length', () => {
    expect(computeMorseDotMsFromSettings({ charWpmMin: 20, charWpmMax: 20 })).toBe(60);
    expect(computeMorseDotMsFromSettings({ charWpmMin: 18, charWpmMax: 22 })).toBe(60);
  });
});
