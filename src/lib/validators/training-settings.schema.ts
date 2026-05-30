import { z } from 'zod';

import { EXTRA_SPACING_MULTIPLIER_MIN } from '@/lib/extraSpacing';
import type { CharacterSetMode } from '@/types';

const KOCH_LEVEL_MIN = 1; // Level 1 = 2 characters, Level 2 = 3 characters, etc.
const KOCH_LEVEL_MAX = 40;
const DIGITS_LEVEL_MIN = 1;
const DIGITS_LEVEL_MAX = 10;
const WPM_MIN = 1;
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
const CHASE_LIVES_MIN = 1;
const CHASE_LIVES_MAX = 6;
const CHASE_GROUPS_PER_LEVEL_MIN = 1;
const CHASE_GROUPS_PER_LEVEL_MAX = 50;
const CHASE_FALL_MS_MIN = 500;
const CHASE_FALL_MS_MAX = 60000;
const CHASE_SPEEDUP_MS_MIN = 0;
const CHASE_SPEEDUP_MS_MAX = 5000;
const SLIDING_WINDOW_INDEX_MIN = 1;
const SLIDING_WINDOW_INDEX_MAX = 40;
const MIXED_LETTERS_PERCENT_MIN = 0;
const MIXED_LETTERS_PERCENT_MAX = 100;
const VOLUME_MIN = 0.1;
const VOLUME_MAX = 1;
const AUDIO_REALISM_LEVEL_MIN = 0;
const AUDIO_REALISM_LEVEL_MAX = 1;
const QSB_RATE_MIN = 0.03;
const QSB_RATE_MAX = 1.5;
const RECEIVER_GAIN_MIN = 0;
const RECEIVER_GAIN_MAX = 20;
const RECEIVER_EXCITATION_RATE_MIN = 0.1;
const RECEIVER_EXCITATION_RATE_MAX = 500;
const RECEIVER_RESONANCE_MIN = 0.5;
const RECEIVER_RESONANCE_MAX = 240;
const RECEIVER_DECAY_MIN = 0.5;
const RECEIVER_DECAY_MAX = 0.9999;
const RECEIVER_OFFSET_MIN = -1000;
const RECEIVER_OFFSET_MAX = 1000;
const RECEIVER_OFFSET_MOD_DEPTH_MIN = 0;
const RECEIVER_OFFSET_MOD_DEPTH_MAX = 1000;
const RECEIVER_OFFSET_MOD_RATE_MIN = 0;
const RECEIVER_OFFSET_MOD_RATE_MAX = 20;
const PLAYER_REPEAT_COUNT_MIN = 1;
const PLAYER_REPEAT_COUNT_MAX = 10;
const PLAYER_DELAY_SECONDS_MIN = 0;
const PLAYER_DELAY_SECONDS_MAX = 60;

const characterSetModeSchema = z.enum(['koch', 'digits', 'custom', 'mixed']);
const echoKeyerModeSchema = z.enum(['manual', 'iambic-b']);
const qrmProfileSchema = z.enum(['whistle', 'ringing', 'mixed']);

