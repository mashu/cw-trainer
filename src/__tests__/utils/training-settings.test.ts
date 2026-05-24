import { describe, expect, it } from '@jest/globals';

import { DEFAULT_TRAINING_SETTINGS } from '@/config/training.config';
import {
  normalizeTrainingSettings,
  serializeTrainingSettings,
  hasSettingsChanged,
} from '@/lib/utils/training-settings';
import type { TrainingSettings } from '@/types';

describe('normalizeTrainingSettings', () => {
  it('returns fallback for null input', () => {
    const result = normalizeTrainingSettings(null, DEFAULT_TRAINING_SETTINGS);
    expect(result).toEqual(DEFAULT_TRAINING_SETTINGS);
  });

  it('returns fallback for undefined input', () => {
    const result = normalizeTrainingSettings(undefined, DEFAULT_TRAINING_SETTINGS);
    expect(result).toEqual(DEFAULT_TRAINING_SETTINGS);
  });

  it('returns fallback for non-object input', () => {
    expect(normalizeTrainingSettings('string', DEFAULT_TRAINING_SETTINGS)).toEqual(
      DEFAULT_TRAINING_SETTINGS,
    );
    expect(normalizeTrainingSettings(123, DEFAULT_TRAINING_SETTINGS)).toEqual(
      DEFAULT_TRAINING_SETTINGS,
    );
    expect(normalizeTrainingSettings([], DEFAULT_TRAINING_SETTINGS)).toEqual(
      DEFAULT_TRAINING_SETTINGS,
    );
  });

  it('normalizes valid settings', () => {
    const input = {
      charWpmMin: 25,
      charWpmMax: 25,
      effectiveWpmMin: 20,
      effectiveWpmMax: 20,
      kochLevel: 10,
    };
    const result = normalizeTrainingSettings(input, DEFAULT_TRAINING_SETTINGS);

    expect(result.charWpmMin).toBe(25);
    expect(result.charWpmMax).toBe(25);
    expect(result.effectiveWpmMin).toBe(20);
    expect(result.effectiveWpmMax).toBe(20);
    expect(result.kochLevel).toBe(10);
  });

  it('normalizes charSetMode correctly', () => {
    expect(
      normalizeTrainingSettings({ charSetMode: 'koch' }, DEFAULT_TRAINING_SETTINGS).charSetMode,
    ).toBe('koch');
    expect(
      normalizeTrainingSettings({ charSetMode: 'digits' }, DEFAULT_TRAINING_SETTINGS).charSetMode,
    ).toBe('digits');
    expect(
      normalizeTrainingSettings({ charSetMode: 'custom' }, DEFAULT_TRAINING_SETTINGS).charSetMode,
    ).toBe('custom');
    expect(
      normalizeTrainingSettings({ charSetMode: 'invalid' }, DEFAULT_TRAINING_SETTINGS).charSetMode,
    ).toBe(DEFAULT_TRAINING_SETTINGS.charSetMode);
  });

  it('normalizes digitsLevel within bounds', () => {
    expect(
      normalizeTrainingSettings({ digitsLevel: 5 }, DEFAULT_TRAINING_SETTINGS).digitsLevel,
    ).toBe(5);
    expect(
      normalizeTrainingSettings({ digitsLevel: 1 }, DEFAULT_TRAINING_SETTINGS).digitsLevel,
    ).toBe(1);
    expect(
      normalizeTrainingSettings({ digitsLevel: 10 }, DEFAULT_TRAINING_SETTINGS).digitsLevel,
    ).toBe(10);
    expect(
      normalizeTrainingSettings({ digitsLevel: 0 }, DEFAULT_TRAINING_SETTINGS).digitsLevel,
    ).toBe(1);
    expect(
      normalizeTrainingSettings({ digitsLevel: 15 }, DEFAULT_TRAINING_SETTINGS).digitsLevel,
    ).toBe(10);
    expect(
      normalizeTrainingSettings({ digitsLevel: -5 }, DEFAULT_TRAINING_SETTINGS).digitsLevel,
    ).toBe(1);
    expect(
      normalizeTrainingSettings({ digitsLevel: 5.7 }, DEFAULT_TRAINING_SETTINGS).digitsLevel,
    ).toBe(5);
  });

  it('normalizes customSet correctly', () => {
    const result1 = normalizeTrainingSettings(
      { customSet: ['a', 'b', 'c'] },
      DEFAULT_TRAINING_SETTINGS,
    );
    expect(result1.customSet).toEqual(['A', 'B', 'C']);

    const result2 = normalizeTrainingSettings(
      { customSet: ['a', 'A', 'b', '  c  ', ''] },
      DEFAULT_TRAINING_SETTINGS,
    );
    expect(result2.customSet).toEqual(['A', 'B', 'C']);

    const result3 = normalizeTrainingSettings(
      { customSet: 'not an array' },
      DEFAULT_TRAINING_SETTINGS,
    );
    expect(result3.customSet).toEqual(DEFAULT_TRAINING_SETTINGS.customSet);
  });

  it('normalizes boolean fields', () => {
    const result1 = normalizeTrainingSettings({ autoAdjustKoch: true }, DEFAULT_TRAINING_SETTINGS);
    expect(result1.autoAdjustKoch).toBe(true);

    const result2 = normalizeTrainingSettings({ autoAdjustKoch: false }, DEFAULT_TRAINING_SETTINGS);
    expect(result2.autoAdjustKoch).toBe(false);

    const result3 = normalizeTrainingSettings({ linkCharWpm: true }, DEFAULT_TRAINING_SETTINGS);
    expect(result3.linkCharWpm).toBe(true);

    const result4 = normalizeTrainingSettings({ linkCharWpm: false }, DEFAULT_TRAINING_SETTINGS);
    expect(result4.linkCharWpm).toBe(false);
  });

  it('normalizes band condition fields', () => {
    const result = normalizeTrainingSettings(
      {
        qsbEnabled: true,
        qsbDepth: 1.4,
        qsbRateHz: 0.01,
        qrnEnabled: true,
        qrnLevel: 0.6,
        qrmEnabled: true,
        qrmLevel: -0.5,
        qrmProfile: 'ringing',
        receiverBackgroundGain: 50,
        receiverBackgroundExcitationRate: 0,
        receiverBackgroundResonance: 500,
        receiverBackgroundDecay: 1,
        receiverBackgroundOffsetHz: 5000,
        receiverBackgroundOffsetModDepthHz: 5000,
        receiverBackgroundOffsetModRateHz: 50,
      },
      DEFAULT_TRAINING_SETTINGS,
    );

    expect(result.qsbEnabled).toBe(true);
    expect(result.qsbDepth).toBe(1);
    expect(result.qsbRateHz).toBe(0.03);
    expect(result.qrnEnabled).toBe(true);
    expect(result.qrnLevel).toBe(0.6);
    expect(result.qrmEnabled).toBe(true);
    expect(result.qrmLevel).toBe(0);
    expect(result.qrmProfile).toBe('ringing');
    expect(result.receiverBackgroundGain).toBe(20);
    expect(result.receiverBackgroundExcitationRate).toBe(0.1);
    expect(result.receiverBackgroundResonance).toBe(240);
    expect(result.receiverBackgroundDecay).toBe(0.9999);
    expect(result.receiverBackgroundOffsetHz).toBe(1000);
    expect(result.receiverBackgroundOffsetModDepthHz).toBe(1000);
    expect(result.receiverBackgroundOffsetModRateHz).toBe(20);
  });

  it('normalizes Chase settings within bounds', () => {
    const result = normalizeTrainingSettings(
      {
        chaseLives: 10,
        chaseAutoLevelEnabled: false,
        chaseGroupsPerLevel: 200,
        chaseStartFallMs: 100,
        chaseMinFallMs: 90000,
        chaseLevelSpeedupMs: 9000,
        chaseGroupSpeedupMs: -10,
      },
      DEFAULT_TRAINING_SETTINGS,
    );

    expect(result.chaseLives).toBe(6);
    expect(result.chaseAutoLevelEnabled).toBe(false);
    expect(result.chaseGroupsPerLevel).toBe(50);
    expect(result.chaseStartFallMs).toBe(60000);
    expect(result.chaseMinFallMs).toBe(60000);
    expect(result.chaseLevelSpeedupMs).toBe(5000);
    expect(result.chaseGroupSpeedupMs).toBe(0);
  });

  it('repairs Chase start fall time below minimum fall time', () => {
    const result = normalizeTrainingSettings(
      {
        chaseStartFallMs: 1000,
        chaseMinFallMs: 2000,
      },
      DEFAULT_TRAINING_SETTINGS,
    );

    expect(result.chaseStartFallMs).toBe(2000);
    expect(result.chaseMinFallMs).toBe(2000);
  });

  it('falls back for invalid QRM profile', () => {
    const result = normalizeTrainingSettings(
      { qrmProfile: 'invalid-profile' },
      DEFAULT_TRAINING_SETTINGS,
    );

    expect(result.qrmProfile).toBe(DEFAULT_TRAINING_SETTINGS.qrmProfile);
  });

  it('returns fallback when validation fails', () => {
    const invalidInput = {
      charWpm: -10, // Invalid: should be positive
      kochLevel: 1000, // Invalid: too high
    };
    const result = normalizeTrainingSettings(invalidInput, DEFAULT_TRAINING_SETTINGS);
    expect(result).toEqual(DEFAULT_TRAINING_SETTINGS);
  });

  it('repairs maxGroupSize < minGroupSize instead of falling back', () => {
    const result = normalizeTrainingSettings(
      { minGroupSize: 5, maxGroupSize: 2, linkGroupSize: false },
      DEFAULT_TRAINING_SETTINGS,
    );

    expect(result.minGroupSize).toBe(5);
    expect(result.maxGroupSize).toBe(5);
  });

  it('merges partial settings with fallback', () => {
    const partial = {
      charWpmMin: 30,
      charWpmMax: 30,
      sessionDuration: 10,
    };
    const result = normalizeTrainingSettings(partial, DEFAULT_TRAINING_SETTINGS);

    expect(result.charWpmMin).toBe(30);
    expect(result.sessionDuration).toBe(10);
    expect(result.kochLevel).toBe(DEFAULT_TRAINING_SETTINGS.kochLevel);
    expect(result.effectiveWpmMin).toBe(DEFAULT_TRAINING_SETTINGS.effectiveWpmMin);
  });
});

