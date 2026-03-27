import { z } from 'zod';

import type { CharacterSetMode } from '@/types';

const KOCH_LEVEL_MIN = 1; // Level 1 = 2 characters, Level 2 = 3 characters, etc.
const KOCH_LEVEL_MAX = 40;
const DIGITS_LEVEL_MIN = 1;
const DIGITS_LEVEL_MAX = 10;
const WPM_MIN = 1;
const WORD_SPACE_MIN = 0.1;
const GROUP_SIZE_MIN = 1;
const GROUP_SIZE_MAX = 10;
const GROUP_TIMEOUT_MIN = 0;
const ENVELOPE_SMOOTHING_MIN = 0;
const ENVELOPE_SMOOTHING_MAX = 1;
const TONE_MIN = 100;
const TONE_MAX = 2000;
const STEEPNESS_MIN = 1;
const STEEPNESS_MAX = 100;
const AUTO_THRESHOLD_MIN = 0;
const AUTO_THRESHOLD_MAX = 100;
const AUTO_ADJUST_COUNT_MIN = 0;
const AUTO_ADJUST_COUNT_MAX = 20;
const SLIDING_WINDOW_INDEX_MIN = 1;
const SLIDING_WINDOW_INDEX_MAX = 40;
const MIXED_LETTERS_PERCENT_MIN = 0;
const MIXED_LETTERS_PERCENT_MAX = 100;
const VOLUME_MIN = 0.1;
const VOLUME_MAX = 1;

const characterSetModeSchema = z.enum(['koch', 'digits', 'custom', 'mixed']);
const echoKeyerModeSchema = z.enum(['manual', 'iambic-b']);

export const trainingSettingsSchema = z
  .object({
    kochLevel: z.number().int().min(KOCH_LEVEL_MIN).max(KOCH_LEVEL_MAX),
    charSetMode: characterSetModeSchema as z.ZodType<CharacterSetMode>,
    digitsLevel: z.number().int().min(DIGITS_LEVEL_MIN).max(DIGITS_LEVEL_MAX),
    mixedLettersPercent: z.number().int().min(MIXED_LETTERS_PERCENT_MIN).max(MIXED_LETTERS_PERCENT_MAX).optional().default(70),
    customSet: z.array(z.string().min(1)).max(64).optional().default([]),
    customSequence: z.array(z.string().min(1)).optional(),
    slidingWindowStart: z.number().int().min(SLIDING_WINDOW_INDEX_MIN).max(SLIDING_WINDOW_INDEX_MAX).optional().default(1),
    slidingWindowEnd: z.number().int().min(SLIDING_WINDOW_INDEX_MIN).max(SLIDING_WINDOW_INDEX_MAX).optional().default(40),
    sideToneMin: z.number().int().min(TONE_MIN).max(TONE_MAX),
    sideToneMax: z.number().int().min(TONE_MIN).max(TONE_MAX),
    volumeMin: z.number().min(VOLUME_MIN).max(VOLUME_MAX),
    volumeMax: z.number().min(VOLUME_MIN).max(VOLUME_MAX),
    linkVolume: z.boolean(),
    steepness: z.number().int().min(STEEPNESS_MIN).max(STEEPNESS_MAX),
    sessionDuration: z.number().int().positive(),
    charsPerGroup: z.number().int().min(GROUP_SIZE_MIN).max(GROUP_SIZE_MAX),
    numGroups: z.number().int().positive(),
    charWpmMin: z.number().min(WPM_MIN),
    charWpmMax: z.number().min(WPM_MIN),
    linkCharWpm: z.boolean(),
    effectiveWpmMin: z.number().min(WPM_MIN),
    effectiveWpmMax: z.number().min(WPM_MIN),
    linkEffectiveWpm: z.boolean(),
    linkCharToEffective: z.boolean(),
    echoKeyerMode: echoKeyerModeSchema.optional().default('manual'),
    extraWordSpaceMultiplier: z.number().min(WORD_SPACE_MIN),
    groupTimeout: z.number().min(GROUP_TIMEOUT_MIN),
    minGroupSize: z.number().int().min(GROUP_SIZE_MIN).max(GROUP_SIZE_MAX),
    maxGroupSize: z.number().int().min(GROUP_SIZE_MIN).max(GROUP_SIZE_MAX),
    linkGroupSize: z.boolean(),
    envelopeSmoothing: z.number().min(ENVELOPE_SMOOTHING_MIN).max(ENVELOPE_SMOOTHING_MAX),
    autoAdjustKoch: z.boolean(),
    autoAdjustThreshold: z.number().min(AUTO_THRESHOLD_MIN).max(AUTO_THRESHOLD_MAX),
    autoAdjustBelowThresholdCount: z.number().int().min(AUTO_ADJUST_COUNT_MIN).max(AUTO_ADJUST_COUNT_MAX).default(0),
    autoAdjustAboveThresholdCount: z.number().int().min(AUTO_ADJUST_COUNT_MIN).max(AUTO_ADJUST_COUNT_MAX).default(0),
    errorWeightStrength: z.number().min(0).max(5).default(0),
  })
  .superRefine((value, ctx) => {
    if (value.sideToneMax < value.sideToneMin) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sideToneMax'],
        message: 'sideToneMax must be greater than or equal to sideToneMin',
      });
    }

    if (value.maxGroupSize < value.minGroupSize) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['maxGroupSize'],
        message: 'maxGroupSize must be greater than or equal to minGroupSize',
      });
    }

    if (value.charWpmMax < value.charWpmMin) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['charWpmMax'],
        message: 'charWpmMax must be greater than or equal to charWpmMin',
      });
    }

    if (value.effectiveWpmMax < value.effectiveWpmMin) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['effectiveWpmMax'],
        message: 'effectiveWpmMax must be greater than or equal to effectiveWpmMin',
      });
    }

    const start = value.slidingWindowStart ?? 1;
    const end = value.slidingWindowEnd ?? 40;
    if (end < start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['slidingWindowEnd'],
        message: 'slidingWindowEnd must be greater than or equal to slidingWindowStart',
      });
    }

    if (value.volumeMax < value.volumeMin) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['volumeMax'],
        message: 'volumeMax must be greater than or equal to volumeMin',
      });
    }
  });

export type TrainingSettingsInput = z.infer<typeof trainingSettingsSchema>;