export const trainingSettingsSchema = z
  .object({
    kochLevel: z.number().int().min(KOCH_LEVEL_MIN).max(KOCH_LEVEL_MAX),
    charSetMode: characterSetModeSchema as z.ZodType<CharacterSetMode>,
    digitsLevel: z.number().int().min(DIGITS_LEVEL_MIN).max(DIGITS_LEVEL_MAX),
    mixedLettersPercent: z
      .number()
      .int()
      .min(MIXED_LETTERS_PERCENT_MIN)
      .max(MIXED_LETTERS_PERCENT_MAX)
      .optional()
      .default(70),
    customSet: z.array(z.string().min(1)).max(64).optional().default([]),
    customSequence: z.array(z.string().min(1)).optional(),
    slidingWindowStart: z
      .number()
      .int()
      .min(SLIDING_WINDOW_INDEX_MIN)
      .max(SLIDING_WINDOW_INDEX_MAX)
      .optional()
      .default(1),
    slidingWindowEnd: z
      .number()
      .int()
      .min(SLIDING_WINDOW_INDEX_MIN)
      .max(SLIDING_WINDOW_INDEX_MAX)
      .optional()
      .default(40),
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
    extraWordSpaceMultiplier: z.number().min(EXTRA_SPACING_MULTIPLIER_MIN),
    groupTimeout: z.number().min(GROUP_TIMEOUT_MIN),
    lockInputDuringGroupPlayback: z.boolean().default(true),
    minGroupSize: z.number().int().min(GROUP_SIZE_MIN).max(GROUP_SIZE_MAX),
    maxGroupSize: z.number().int().min(GROUP_SIZE_MIN).max(GROUP_SIZE_MAX),
    linkGroupSize: z.boolean(),
    envelopeSmoothing: z.number().min(ENVELOPE_SMOOTHING_MIN).max(ENVELOPE_SMOOTHING_MAX),
    qsbEnabled: z.boolean().default(true),
    qsbDepth: z.number().min(AUDIO_REALISM_LEVEL_MIN).max(AUDIO_REALISM_LEVEL_MAX).default(0.35),
    qsbRateHz: z.number().min(QSB_RATE_MIN).max(QSB_RATE_MAX).default(0.12),
    qrnEnabled: z.boolean().default(true),
    qrnLevel: z.number().min(AUDIO_REALISM_LEVEL_MIN).max(AUDIO_REALISM_LEVEL_MAX).default(0.25),
    qrmEnabled: z.boolean().default(true),
    qrmLevel: z.number().min(AUDIO_REALISM_LEVEL_MIN).max(AUDIO_REALISM_LEVEL_MAX).default(0.2),
    qrmProfile: qrmProfileSchema.default('mixed'),
    receiverBackgroundGain: z.number().min(RECEIVER_GAIN_MIN).max(RECEIVER_GAIN_MAX).default(20),
    receiverBackgroundExcitationRate: z
      .number()
      .min(RECEIVER_EXCITATION_RATE_MIN)
      .max(RECEIVER_EXCITATION_RATE_MAX)
      .default(62),
    receiverBackgroundResonance: z
      .number()
      .min(RECEIVER_RESONANCE_MIN)
      .max(RECEIVER_RESONANCE_MAX)
      .default(66),
    receiverBackgroundDecay: z
      .number()
      .min(RECEIVER_DECAY_MIN)
      .max(RECEIVER_DECAY_MAX)
      .default(0.984),
    receiverBackgroundOffsetHz: z
      .number()
      .min(RECEIVER_OFFSET_MIN)
      .max(RECEIVER_OFFSET_MAX)
      .default(140),
    receiverBackgroundOffsetModDepthHz: z
      .number()
      .min(RECEIVER_OFFSET_MOD_DEPTH_MIN)
      .max(RECEIVER_OFFSET_MOD_DEPTH_MAX)
      .default(45),
    receiverBackgroundOffsetModRateHz: z
      .number()
      .min(RECEIVER_OFFSET_MOD_RATE_MIN)
      .max(RECEIVER_OFFSET_MOD_RATE_MAX)
      .default(0.32),
    autoAdjustKoch: z.boolean(),
    autoAdjustThreshold: z.number().min(AUTO_THRESHOLD_MIN).max(AUTO_THRESHOLD_MAX),
    autoAdjustBelowThresholdCount: z
      .number()
      .int()
      .min(AUTO_ADJUST_COUNT_MIN)
      .max(AUTO_ADJUST_COUNT_MAX)
      .default(1),
    autoAdjustAboveThresholdCount: z
      .number()
      .int()
      .min(AUTO_ADJUST_COUNT_MIN)
      .max(AUTO_ADJUST_COUNT_MAX)
      .default(5),
    echoAutoAdjustKoch: z.boolean().default(true),
    echoAutoAdjustThreshold: z.number().min(AUTO_THRESHOLD_MIN).max(AUTO_THRESHOLD_MAX).default(90),
    echoAutoAdjustBelowThresholdCount: z
      .number()
      .int()
      .min(AUTO_ADJUST_COUNT_MIN)
      .max(AUTO_ADJUST_COUNT_MAX)
      .default(1),
    echoAutoAdjustAboveThresholdCount: z
      .number()
      .int()
      .min(AUTO_ADJUST_COUNT_MIN)
      .max(AUTO_ADJUST_COUNT_MAX)
      .default(5),
    chaseLives: z.number().int().min(CHASE_LIVES_MIN).max(CHASE_LIVES_MAX).default(3),
    chaseAutoLevelEnabled: z.boolean().default(true),
    chaseGroupsPerLevel: z
      .number()
      .int()
      .min(CHASE_GROUPS_PER_LEVEL_MIN)
      .max(CHASE_GROUPS_PER_LEVEL_MAX)
      .default(5),
    chaseStartFallMs: z.number().int().min(CHASE_FALL_MS_MIN).max(CHASE_FALL_MS_MAX).default(7200),
    chaseMinFallMs: z.number().int().min(CHASE_FALL_MS_MIN).max(CHASE_FALL_MS_MAX).default(1800),
    chaseLevelSpeedupMs: z
      .number()
      .int()
      .min(CHASE_SPEEDUP_MS_MIN)
      .max(CHASE_SPEEDUP_MS_MAX)
      .default(430),
    chaseGroupSpeedupMs: z
      .number()
      .int()
      .min(CHASE_SPEEDUP_MS_MIN)
      .max(CHASE_SPEEDUP_MS_MAX)
      .default(28),
    errorWeightStrength: z.number().min(0).max(5).default(3),
    playerAnnounceLetters: z.boolean().default(false),
    playerLetterRepeatCount: z
      .number()
      .int()
      .min(PLAYER_REPEAT_COUNT_MIN)
      .max(PLAYER_REPEAT_COUNT_MAX)
      .default(1),
    playerRandomizeLetters: z.boolean().default(false),
    playerDelaySeconds: z
      .number()
      .min(PLAYER_DELAY_SECONDS_MIN)
      .max(PLAYER_DELAY_SECONDS_MAX)
      .default(2),
    playerSpeechVoiceURI: z.string().default(''),
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

    if (value.chaseStartFallMs < value.chaseMinFallMs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['chaseStartFallMs'],
        message: 'chaseStartFallMs must be greater than or equal to chaseMinFallMs',
      });
    }
  });

export type TrainingSettingsInput = z.input<typeof trainingSettingsSchema>;
