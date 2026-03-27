import type { TrainingSettings } from '@/types';

export function pickTrainingToneHz(settings: Pick<TrainingSettings, 'sideToneMin' | 'sideToneMax'>): number {
  const min = Math.max(100, settings.sideToneMin);
  const max = Math.max(min, settings.sideToneMax);
  if (min === max) {
    return min;
  }
  return Math.floor(min + Math.random() * (max - min + 1));
}

export function computeTrainingGroupGapMs(
  settings: Pick<TrainingSettings, 'effectiveWpmMin' | 'charWpmMin' | 'extraWordSpaceMultiplier'>,
): number {
  const effectiveWpm = Math.max(1, settings.effectiveWpmMin || settings.charWpmMin || 20);
  const dotEffectiveSec = 1.2 / effectiveWpm;
  const wordSpaceSec =
    7 * dotEffectiveSec * Math.max(1, settings.extraWordSpaceMultiplier || 1);
  return Math.round(wordSpaceSec * 1000);
}
