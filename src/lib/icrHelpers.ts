import { computeCharPool, type CharPoolSettingsInput } from '@/lib/trainingUtils';

/**
 * Pick a random character from the active pool.
 */
export const pickRandomChar = (opts: {
  kochLevel: number;
  charSetMode?: 'koch' | 'digits' | 'custom' | 'mixed';
  digitsLevel?: number;
  mixedLettersPercent?: number;
  customSet?: string[];
  customSequence?: string[];
  slidingWindowStart?: number;
  slidingWindowEnd?: number;
}): string => {
  const poolSettings: CharPoolSettingsInput = {
    kochLevel: opts.kochLevel,
    ...(opts.charSetMode !== undefined ? { charSetMode: opts.charSetMode } : { charSetMode: 'koch' }),
    ...(opts.digitsLevel !== undefined ? { digitsLevel: opts.digitsLevel } : {}),
    ...(opts.mixedLettersPercent !== undefined ? { mixedLettersPercent: opts.mixedLettersPercent } : {}),
    ...(opts.customSet !== undefined ? { customSet: opts.customSet } : {}),
    ...(opts.customSequence !== undefined ? { customSequence: opts.customSequence } : {}),
    ...(opts.slidingWindowStart !== undefined ? { slidingWindowStart: opts.slidingWindowStart } : {}),
    ...(opts.slidingWindowEnd !== undefined ? { slidingWindowEnd: opts.slidingWindowEnd } : {}),
  };
  const pool = computeCharPool(poolSettings);
  if (pool.length === 0) return 'E';
  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx] ?? 'E';
};

/**
 * Get the Tailwind text color class for a reaction time bucket.
 */
/**
 * Subtract speaker→mic calibration so stored reactions reflect perception, not peak arrival at the mic.
 */
export function calibratedReactionMs(
  rawMs: number,
  calibrationLatencyMs: number | null | undefined,
): number {
  const raw = Math.max(0, Math.round(rawMs));
  if (calibrationLatencyMs == null || calibrationLatencyMs <= 0) return raw;
  return Math.max(0, raw - Math.round(calibrationLatencyMs));
}

export const getReactionTextClass = (
  ms: number | undefined | null,
  buckets: { greenMax: number; yellowMax: number; orangeMax: number },
): string => {
  if (ms === undefined || ms === null) return 'text-slate-600';
  if (ms <= buckets.greenMax) return 'text-emerald-600 font-medium';
  if (ms <= buckets.yellowMax) return 'text-lime-600 font-medium';
  if (ms <= buckets.orangeMax) return 'text-orange-600 font-medium';
  return 'text-rose-600 font-medium';
};

/**
 * Get the fill color for a bar chart based on reaction time.
 */
export const getBarFill = (
  ms: number,
  buckets: { greenMax: number; yellowMax: number; orangeMax: number },
): string => {
  if (ms === undefined || ms === null) return '#60a5fa';
  if (ms <= buckets.greenMax) return '#10b981';
  if (ms <= buckets.yellowMax) return '#84cc16';
  if (ms <= buckets.orangeMax) return '#f97316';
  return '#ef4444';
};

/**
 * Format mic/audio error messages for user display.
 */
export function micErrorMessage(error: unknown): string {
  const name = error instanceof Error ? error.name : '';
  const msg = error instanceof Error ? error.message : String(error);
  if (name === 'NotAllowedError' || msg.includes('Permission') || msg.includes('denied')) {
    return 'Microphone access was denied or is blocked. Allow mic access for this site to use voice stop, or disable Voice in ICR settings.';
  }
  if (name === 'NotFoundError' || msg.includes('not found')) {
    return 'No microphone found. Connect a microphone or disable Voice in ICR settings.';
  }
  return 'Microphone or audio failed to start. Check permissions or disable Voice in ICR settings.';
}
