import { z } from 'zod';

import type { CharacterSetMode } from '@/types';

const KOCH_LEVEL_MIN = 1; // Level 1 = 2 characters, Level 2 = 3 characters, etc.
const KOCH_LEVEL_MAX = 40;
const DIGITS_LEVEL_MIN = 1;
const DIGITS_LEVEL_MAX = 10;
const WPM_MIN = 1;
const WORD_SPACE_MIN = 1;
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

const characterSetModeSchema = z.enum(['koch', 'digits', 'custom']);

export const trainingSettingsSchema = z
  .object({
    kochLevel: z.number().int().min(KOCH_LEVEL_MIN).max(KOCH_LEVEL_MAX),
    charSetMode: characterSetModeSchema as z.ZodType<CharacterSetMode>,
    digitsLevel: z.number().int().min(DIGITS_LEVEL_MIN).max(DIGITS_LEVEL_MAX),
    customSet: z.array(z.string().min(1)).max(64).optional().default([]),
    customSequence: z.array(z.string().min(1)).optional(),
    sideToneMin: z.number().int().min(TONE_MIN).max(TONE_MAX),
    sideToneMax: z.number().int().min(TONE_MIN).max(TONE_MAX),
    steepness: z.number().int().min(STEEPNESS_MIN).max(STEEPNESS_MAX),
    sessionDuration: z.number().int().positive(),
    charsPerGroup: z.number().int().min(GROUP_SIZE_MIN).max(GROUP_SIZE_MAX),
    numGroups: z.number().int().positive(),
    charWpm: z.number().min(WPM_MIN),
    effectiveWpm: z.number().min(WPM_MIN),
    linkSpeeds: z.boolean(),
    extraWordSpaceMultiplier: z.number().min(WORD_SPACE_MIN),
    groupTimeout: z.number().min(GROUP_TIMEOUT_MIN),
    minGroupSize: z.number().int().min(GROUP_SIZE_MIN).max(GROUP_SIZE_MAX),
    maxGroupSize: z.number().int().min(GROUP_SIZE_MIN).max(GROUP_SIZE_MAX),
    interactiveMode: z.boolean(),
    envelopeSmoothing: z.number().min(ENVELOPE_SMOOTHING_MIN).max(ENVELOPE_SMOOTHING_MAX),
    autoAdjustKoch: z.boolean(),
    autoAdjustThreshold: z.number().min(AUTO_THRESHOLD_MIN).max(AUTO_THRESHOLD_MAX),
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
  });

export type TrainingSettingsInput = z.infer<typeof trainingSettingsSchema>;
