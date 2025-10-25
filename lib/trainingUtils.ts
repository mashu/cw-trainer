import { KOCH_SEQUENCE } from './morseConstants';
import type { TrainingSettings } from '@/components/TrainingSettingsForm';

export interface TrainingSettingsLite {
  kochLevel: number;
  minGroupSize: number;
  maxGroupSize: number;
  // Optional character set controls (fallbacks maintain backward compatibility)
  charSetMode?: 'koch' | 'digits' | 'custom';
  digitsLevel?: number; // 1..10
  customSet?: string[]; // explicit pool when in custom mode
}

const DIGITS_ASC: string[] = ['0','1','2','3','4','5','6','7','8','9'];

export function computeCharPool(settings: Pick<TrainingSettings, 'kochLevel' | 'charSetMode' | 'digitsLevel' | 'customSet'>): string[] {
  const mode = (settings.charSetMode || 'koch');
  if (mode === 'digits') {
    const count = Math.max(1, Math.min(10, settings.digitsLevel || 10));
    return DIGITS_ASC.slice(0, count);
  }
  if (mode === 'custom') {
    const set = Array.isArray(settings.customSet) ? settings.customSet : [];
    const pool = Array.from(new Set(set.map((c) => (c || '').toString().trim().toUpperCase()).filter(Boolean)));
    if (pool.length > 0) return pool;
    // Fallback to Koch if empty custom set
  }
  const level = Math.max(1, Math.min(KOCH_SEQUENCE.length, settings.kochLevel || 1));
  return KOCH_SEQUENCE.slice(0, level);
}

export function generateGroup(settings: TrainingSettingsLite): string {
  const availableChars = computeCharPool({
    kochLevel: settings.kochLevel,
    charSetMode: settings.charSetMode as any,
    digitsLevel: settings.digitsLevel,
    customSet: settings.customSet,
  } as any);
  const groupSize = Math.floor(Math.random() * (settings.maxGroupSize - settings.minGroupSize + 1)) + settings.minGroupSize;
  let group = '';
  const safePool = Array.isArray(availableChars) && availableChars.length > 0 ? availableChars : KOCH_SEQUENCE.slice(0, Math.max(1, settings.kochLevel || 1));
  for (let i = 0; i < groupSize; i++) {
    group += safePool[Math.floor(Math.random() * safePool.length)];
  }
  return group;
}


