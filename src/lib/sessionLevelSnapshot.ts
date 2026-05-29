import type { CharacterSetMode, SessionResult, TrainingSettings } from '@/types';

/** Training levels captured when a group/echo/chase session is saved. */
export type SessionLevelSnapshot = {
  readonly kochLevel: number;
  readonly charSetMode: CharacterSetMode;
  readonly digitsLevel?: number;
};

export function sessionLevelSnapshotFromSettings(
  settings: Pick<TrainingSettings, 'kochLevel' | 'charSetMode' | 'digitsLevel'>,
): SessionLevelSnapshot {
  const charSetMode = settings.charSetMode ?? 'koch';
  return {
    kochLevel: settings.kochLevel,
    charSetMode,
    ...(charSetMode === 'digits' || charSetMode === 'mixed'
      ? { digitsLevel: settings.digitsLevel ?? 10 }
      : {}),
  };
}

type SessionLevelDisplayInput = Pick<
  SessionResult,
  'kochLevel' | 'digitsLevel' | 'charSetMode' | 'alphabetSize' | 'groups'
>;

/**
 * Human-readable level label for a saved session.
 * Prefers persisted snapshot fields; falls back to alphabetSize only for legacy Koch sessions.
 */
export function formatSessionLevelLabel(session: SessionLevelDisplayInput): string | null {
  const mode = session.charSetMode;
  const koch = session.kochLevel;
  const digits = session.digitsLevel;

  if (mode === 'mixed' && typeof koch === 'number' && typeof digits === 'number') {
    return `${koch} / ${digits}`;
  }
  if (mode === 'digits' && typeof digits === 'number') {
    return String(digits);
  }
  if (typeof koch === 'number' && (mode === 'koch' || mode === 'custom' || mode === undefined)) {
    return String(koch);
  }

  const hasSnapshot = typeof koch === 'number' || typeof digits === 'number' || mode !== undefined;
  if (hasSnapshot) {
    return null;
  }

  const sentHasDigit = session.groups.some((g) => /\d/.test(g.sent));
  const sentHasLetter = session.groups.some((g) => /[A-Z]/i.test(g.sent));
  if (sentHasDigit && sentHasLetter) {
    return null;
  }
  if (session.alphabetSize > 0) {
    return String(session.alphabetSize - 1);
  }
  return null;
}
