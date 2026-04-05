import { MORSE_CODE } from './morseConstants';

export const MORSE_DOT_KEY = '[';
export const MORSE_DASH_KEY = ']';
export const MORSE_DOT_CODE = 'BracketLeft';
export const MORSE_DASH_CODE = 'BracketRight';
export const MORSE_DOT_ALT_CODE = 'ControlLeft';
export const MORSE_DASH_ALT_CODE = 'ControlRight';

export type MorseSignal = '.' | '-';

const MORSE_REVERSE = Object.entries(MORSE_CODE).reduce<Record<string, string>>(
  (acc, [character, pattern]) => {
    acc[pattern] = character;
    return acc;
  },
  {},
);

export function keyToMorseSignal(key: string): MorseSignal | null {
  if (key === MORSE_DOT_KEY) {
    return '.';
  }
  if (key === MORSE_DASH_KEY) {
    return '-';
  }
  return null;
}

export function keyboardInputToMorseSignal(input: {
  readonly key?: string;
  readonly code?: string;
}): MorseSignal | null {
  if (input.code === MORSE_DOT_CODE || input.code === MORSE_DOT_ALT_CODE) {
    return '.';
  }
  if (input.code === MORSE_DASH_CODE || input.code === MORSE_DASH_ALT_CODE) {
    return '-';
  }
  return keyToMorseSignal(input.key ?? '');
}

export function isMorsePrefix(expectedPattern: string, receivedPattern: string): boolean {
  return expectedPattern.startsWith(receivedPattern);
}

export function decodeMorsePattern(pattern: string): string | null {
  return MORSE_REVERSE[pattern] ?? null;
}

/** True if `pattern` is empty or matches the start of at least one character in {@link MORSE_CODE}. */
export function isMorseCodePrefix(pattern: string): boolean {
  if (pattern.length === 0) {
    return true;
  }
  for (const code of Object.values(MORSE_CODE)) {
    if (code.startsWith(pattern)) {
      return true;
    }
  }
  return false;
}