describe('serializeTrainingSettings', () => {
  it('serializes valid settings to JSON string', () => {
    const settings: TrainingSettings = {
      ...DEFAULT_TRAINING_SETTINGS,
      charWpmMin: 25,
      charWpmMax: 25,
    };
    const serialized = serializeTrainingSettings(settings);

    expect(typeof serialized).toBe('string');
    const parsed = JSON.parse(serialized);
    expect(parsed.charWpmMin).toBe(25);
  });

  it('validates settings before serialization', () => {
    const invalidSettings = {
      ...DEFAULT_TRAINING_SETTINGS,
      charWpmMin: -10, // Invalid
    };

    expect(() => serializeTrainingSettings(invalidSettings as TrainingSettings)).toThrow();
  });

  it('produces stable serialization', () => {
    const settings: TrainingSettings = {
      ...DEFAULT_TRAINING_SETTINGS,
      charWpmMin: 20,
      charWpmMax: 20,
      effectiveWpmMin: 18,
      effectiveWpmMax: 18,
    };
    const serialized1 = serializeTrainingSettings(settings);
    const serialized2 = serializeTrainingSettings(settings);

    expect(serialized1).toBe(serialized2);
  });
});

describe('hasSettingsChanged', () => {
  it('returns true when previous is null', () => {
    const current: TrainingSettings = {
      ...DEFAULT_TRAINING_SETTINGS,
      charWpmMin: 25,
      charWpmMax: 25,
    };
    expect(hasSettingsChanged(current, null)).toBe(true);
  });

  it('returns false when settings are identical', () => {
    const settings: TrainingSettings = {
      ...DEFAULT_TRAINING_SETTINGS,
      charWpmMin: 20,
      charWpmMax: 20,
    };
    expect(hasSettingsChanged(settings, settings)).toBe(false);
  });

  it('returns true when settings differ', () => {
    const current: TrainingSettings = {
      ...DEFAULT_TRAINING_SETTINGS,
      charWpmMin: 25,
      charWpmMax: 25,
    };
    const previous: TrainingSettings = {
      ...DEFAULT_TRAINING_SETTINGS,
      charWpmMin: 20,
      charWpmMax: 20,
    };
    expect(hasSettingsChanged(current, previous)).toBe(true);
  });

  it('detects changes in nested properties', () => {
    const current: TrainingSettings = {
      ...DEFAULT_TRAINING_SETTINGS,
      customSet: ['A', 'B', 'C'],
    };
    const previous: TrainingSettings = {
      ...DEFAULT_TRAINING_SETTINGS,
      customSet: ['A', 'B'],
    };
    expect(hasSettingsChanged(current, previous)).toBe(true);
  });

  it('returns false for equivalent settings with different object references', () => {
    const current: TrainingSettings = {
      ...DEFAULT_TRAINING_SETTINGS,
      charWpmMin: 20,
      charWpmMax: 20,
    };
    const previous: TrainingSettings = {
      ...DEFAULT_TRAINING_SETTINGS,
      charWpmMin: 20,
      charWpmMax: 20,
    };
    expect(hasSettingsChanged(current, previous)).toBe(false);
  });
});
