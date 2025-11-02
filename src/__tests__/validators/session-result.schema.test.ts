import {
  sessionResultSchema,
  sessionWithSettingsSchema,
  trainingSettingsSchema,
} from '@/lib/validators';
import type { SessionResultInput, SessionWithSettingsInput } from '@/lib/validators';

const buildValidSession = (): SessionResultInput => ({
  date: '2025-11-02',
  timestamp: 1730515200000,
  startedAt: 1730515140000,
  finishedAt: 1730515200000,
  groups: [
    { sent: 'ABC', received: 'ABC', correct: true },
    { sent: 'XYZ', received: 'XYY', correct: false },
  ],
  groupTimings: [
    { timeToCompleteMs: 1200, perCharMs: 400 },
    { timeToCompleteMs: 1500, perCharMs: 500 },
  ],
  accuracy: 0.5,
  letterAccuracy: {
    A: { correct: 1, total: 1 },
    B: { correct: 1, total: 1 },
    C: { correct: 1, total: 1 },
    X: { correct: 1, total: 1 },
    Y: { correct: 1, total: 2 },
    Z: { correct: 0, total: 1 },
  },
  alphabetSize: 6,
  avgResponseMs: 450,
  totalChars: 6,
  effectiveAlphabetSize: 5.6,
  score: 1234,
});

const validTrainingSettings = trainingSettingsSchema.parse({
  kochLevel: 5,
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
  autoAdjustThreshold: 90,
});

describe('sessionResultSchema', () => {
  it('validates a correct session payload', () => {
    const result = sessionResultSchema.safeParse(buildValidSession());

    expect(result.success).toBe(true);
  });

  it('rejects when groupTimings length does not match groups', () => {
    const candidate = {
      ...buildValidSession(),
      groupTimings: [{ timeToCompleteMs: 1200, perCharMs: 400 }],
    };

    const result = sessionResultSchema.safeParse(candidate);

    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((issue) => issue.message);
      expect(messages).toContain('groupTimings length must match groups length');
    }
  });

  it('rejects when letter accuracy exceeds total attempts', () => {
    const candidate = {
      ...buildValidSession(),
      letterAccuracy: {
        A: { correct: 2, total: 1 },
      },
    };

    const result = sessionResultSchema.safeParse(candidate);

    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((issue) => issue.message);
      expect(messages).toContain('correct count cannot exceed total count');
    }
  });
});

describe('sessionWithSettingsSchema', () => {
  it('validates combined session and settings payload', () => {
    const payload: SessionWithSettingsInput = {
      session: buildValidSession(),
      settings: validTrainingSettings,
    };

    const result = sessionWithSettingsSchema.safeParse(payload);

    expect(result.success).toBe(true);
  });
});
