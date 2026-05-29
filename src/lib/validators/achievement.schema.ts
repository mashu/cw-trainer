import { z } from 'zod';

const achievementIdSchema = z.enum([
  'first-session',
  'first-letter',
  'first-digit',
  'quarter-alphabet',
  'half-alphabet',
  'three-quarter-alphabet',
  'full-alphabet',
  'clean-copy',
  'ninety-club',
  'pressure-copy',
  'long-haul',
  'three-day-streak',
  'seven-day-streak',
  'comeback',
  'score-1000',
  'score-2500',
  'score-5000',
]);

export const unlockedAchievementSchema = z.object({
  id: achievementIdSchema,
  unlockedAt: z.number().int().nonnegative(),
  sourceSessionTimestamp: z.number().int().nonnegative().optional(),
});

export const achievementCollectionSchema = z.object({
  unlocked: z.array(unlockedAchievementSchema),
  updatedAt: z.number().int().nonnegative(),
});

export const publicAchievementBadgeSchema = z.object({
  id: achievementIdSchema,
  title: z.string().min(1),
  tier: z.string().min(1),
  rarity: z.string().min(1),
  unlockedAt: z.number().int().nonnegative(),
});

export const publicAchievementProfileSchema = z.object({
  publicId: z.number().int().nonnegative(),
  callSign: z.string().min(1).optional(),
  badgeCount: z.number().int().nonnegative(),
  featuredBadges: z.array(publicAchievementBadgeSchema),
  bestScore: z.number().nonnegative(),
  bestAccuracy: z.number().min(0).max(1),
  masteredCharacterCount: z.number().int().nonnegative(),
  totalKnownCharacterCount: z.number().int().positive(),
  practiceDays: z.number().int().nonnegative(),
  charWpmMin: z.number().min(1).optional(),
  charWpmMax: z.number().min(1).optional(),
  effectiveWpmMin: z.number().min(1).optional(),
  effectiveWpmMax: z.number().min(1).optional(),
  updatedAt: z.number().int().nonnegative(),
  shareEnabled: z.boolean(),
});

export type UnlockedAchievementInput = z.input<typeof unlockedAchievementSchema>;
export type AchievementCollectionInput = z.input<typeof achievementCollectionSchema>;
export type PublicAchievementProfileInput = z.input<typeof publicAchievementProfileSchema>;
