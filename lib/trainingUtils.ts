import type { TrainingSettings } from '@/components/ui/forms/TrainingSettingsForm';

import { KOCH_SEQUENCE } from './morseConstants';

export interface TrainingSettingsLite {
  kochLevel: number;
  minGroupSize: number;
  maxGroupSize: number;
  // Optional character set controls (fallbacks maintain backward compatibility)
  charSetMode?: 'koch' | 'digits' | 'custom';
  digitsLevel?: number; // 1..10
  customSet?: string[]; // explicit pool when in custom mode
  customSequence?: string[]; // custom sequence order for Koch mode
}

const DIGITS_ASC: string[] = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

export function computeCharPool(
  settings: Pick<TrainingSettings, 'kochLevel' | 'charSetMode' | 'digitsLevel' | 'customSet' | 'customSequence'>,
): string[] {
  const mode = settings.charSetMode || 'koch';
  if (mode === 'digits') {
    const count = Math.max(1, Math.min(10, settings.digitsLevel || 10));
    return DIGITS_ASC.slice(0, count);
  }
  if (mode === 'custom') {
    const set = Array.isArray(settings.customSet) ? settings.customSet : [];
    const pool = Array.from(
      new Set(set.map((c) => (c || '').toString().trim().toUpperCase()).filter(Boolean)),
    );
    if (pool.length > 0) return pool;
    // Fallback to Koch if empty custom set
  }
  // Use custom sequence if available, otherwise fall back to KOCH_SEQUENCE
  const sequence = Array.isArray(settings.customSequence) && settings.customSequence.length > 0
    ? settings.customSequence
    : KOCH_SEQUENCE;
  // Level 1 = 2 characters, Level 2 = 3 characters, etc. (characters = level + 1)
  const level = settings.kochLevel || 1;
  const charCount = Math.min(level + 1, sequence.length);
  return sequence.slice(0, Math.max(2, charCount));
}

export function generateGroup(settings: TrainingSettingsLite): string {
  const poolSettings: Pick<TrainingSettings, 'kochLevel' | 'charSetMode' | 'digitsLevel' | 'customSet' | 'customSequence'> = {
    kochLevel: settings.kochLevel,
    ...(settings.charSetMode !== undefined ? { charSetMode: settings.charSetMode } : {}),
    ...(settings.digitsLevel !== undefined ? { digitsLevel: settings.digitsLevel } : {}),
    ...(settings.customSet !== undefined ? { customSet: settings.customSet } : {}),
    ...(settings.customSequence !== undefined ? { customSequence: settings.customSequence } : {}),
  };
  const availableChars = computeCharPool(poolSettings);
  const groupSize =
    Math.floor(Math.random() * (settings.maxGroupSize - settings.minGroupSize + 1)) +
    settings.minGroupSize;
  let group = '';
  const fallbackSequence = Array.isArray(settings.customSequence) && settings.customSequence.length > 0
    ? settings.customSequence
    : KOCH_SEQUENCE;
  // Level 1 = 2 characters, Level 2 = 3 characters, etc. (characters = level + 1)
  const charCount = Math.min((settings.kochLevel || 1) + 1, fallbackSequence.length);
  const safePool =
    Array.isArray(availableChars) && availableChars.length > 0
      ? availableChars
      : fallbackSequence.slice(0, charCount);
  for (let i = 0; i < groupSize; i++) {
    group += safePool[Math.floor(Math.random() * safePool.length)];
  }
  return group;
}
