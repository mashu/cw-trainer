import { DEFAULT_TRAINING_SETTINGS } from '@/config/training.config';
import type {
  TrainingSettingsRepository,
  TrainingSettingsRepositoryContext,
} from '@/lib/db/repositories';
import { TrainingSettingsService } from '@/lib/services';
import type { TrainingSettingsInput } from '@/lib/validators';
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
  autoAdjustKoch: true,
  autoAdjustThreshold: 85,
  autoAdjustBelowThresholdCount: 0,
  autoAdjustAboveThresholdCount: 0,
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

    const saved = await service.saveSettings(context, input);
    const persisted = await service.getSettings(context);

    expect(saved).toEqual(input);
    expect(persisted).toEqual(input);
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
