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
  autoAdjustThreshold: 85,
});

const context: TrainingSettingsRepositoryContext = {
  firebase: undefined,
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

    const patched = await service.patchSettings(context, { charWpm: 25, linkSpeeds: true });

    expect(patched.charWpm).toBe(25);
    expect(patched.linkSpeeds).toBe(true);
  });

  it('resets settings back to defaults', async () => {
    const repo = new InMemoryTrainingSettingsRepository();
    const service = new TrainingSettingsService(repo);

    await service.saveSettings(context, buildValidSettingsInput());

    const reset = await service.resetSettings(context);

    expect(reset).toEqual(DEFAULT_TRAINING_SETTINGS);
  });
});
