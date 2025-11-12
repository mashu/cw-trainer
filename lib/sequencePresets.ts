import { KOCH_SEQUENCE } from './morseConstants';

/**
 * CWops sequence - optimized for amateur radio operators
 * Based on the CW Operators' Club learning method
 * Note: Prosigns removed - only single characters are supported
 */
export const CWOPS_SEQUENCE: string[] = [
  'A', 'E', 'N', 'T', 'I', 'O', 'S', '1', '4', 'D', 'H', 'L', 'R', '2', '5',
  'C', 'U', 'M', 'W', '3', '6', '?', 'F', 'Y', ',', 'G', 'P', 'Q', '7', '9',
  '/', 'B', 'V', 'J', 'K', '0', '8', 'X', 'Z', '.'
];

/**
 * Farnsworth method - starts with common letters
 */
export const FARNSWORTH_SEQUENCE: string[] = [
  'E', 'T', 'A', 'I', 'N', 'O', 'S', 'H', 'R', 'D', 'L', 'U',
  'C', 'M', 'W', 'F', 'G', 'Y', 'P', 'B', 'V', 'K', 'J', 'X',
  'Q', 'Z', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  '/', '=', '+', '?'
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
 * Difficulty-based sequence - easiest to hardest
 */
export const DIFFICULTY_SEQUENCE: string[] = [
  'E', 'T', 'I', 'A', 'N', 'M', 'S', 'U', 'R', 'W', 'D', 'K',
  'G', 'O', 'H', 'V', 'F', 'L', 'P', 'J', 'B', 'X', 'C',
  'Y', 'Z', 'Q', '0', '1', '2', '3', '4', '5', '6', '7', '8',
  '9', '/', '=', '+', '?'
];

export interface SequencePreset {
  id: string;
  name: string;
  description: string;
  sequence: string[];
}

export const SEQUENCE_PRESETS: SequencePreset[] = [
  {
    id: 'koch',
    name: 'Koch',
    description: 'Classic Koch method sequence',
    sequence: KOCH_SEQUENCE,
  },
  {
    id: 'cwops',
    name: 'CWops',
    description: 'CW Operators\' Club sequence',
    sequence: CWOPS_SEQUENCE,
  },
  {
    id: 'farnsworth',
    name: 'Farnsworth',
    description: 'Farnsworth method - common letters first',
    sequence: FARNSWORTH_SEQUENCE,
  },
  {
    id: 'alphabetical',
    name: 'Alphabetical',
    description: 'Simple alphabetical order',
    sequence: ALPHABETICAL_SEQUENCE,
  },
  {
    id: 'difficulty',
    name: 'Difficulty',
    description: 'Easiest to hardest characters',
    sequence: DIFFICULTY_SEQUENCE,
  },
];

export function getPresetById(id: string): SequencePreset | undefined {
  return SEQUENCE_PRESETS.find((preset) => preset.id === id);
}

