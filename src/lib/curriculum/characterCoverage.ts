import type { SessionResult } from '@/types';

export interface CharacterCoverage {
  readonly coveredCharacters: readonly string[];
  readonly missingCharacters: readonly string[];
}

/** Characters actually transmitted in a saved session, normalized for comparison. */
export function sessionPracticedCharacters(session: SessionResult): readonly string[] {
  return session.groups.flatMap((group) => [...group.sent.toUpperCase()]);
}

/**
 * Reports coverage of a stage's characters from the transmitted groups in the
 * supplied sessions. Letter accuracy is intentionally not used as evidence.
 */
export function evaluateCharacterCoverage(
  sessions: readonly SessionResult[],
  requiredCharacters: readonly string[],
): CharacterCoverage {
  const practiced = new Set<string>();
  sessions.forEach((session) => {
    sessionPracticedCharacters(session).forEach((character) => practiced.add(character));
  });

  const coveredCharacters: string[] = [];
  const missingCharacters: string[] = [];
  requiredCharacters.forEach((character) => {
    const normalizedCharacter = character.toUpperCase();
    if (practiced.has(normalizedCharacter)) {
      coveredCharacters.push(character);
    } else {
      missingCharacters.push(character);
    }
  });

  return { coveredCharacters, missingCharacters };
}

export function hasCharacterCoverage(
  sessions: readonly SessionResult[],
  requiredCharacters: readonly string[],
): boolean {
  return evaluateCharacterCoverage(sessions, requiredCharacters).missingCharacters.length === 0;
}
