import { DEFAULT_TRAINING_SETTINGS } from '@/config/training.config';
import type {
  TrainingSettingsRepository,
  TrainingSettingsRepositoryContext,
} from '@/lib/db/repositories';
import { TrainingSettingsService } from '@/lib/services';
import { trainingSettingsSchema, type TrainingSettingsInput } from '@/lib/validators';
import type { TrainingSettings } from '@/types';

class InMemoryTrainingSettingsRepository implements TrainingSettingsRepository {
  private storage: Map<string, TrainingSettings> = new Map();

  async load(
    context: TrainingSettingsRepositoryContext,
    fallback: TrainingSettings,
  ): Promise<TrainingSettings> {
    const key = this.key(context);
    const stored = this.storage.get(key);
    return stored ?? fallback;
  }

  async save(
    context: TrainingSettingsRepositoryContext,
    settings: TrainingSettings,
  ): Promise<void> {
    this.storage.set(this.key(context), settings);
  }

  async clear(context: TrainingSettingsRepositoryContext): Promise<void> {
    this.storage.delete(this.key(context));
  }

  private key(context: TrainingSettingsRepositoryContext): string {
    return context.user?.id ?? 'anon';
  }
}

const buildValidSettingsInput = (): TrainingSettingsInput => ({
  kochLevel: 3,
  charSetMode: 'koch',
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
  autoAdjustThreshold: 85,
  autoAdjustBelowThresholdCount: 0,
  autoAdjustAboveThresholdCount: 0,
  echoAutoAdjustKoch: false,
  echoAutoAdjustThreshold: 90,
  echoAutoAdjustBelowThresholdCount: 0,
  echoAutoAdjustAboveThresholdCount: 0,
  errorWeightStrength: 0,
});

const context: TrainingSettingsRepositoryContext = {
  user: { id: 'user-123', email: 'user@example.com', provider: 'google' },
};

describe('TrainingSettingsService', () => {
  it('returns defaults when repository has no persisted value', async () => {
    const repo = new InMemoryTrainingSettingsRepository();
    const service = new TrainingSettingsService(repo);

    const settings = await service.getSettings(context);

    expect(settings).toEqual(DEFAULT_TRAINING_SETTINGS);
  });

  it('saves validated settings payload', async () => {
    const repo = new InMemoryTrainingSettingsRepository();
    const service = new TrainingSettingsService(repo);

    const input = buildValidSettingsInput();
    const expected = trainingSettingsSchema.parse(input);

    const saved = await service.saveSettings(context, input);
    const persisted = await service.getSettings(context);

    expect(saved).toEqual(expected);
    expect(persisted).toEqual(expected);
  });

  it('applies partial updates via patchSettings', async () => {
    const repo = new InMemoryTrainingSettingsRepository();
    const service = new TrainingSettingsService(repo);

    await service.saveSettings(context, buildValidSettingsInput());

    const patched = await service.patchSettings(context, { charWpmMin: 25, charWpmMax: 25, linkCharWpm: true });

    expect(patched.charWpmMin).toBe(25);
    expect(patched.linkCharWpm).toBe(true);
  });

  it('resets settings back to defaults', async () => {
    const repo = new InMemoryTrainingSettingsRepository();
    const service = new TrainingSettingsService(repo);

    await service.saveSettings(context, buildValidSettingsInput());

    const reset = await service.resetSettings(context);

    expect(reset).toEqual(DEFAULT_TRAINING_SETTINGS);
  });
});
