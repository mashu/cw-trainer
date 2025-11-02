import { trainingSettingsSchema } from '@/lib/validators';
import type { TrainingSettingsInput } from '@/lib/validators';

const buildValidSettings = (): TrainingSettingsInput => ({
  kochLevel: 5,
  charSetMode: 'koch' as const,
  digitsLevel: 10,
  customSet: [],
  sideToneMin: 600,
  sideToneMax: 700,
  steepness: 5,
  sessionDuration: 5,
  charsPerGroup: 5,
  numGroups: 5,
  charWpm: 20,
  effectiveWpm: 18,
  linkSpeeds: false,
  extraWordSpaceMultiplier: 1,
  groupTimeout: 10,
  minGroupSize: 2,
  maxGroupSize: 5,
  interactiveMode: false,
  envelopeSmoothing: 0.25,
  autoAdjustKoch: true,
  autoAdjustThreshold: 90,
});

describe('trainingSettingsSchema', () => {
  it('parses valid settings', () => {
    const result = trainingSettingsSchema.safeParse(buildValidSettings());

    expect(result.success).toBe(true);
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
