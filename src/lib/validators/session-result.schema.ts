import { z } from 'zod';

import { trainingSettingsSchema } from './training-settings.schema';

const letterAccuracyEntrySchema = z.object({
  correct: z.number().int().min(0),
  total: z.number().int().min(1),
});

const sessionGroupSchema = z.object({
  sent: z.string().min(1),
  received: z.string(),
  correct: z.boolean(),
});

const sessionTimingSchema = z.object({
  timeToCompleteMs: z.number().min(0),
  perCharMs: z.number().min(0).optional(),
});

export const sessionResultSchema = z
  .object({
    date: z.string().min(1),
    timestamp: z.number().int().min(0),
    startedAt: z.number().int().min(0),
    finishedAt: z.number().int().min(0),
    groups: z.array(sessionGroupSchema).min(1),
    groupTimings: z.array(sessionTimingSchema).min(1),
    accuracy: z.number().min(0).max(1),
    letterAccuracy: z.record(letterAccuracyEntrySchema),
    alphabetSize: z.number().int().min(1),
    avgResponseMs: z.number().min(0),
    totalChars: z.number().int().min(0),
    effectiveAlphabetSize: z.number().min(0),
    score: z.number().min(0),
    firestoreId: z.string().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.groupTimings.length !== value.groups.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['groupTimings'],
        message: 'groupTimings length must match groups length',
      });
    }

    Object.entries(value.letterAccuracy).forEach(([character, stats]) => {
      if (stats.total < stats.correct) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['letterAccuracy', character],
          message: 'correct count cannot exceed total count',
        });
      }
    });
  });

export const sessionWithSettingsSchema = z.object({
  session: sessionResultSchema,
  settings: trainingSettingsSchema,
});

export type SessionResultInput = z.infer<typeof sessionResultSchema>;
export type SessionWithSettingsInput = z.infer<typeof sessionWithSettingsSchema>;
