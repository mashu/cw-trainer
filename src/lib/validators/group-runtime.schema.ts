import { z } from 'zod';

const audioStatusSchema = z.enum(['idle', 'running', 'suspended', 'closed', 'failed']);

const groupSessionResultSummarySchema = z.object({
  accuracy: z.number(),
  groups: z.array(
    z.object({
      sent: z.string(),
      received: z.string(),
      correct: z.boolean(),
    }),
  ),
  avgResponseMs: z.number(),
  score: z.number(),
});

const idleRuntimeSchema = z.object({ status: z.literal('idle') });

const resultsRuntimeSchema = z.object({
  status: z.literal('results'),
  result: groupSessionResultSummarySchema,
});

/**
 * Active (in-progress) snapshot. `status` is an enum rather than a literal, so this lives
 * in a plain `z.union` (discriminated unions require literal discriminators).
 */
const activeRuntimeSchema = z.object({
  status: z.enum([
    'starting',
    'playingGroup',
    'waitingForAnswer',
    'paused',
    'completing',
    'failed',
  ]),
  sessionId: z.number(),
  startedAt: z.number(),
  groups: z.array(z.string()),
  userInput: z.array(z.string()),
  confirmedGroups: z.record(z.string(), z.boolean()),
  currentGroup: z.number(),
  currentFocusedGroup: z.number(),
  groupStartAt: z.array(z.number()),
  groupEndAt: z.array(z.number()),
  groupAnswerAt: z.array(z.number()),
  audioStatus: audioStatusSchema,
  pauseReason: z.string().optional(),
  errorMessage: z.string().optional(),
});

export const groupTrainingRuntimeSchema = z.union([
  idleRuntimeSchema,
  resultsRuntimeSchema,
  activeRuntimeSchema,
]);

export type GroupTrainingRuntimeInput = z.infer<typeof groupTrainingRuntimeSchema>;
