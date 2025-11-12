/**
 * Prosign utilities for handling special Morse code control characters
 * Prosigns are displayed as "AR", "BT", etc. but stored internally as "<AR>", "<BT>", etc.
 */

export const PROSIGNS: Record<string, string> = {
  'AR': '<AR>', // End of message
  'BT': '<BT>', // Break
  'BK': '<BK>', // Break
  'SK': '<SK>', // End of work
};

export const PROSIGN_REVERSE: Record<string, string> = {
  '<AR>': 'AR',
  '<BT>': 'BT',
  '<BK>': 'BK',
  '<SK>': 'SK',
};

/**
 * Check if a character is a prosign (in either format)
 */
export function isProsign(char: string): boolean {
  return char.startsWith('<') && char.endsWith('>') || PROSIGNS[char.toUpperCase()] !== undefined;
}

/**
 * Convert prosign from display format (AR) to storage format (<AR>)
 */
export function toProsignFormat(display: string): string {
  const upper = display.toUpperCase();
  return PROSIGNS[upper] || display;
}

/**
 * Convert prosign from storage format (<AR>) to display format (AR)
 */
export function fromProsignFormat(stored: string): string {
  return PROSIGN_REVERSE[stored] || stored;
}

/**
 * Normalize a character - converts prosigns to storage format
 */
export function normalizeProsign(char: string): string {
  if (char.startsWith('<') && char.endsWith('>')) {
    return char; // Already in storage format
  }
  return toProsignFormat(char);
}

/**
 * Get display text for a character (converts prosigns to display format)
 */
export function getDisplayText(char: string): string {
  return fromProsignFormat(char);
}

