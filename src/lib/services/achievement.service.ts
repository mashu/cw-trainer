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
import type { SessionResult } from '@/types';

export class AchievementService {
  constructor(private readonly repository: AchievementRepository) {}

  async listAchievements(context: AchievementRepositoryContext): Promise<UnlockedAchievement[]> {
    return this.repository.getAll(context);
  }

  async evaluateAndSave(
    context: AchievementRepositoryContext,
    sessions: readonly SessionResult[],
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
    await this.publishPublicProfile(context, sessions, parsed, now).catch((error) => {
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
    now = Date.now(),
  ): Promise<PublicAchievementProfile | null> {
    const identity = await this.repository.getPublicIdentity(context);
    if (!identity) {
      return null;
    }
    const progress = evaluateAchievements(sessions, achievements, now).progress;
    const profile = buildPublicAchievementProfile({
      publicId: identity.publicId,
      ...(identity.callSign ? { callSign: identity.callSign } : {}),
      unlocked: achievements,
      progress,
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
