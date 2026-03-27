import { LCWO_SEQUENCE } from './morseConstants';

/**
 * Traditional Koch sequence (used by MorseMania and other trainers)
 * K, M, R, S, U, A, P, T, L, O, W, I, N, J, E, F, 0, Y, V, G, 5, Q, 9, Z, H, 3, 8, B, ?, 4, 2, 7, C, 1, 6, D, X, /, =, +
 */
export const TRADITIONAL_KOCH_SEQUENCE: string[] = [
  'K', 'M', 'R', 'S', 'U', 'A', 'P', 'T', 'L', 'O', 'W', 'I',
  'N', 'J', 'E', 'F', '0', 'Y', 'V', 'G', '5', 'Q', '9',
  'Z', 'H', '3', '8', 'B', '?', '4', '2', '7', 'C', '1',
  '6', 'D', 'X', '/', '=', '+'
];

/**
 * Alphabetical order - simple progression
 */
export const ALPHABETICAL_SEQUENCE: string[] = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L',
  'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X',
  'Y', 'Z', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  '/', '=', '+', '?'
];

/**
 * CW Academy sequence - based on English letter frequency
 * Groups: ETAONIRS, HDLUC, MWFYPGBV, KJXQZ
 */
export const CW_ACADEMY_SEQUENCE: string[] = [
  'E', 'T', 'A', 'O', 'N', 'I', 'R', 'S', // Group One
  'H', 'D', 'L', 'U', 'C', // Group Two
  'M', 'W', 'F', 'Y', 'P', 'G', 'B', 'V', // Group Three
  'K', 'J', 'X', 'Q', 'Z', // Group Four
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  '/', '=', '+', '?', '.', ','
];

export interface SequencePreset {
  id: string;
  name: string;
  description: string;
  sequence: string[];
}

export const SEQUENCE_PRESETS: SequencePreset[] = [
  {
    id: 'lcwo',
    name: 'LCWO',
    description: 'Learn CW Online sequence',
    sequence: LCWO_SEQUENCE,
  },
  {
    id: 'morsemania',
    name: 'MorseMania',
    description: 'Traditional Koch method sequence (used by MorseMania)',
    sequence: TRADITIONAL_KOCH_SEQUENCE,
  },
  {
    id: 'cw-academy',
    name: 'CW Academy',
    description: 'CW Academy beginner curriculum sequence',
    sequence: CW_ACADEMY_SEQUENCE,
  },
  {
    id: 'alphabetical',
    name: 'Alphabetical',
    description: 'Simple alphabetical order',
    sequence: ALPHABETICAL_SEQUENCE,
  },
];

export function getPresetById(id: string): SequencePreset | undefined {
  return SEQUENCE_PRESETS.find((preset) => preset.id === id);
}

