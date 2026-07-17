/**
 * Local calendar date helpers.
 *
 * Session dates must reflect the user's local calendar day, not UTC.
 * Using `toISOString()` stamps sessions with the UTC date, which credits
 * evening practice (for users west of UTC) to the wrong day and breaks
 * daily streaks even when the user practiced on consecutive local days.
 */

/** Format a Date as YYYY-MM-DD in the local timezone. */
export function formatLocalDate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Local calendar date string for a millisecond timestamp. */
export function localDateForTimestamp(ts: number): string {
  const d = new Date(ts);
  if (!Number.isFinite(ts) || Number.isNaN(d.getTime())) return '1970-01-01';
  return formatLocalDate(d);
}
