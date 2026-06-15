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
  qsbEnabled: false,
  qsbDepth: 0.35,
  qsbRateHz: 0.12,
  qrnEnabled: false,
  qrnLevel: 0.25,
  qrmEnabled: false,
  qrmLevel: 0.2,
  qrmProfile: 'mixed',
  receiverBackgroundGain: 20,
  receiverBackgroundExcitationRate: 62,
  receiverBackgroundResonance: 66,
  receiverBackgroundDecay: 0.984,
  receiverBackgroundOffsetHz: 140,
  receiverBackgroundOffsetModDepthHz: 45,
  receiverBackgroundOffsetModRateHz: 0.32,
  autoAdjustKoch: true,
  autoAdjustThreshold: 90,
  autoAdjustBelowThresholdCount: 1,
  autoAdjustAboveThresholdCount: 1,
  echoAutoAdjustKoch: false,
  echoAutoAdjustThreshold: 90,
  echoAutoAdjustBelowThresholdCount: 1,
  echoAutoAdjustAboveThresholdCount: 1,
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

  it('defaults band condition settings when omitted', () => {
    const {
      qsbEnabled: _qsbEnabled,
      qsbDepth: _qsbDepth,
      qsbRateHz: _qsbRateHz,
      qrnEnabled: _qrnEnabled,
      qrnLevel: _qrnLevel,
      qrmEnabled: _qrmEnabled,
      qrmLevel: _qrmLevel,
      qrmProfile: _qrmProfile,
      receiverBackgroundGain: _receiverBackgroundGain,
      receiverBackgroundExcitationRate: _receiverBackgroundExcitationRate,
      receiverBackgroundResonance: _receiverBackgroundResonance,
      receiverBackgroundDecay: _receiverBackgroundDecay,
      receiverBackgroundOffsetHz: _receiverBackgroundOffsetHz,
      receiverBackgroundOffsetModDepthHz: _receiverBackgroundOffsetModDepthHz,
      receiverBackgroundOffsetModRateHz: _receiverBackgroundOffsetModRateHz,
      ...rest
    } = buildValidSettings();

    const result = trainingSettingsSchema.parse(rest);

    expect(result.qsbEnabled).toBe(true);
    expect(result.qsbDepth).toBe(0.35);
    expect(result.qsbRateHz).toBe(0.12);
    expect(result.qrnEnabled).toBe(true);
    expect(result.qrnLevel).toBe(0.25);
    expect(result.qrmEnabled).toBe(true);
    expect(result.qrmLevel).toBe(0.2);
    expect(result.qrmProfile).toBe('mixed');
    expect(result.receiverBackgroundGain).toBe(20);
    expect(result.receiverBackgroundExcitationRate).toBe(62);
    expect(result.receiverBackgroundResonance).toBe(66);
    expect(result.receiverBackgroundDecay).toBe(0.984);
    expect(result.receiverBackgroundOffsetHz).toBe(140);
    expect(result.receiverBackgroundOffsetModDepthHz).toBe(45);
    expect(result.receiverBackgroundOffsetModRateHz).toBe(0.32);
  });

  it('defaults Chase settings when omitted', () => {
    const result = trainingSettingsSchema.parse(buildValidSettings());

    expect(result.chaseLives).toBe(3);
    expect(result.chaseAutoLevelEnabled).toBe(true);
    expect(result.chaseGroupsPerLevel).toBe(5);
    expect(result.chaseStartFallMs).toBe(7200);
    expect(result.chaseMinFallMs).toBe(1800);
    expect(result.chaseLevelSpeedupMs).toBe(430);
    expect(result.chaseGroupSpeedupMs).toBe(28);
  });

  it('rejects invalid Chase settings', () => {
    const result = trainingSettingsSchema.safeParse({
      ...buildValidSettings(),
      chaseLives: 7,
      chaseStartFallMs: 1000,
      chaseMinFallMs: 2000,
    });

    expect(result.success).toBe(false);
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

  it('rejects invalid band condition ranges', () => {
    const result = trainingSettingsSchema.safeParse({
      ...buildValidSettings(),
      qsbDepth: 1.5,
      qrnLevel: -0.1,
      qsbRateHz: 2,
    });

    expect(result.success).toBe(false);
  });

  it('rejects auto-adjust settings when both directions are disabled', () => {
    const result = trainingSettingsSchema.safeParse({
      ...buildValidSettings(),
      autoAdjustAboveThresholdCount: 0,
      autoAdjustBelowThresholdCount: 0,
    });

    expect(result.success).toBe(false);
  });
});
