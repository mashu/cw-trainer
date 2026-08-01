// LCWO (Learn CW Online) sequence - matches the exact sequence used by LCWO.net
export const LCWO_SEQUENCE = ['K', 'M', 'U', 'R', 'E', 'S', 'N', 'A', 'P', 'T', 'L', 'W', 'I', 
  '.', 'J', 'Z', '=', 'F', 'O', 'Y', ',', 'V', 'G', '5', '/', 'Q', '9', '2', 'H', '3', '8', 'B', '?', '4', '7', 'C', '1', 'D', '6', '0', 'X'];

/** Level 1 unlocks the first two characters; each following level adds one. */
export const KOCH_LEVEL_MIN = 1;
/** Final level of the built-in LCWO curriculum. */
export const KOCH_LEVEL_MAX = LCWO_SEQUENCE.length - 1;
/** Default window spans the entire built-in LCWO sequence. */
export const DEFAULT_SLIDING_WINDOW_START = 1;
export const DEFAULT_SLIDING_WINDOW_END = LCWO_SEQUENCE.length;
export const SLIDING_WINDOW_INDEX_MAX = LCWO_SEQUENCE.length;

export const MORSE_CODE: Record<string, string> = {
  'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.', 'F': '..-.',
  'G': '--.', 'H': '....', 'I': '..', 'J': '.---', 'K': '-.-', 'L': '.-..',
  'M': '--', 'N': '-.', 'O': '---', 'P': '.--.', 'Q': '--.-', 'R': '.-.',
  'S': '...', 'T': '-', 'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-',
  'Y': '-.--', 'Z': '--..', '0': '-----', '1': '.----', '2': '..---',
  '3': '...--', '4': '....-', '5': '.....', '6': '-....', '7': '--...',
  '8': '---..', '9': '----.', '/': '-..-.', '=': '-...-', '+': '.-.-.',
  '?': '..--..', ',': '--..--', '.': '.-.-.-',
};


