import { DEFAULT_TRAINING_SETTINGS } from '@/config/training.config';
import type {
  TrainingSettingsRepository,
  TrainingSettingsRepositoryContext,
} from '@/lib/db/repositories';
import { ValidationError } from '@/lib/errors';
import { hasSettingsChanged, normalizeTrainingSettings } from '@/lib/utils/training-settings';
import { trainingSettingsSchema, type TrainingSettingsInput } from '@/lib/validators';
import type { TrainingSettings } from '@/types';

export class TrainingSettingsService {
  constructor(
    private readonly repository: TrainingSettingsRepository,
    private readonly defaults: TrainingSettings = DEFAULT_TRAINING_SETTINGS,
  ) {}

  async getSettings(context: TrainingSettingsRepositoryContext): Promise<TrainingSettings> {
    return this.repository.load(context, this.defaults);
  }

  async saveSettings(
    context: TrainingSettingsRepositoryContext,
    input: TrainingSettingsInput,
  ): Promise<TrainingSettings> {
    const result = trainingSettingsSchema.safeParse(input);
    if (!result.success) {
      throw new ValidationError('Invalid training settings payload', result.error.flatten());
    }

    const validated = result.data;
    // Convert to domain type, conditionally including customSequence only when it has a value
    const { customSequence, ...restValidated } = validated;
    const domainSettings: TrainingSettings = {
      ...restValidated,
      customSet: validated.customSet ?? [],
      ...(customSequence && customSequence.length > 0
        ? { customSequence: customSequence as readonly string[] }
        : {}),
    };
    await this.repository.save(context, domainSettings);
    return domainSettings;
  }

  async patchSettings(
    context: TrainingSettingsRepositoryContext,
    patch: Partial<TrainingSettings>,
  ): Promise<TrainingSettings> {
    const current = await this.repository.load(context, this.defaults);
    const merged = normalizeTrainingSettings({ ...current, ...patch }, current);

    if (!hasSettingsChanged(merged, current)) {
      return current;
    }

    await this.repository.save(context, merged);
    return merged;
  }

  async resetSettings(context: TrainingSettingsRepositoryContext): Promise<TrainingSettings> {
    await this.repository.clear(context);
    await this.repository.save(context, this.defaults);
    return this.defaults;
  }
}
