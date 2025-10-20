import { KOCH_SEQUENCE } from './morseConstants';

export interface TrainingSettingsLite {
  kochLevel: number;
  minGroupSize: number;
  maxGroupSize: number;
}

export function generateGroup(settings: TrainingSettingsLite): string {
  const availableChars = KOCH_SEQUENCE.slice(0, settings.kochLevel);
  const groupSize = Math.floor(Math.random() * (settings.maxGroupSize - settings.minGroupSize + 1)) + settings.minGroupSize;
  let group = '';
  for (let i = 0; i < groupSize; i++) {
    group += availableChars[Math.floor(Math.random() * availableChars.length)];
  }
  return group;
}


