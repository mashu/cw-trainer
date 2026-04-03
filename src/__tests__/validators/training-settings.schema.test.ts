import { trainingSettingsSchema } from '@/lib/validators';
import type { TrainingSettingsInput } from '@/lib/validators';

const buildValidSettings = (): TrainingSettingsInput => ({
  kochLevel: 5,
  charSetMode: 'koch' as const,
  digitsLevel: 10,
  mixedLettersPercent: 70,
  customSet: [],
  slidingWindowStart: 1,
  slidingWindowEnd: 40,
  sideToneMin: 600,
  sideToneMax: 700,
  volumeMin: 1,
  volumeMax: 1,
  linkVolume: true,
  steepness: 5,
  sessionDuration: 5,
  charsPerGroup: 5,
  numGroups: 5,
  charWpmMin: 20,
  charWpmMax: 20,
  linkCharWpm: true,
  effectiveWpmMin: 18,
  effectiveWpmMax: 18,
  linkEffectiveWpm: true,
  linkCharToEffective: false,
  echoKeyerMode: 'manual',
  extraWordSpaceMultiplier: 1,
  groupTimeout: 10,
  minGroupSize: 2,
  maxGroupSize: 5,
  linkGroupSize: false,
  envelopeSmoothing: 0.25,
  autoAdjustKoch: true,
  autoAdjustThreshold: 90,
  autoAdjustBelowThresholdCount: 0,
  autoAdjustAboveThresholdCount: 0,
  echoAutoAdjustKoch: false,
  echoAutoAdjustThreshold: 90,
  echoAutoAdjustBelowThresholdCount: 0,
  echoAutoAdjustAboveThresholdCount: 0,
  errorWeightStrength: 0,
});

describe('trainingSettingsSchema', () => {
  it('parses valid settings', () => {
    const result = trainingSettingsSchema.safeParse(buildValidSettings());

    expect(result.success).toBe(true);
  });

  it('defaults echoKeyerMode when omitted', () => {
    const result = trainingSettingsSchema.parse(buildValidSettings());

    expect(result.echoKeyerMode).toBe('manual');
  });

  it('defaults optional customSet when omitted', () => {
    const { customSet: _customSet, ...rest } = buildValidSettings();

    const result = trainingSettingsSchema.parse({ ...rest });

    expect(result.customSet).toEqual([]);
  });

  it('rejects when sideToneMax is less than sideToneMin', () => {
    const candidate = {
      ...buildValidSettings(),
      sideToneMin: 800,
      sideToneMax: 700,
    };

    const result = trainingSettingsSchema.safeParse(candidate);

    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((issue) => issue.message);
      expect(messages).toContain('sideToneMax must be greater than or equal to sideToneMin');
    }
  });

  it('rejects when maxGroupSize is less than minGroupSize', () => {
    const candidate = {
      ...buildValidSettings(),
      minGroupSize: 5,
      maxGroupSize: 3,
    };

    const result = trainingSettingsSchema.safeParse(candidate);

    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((issue) => issue.message);
      expect(messages).toContain('maxGroupSize must be greater than or equal to minGroupSize');
    }
  });
});
