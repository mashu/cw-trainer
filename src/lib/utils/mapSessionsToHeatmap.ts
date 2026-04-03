import { calculateTotalChars } from '@/lib/score';
import type { HeatmapSession, SessionResult } from '@/types';

export function mapSessionsToHeatmap(items: readonly SessionResult[]): readonly HeatmapSession[] {
  return items.map((session) => {
    const count = calculateTotalChars(session.groups || []);
    const durationMs =
      session.finishedAt && session.startedAt ? Math.max(0, session.finishedAt - session.startedAt) : undefined;
    const groupCount = Array.isArray(session.groups) ? session.groups.length : undefined;
    const accuracy =
      typeof session.accuracy === 'number' &&
      isFinite(session.accuracy) &&
      session.accuracy >= 0 &&
      session.accuracy <= 1
        ? session.accuracy
        : undefined;
    return {
      date: session.date,
      timestamp: session.timestamp,
      count,
      ...(durationMs !== undefined && durationMs > 0 ? { durationMs } : {}),
      ...(groupCount !== undefined && groupCount > 0 ? { groupCount } : {}),
      ...(accuracy !== undefined ? { accuracy } : {}),
    };
  });
}
