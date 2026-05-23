import type { TrainingMode } from '@/types';

const VALID_MODES: readonly TrainingMode[] = ['group', 'icr', 'echo', 'chase', 'player'];

/**
 * Reads `mode` from a URL query string (e.g. `window.location.search`).
 * Returns `undefined` if missing or not a known {@link TrainingMode}.
 */
export function trainingModeFromSearch(search: string): TrainingMode | undefined {
  const raw = new URLSearchParams(search).get('mode');
  if (!raw) {
    return undefined;
  }
  return (VALID_MODES as readonly string[]).includes(raw) ? (raw as TrainingMode) : undefined;
}
