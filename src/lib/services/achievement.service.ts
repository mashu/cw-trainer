import { buildPublicAchievementProfile, evaluateAchievements } from '@/lib/achievements';
import type {
  AchievementEvaluationResult,
  PublicAchievementProfile,
  UnlockedAchievement,
} from '@/lib/achievements';
import type {
  AchievementRepository,
  AchievementRepositoryContext,
} from '@/lib/db/repositories';
import { ValidationError } from '@/lib/errors';
import { unlockedAchievementSchema } from '@/lib/validators';
import type { SessionResult, TrainingSettings } from '@/types';

const wpmFromSettings = (
  settings: TrainingSettings,
): {
  readonly charWpmMin: number;
  readonly charWpmMax: number;
  readonly effectiveWpmMin: number;
  readonly effectiveWpmMax: number;
} => ({
  charWpmMin: settings.charWpmMin,
  charWpmMax: settings.charWpmMax,
  effectiveWpmMin: settings.effectiveWpmMin,
  effectiveWpmMax: settings.effectiveWpmMax,
});

export class AchievementService {
  constructor(private readonly repository: AchievementRepository) {}

  async listAchievements(context: AchievementRepositoryContext): Promise<UnlockedAchievement[]> {
    return this.repository.getAll(context);
  }

  async evaluateAndSave(
    context: AchievementRepositoryContext,
    sessions: readonly SessionResult[],
    settings: TrainingSettings,
    now = Date.now(),
  ): Promise<AchievementEvaluationResult> {
    const existing = await this.repository.getAll(context);
    const result = evaluateAchievements(sessions, existing, now);
    const parsed = result.unlocked.map((achievement) => {
      const validation = unlockedAchievementSchema.safeParse(achievement);
      if (!validation.success) {
        throw new ValidationError('Invalid achievement payload', validation.error.flatten());
      }
      return validation.data;
    });
    await this.repository.saveAll(context, parsed);
    await this.publishPublicProfile(context, sessions, parsed, settings, now).catch((error) => {
      console.warn('[AchievementService] Failed to publish public profile:', error);
    });
    return {
      ...result,
      unlocked: parsed,
      newlyUnlocked: result.newlyUnlocked,
    };
  }

  async publishPublicProfile(
    context: AchievementRepositoryContext,
    sessions: readonly SessionResult[],
    achievements: readonly UnlockedAchievement[],
    settings: TrainingSettings,
    now = Date.now(),
  ): Promise<PublicAchievementProfile | null> {
    const identity = await this.repository.getPublicIdentity(context);
    if (!identity) {
      return null;
    }
    const stored =
      achievements.length > 0 ? achievements : await this.repository.getAll(context);
    const evaluation = evaluateAchievements(sessions, stored, now);
    const profile = buildPublicAchievementProfile({
      publicId: identity.publicId,
      ...(identity.callSign ? { callSign: identity.callSign } : {}),
      unlocked: evaluation.unlocked,
      progress: evaluation.progress,
      wpm: wpmFromSettings(settings),
      now,
      shareEnabled: true,
    });
    await this.repository.publishPublicProfile(context, profile);
    return profile;
  }

  async getPublicProfile(publicId: number): Promise<PublicAchievementProfile | null> {
    return this.repository.getPublicProfile(publicId);
  }
}
