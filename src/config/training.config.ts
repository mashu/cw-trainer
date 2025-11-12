import type { IcrSettings, TrainingSettings } from '@/types';

export const DEFAULT_TRAINING_SETTINGS: TrainingSettings = {
  kochLevel: 1, // Level 1 = 2 characters, Level 2 = 3 characters, etc.
  charSetMode: 'koch',
  digitsLevel: 10,
  customSet: [],
  sideToneMin: 600,
  sideToneMax: 600,
  steepness: 5,
  sessionDuration: 5,
  charsPerGroup: 5,
  numGroups: 5,
  charWpm: 20,
  effectiveWpm: 20,
  linkSpeeds: true,
  extraWordSpaceMultiplier: 1,
  groupTimeout: 10,
  minGroupSize: 2,
  maxGroupSize: 3,
  interactiveMode: false,
  envelopeSmoothing: 0,
  autoAdjustKoch: false,
  autoAdjustThreshold: 90,
};

export const DEFAULT_ICR_SETTINGS: IcrSettings = {
  trialsPerSession: 30,
  trialDelayMs: 700,
  vadEnabled: true,
  vadThreshold: 0.08,
  vadHoldMs: 60,
  bucketGreenMaxMs: 300,
  bucketYellowMaxMs: 800,
};
