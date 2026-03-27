import type { IcrSessionResult } from '@/types';

const STORAGE_KEY = 'cw_icr_sessions_v1';
const MAX_SESSIONS = 1000;

const readSessions = (): IcrSessionResult[] => {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as IcrSessionResult[]) : [];
  } catch {
    return [];
  }
};

const writeSessions = (sessions: IcrSessionResult[]): void => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // ignore writes that fail (quota, etc.)
  }
};

export class IcrSessionService {
  async listSessions(): Promise<IcrSessionResult[]> {
    return readSessions();
  }

  async saveSession(session: IcrSessionResult): Promise<IcrSessionResult[]> {
    const sessions = readSessions();
    const mergedMap = new Map<number, IcrSessionResult>();
    sessions.forEach((item) => {
      mergedMap.set(item.timestamp, item);
    });
    mergedMap.set(session.timestamp, session);

    const merged = Array.from(mergedMap.values()).sort((a, b) => a.timestamp - b.timestamp);
    const trimmed = merged.slice(-MAX_SESSIONS);
    writeSessions(trimmed);
    return trimmed;
  }

  async clearSessions(): Promise<void> {
    writeSessions([]);
  }

  async deleteSession(timestamp: number): Promise<IcrSessionResult[]> {
    const sessions = readSessions();
    const filtered = sessions.filter((s) => s.timestamp !== timestamp);
    writeSessions(filtered);
    return filtered;
  }
}


