import { collection, deleteDoc, doc, getDocs, orderBy, query, setDoc } from 'firebase/firestore';
import type { SessionResult } from '@/types/session';
import { getDailyStats, getLetterStats } from '@/lib/stats';

export type FirebaseServicesLite = { db: any; auth: any } | null;

type PendingOps = { deletions: number[]; deletionIds?: Record<string, string>; needsFullSync?: boolean };

const localKeyForResults = (user: { email?: string } | null) => (user?.email ? `morse_results_${user.email}` : 'morse_results_local');
const localKeyForPending = (user: { email?: string } | null) => (user?.email ? `morse_pending_ops_${user.email}` : 'morse_pending_ops_local');

const readPendingOps = (user: { email?: string } | null): PendingOps => {
  try {
    const raw = localStorage.getItem(localKeyForPending(user));
    if (!raw) return { deletions: [], needsFullSync: false };
    const parsed = JSON.parse(raw);
    const deletions = Array.isArray(parsed?.deletions)
      ? (Array.from(new Set((parsed.deletions as any[]).filter((n: any) => typeof n === 'number'))) as number[])
      : [];
    const deletionIds: Record<string, string> = parsed && typeof parsed.deletionIds === 'object' && parsed.deletionIds !== null
      ? Object.keys(parsed.deletionIds).reduce((acc: Record<string, string>, k: string) => {
          const v = (parsed.deletionIds as Record<string, any>)[k];
          if (typeof v === 'string' && v) acc[k] = v;
          return acc;
        }, {})
      : {};
    const needsFullSync = !!parsed?.needsFullSync;
    return { deletions, deletionIds, needsFullSync };
  } catch {
    return { deletions: [], needsFullSync: false };
  }
};

const writePendingOps = (user: { email?: string } | null, ops: PendingOps) => {
  try {
    const dedupedDeletions = Array.from(new Set(ops.deletions)) as number[];
    const cleanedDeletionIds: Record<string, string> = {};
    Object.keys(ops.deletionIds || {}).forEach((k) => {
      const v = (ops.deletionIds as Record<string, string>)[k];
      if (typeof v === 'string' && v) cleanedDeletionIds[k] = v;
    });
    const toSave: PendingOps = { deletions: dedupedDeletions, deletionIds: cleanedDeletionIds, needsFullSync: !!ops.needsFullSync };
    if (toSave.deletions.length === 0 && Object.keys(toSave.deletionIds || {}).length === 0 && !toSave.needsFullSync) {
      try { localStorage.removeItem(localKeyForPending(user)); } catch {}
      return;
    }
    localStorage.setItem(localKeyForPending(user), JSON.stringify(toSave));
  } catch {}
};

export const normalizeSession = (raw: any, opts?: { docId?: string }): SessionResult => {
  const groupsArr = Array.isArray(raw?.groups) ? raw.groups : [];
  const groups = groupsArr.map((g: any) => {
    const sent = String(g?.sent || '').toUpperCase();
    const received = String(g?.received || '').toUpperCase();
    const correct = typeof g?.correct === 'boolean' ? g.correct : (sent.length > 0 && sent === received);
    return { sent, received, correct };
  });
  const groupTimings = (() => {
    if (Array.isArray(raw?.groupTimings)) {
      return raw.groupTimings.map((t: any) => ({ timeToCompleteMs: Math.max(0, Math.round(Number(t?.timeToCompleteMs) || 0)) }));
    }
    return groups.map(() => ({ timeToCompleteMs: 0 }));
  })();
  const safeAccuracy = (() => {
    if (typeof raw?.accuracy === 'number' && isFinite(raw.accuracy)) return raw.accuracy;
    const total = groups.length;
    return total > 0 ? groups.filter((g: any) => g.correct).length / total : 0;
  })();
  const letterAccuracy = (() => {
    if (raw?.letterAccuracy && typeof raw.letterAccuracy === 'object') return raw.letterAccuracy as Record<string, { correct: number; total: number }>;
    const acc: Record<string, { correct: number; total: number } & { }> = {} as any;
    groups.forEach((grp: any) => {
      for (let i = 0; i < grp.sent.length; i++) {
        const ch = grp.sent[i];
        if (!acc[ch]) acc[ch] = { correct: 0, total: 0 } as any;
        acc[ch].total += 1;
        if (grp.received[i] === ch) acc[ch].correct += 1;
      }
    });
    return acc as Record<string, { correct: number; total: number }>;
  })();
  const ts = typeof raw?.timestamp === 'number'
    ? raw.timestamp
    : (opts?.docId && /^\d+$/.test(opts.docId) ? Number(opts.docId) : Date.now());
  const date = raw?.date || new Date(ts).toISOString().split('T')[0];
  const startedAt = typeof raw?.startedAt === 'number' ? raw.startedAt : ts;
  const finishedAt = typeof raw?.finishedAt === 'number' ? raw.finishedAt : ts;
  return { date, timestamp: ts, startedAt, finishedAt, groups, groupTimings, accuracy: safeAccuracy, letterAccuracy, firestoreId: opts?.docId };
};

export async function loadSessions(services: FirebaseServicesLite, user: any): Promise<SessionResult[]> {
  let cloudLoaded: SessionResult[] | null = null;
  if (services && user && user.uid) {
    try {
      const sessionsSnap = await getDocs(query(collection(services.db, 'users', user.uid, 'sessions'), orderBy('timestamp', 'asc')));
      const loaded: SessionResult[] = [];
      sessionsSnap.forEach((d: any) => loaded.push(normalizeSession(d.data(), { docId: d.id })));
      cloudLoaded = loaded;
    } catch (e) {
      console.warn('Firestore unavailable or unauthorized, falling back to local storage.', e);
    }
  }
  if (cloudLoaded) {
    // Merge with any local-only entries
    let merged: SessionResult[] = cloudLoaded;
    try {
      const savedLocal = localStorage.getItem(localKeyForResults(user));
      if (savedLocal) {
        const parsed = JSON.parse(savedLocal);
        const localNorm = Array.isArray(parsed) ? parsed.map((s: any) => normalizeSession(s)) : [];
        const byTs: Record<number, SessionResult> = {};
        merged.forEach(s => { byTs[s.timestamp] = s; });
        localNorm.forEach(s => { if (!byTs[s.timestamp]) byTs[s.timestamp] = s; });
        merged = Object.values(byTs).sort((a, b) => a.timestamp - b.timestamp);
      }
    } catch {}
    await saveSessions(services, user, merged); // sync both stores
    await flushPendingOps(services, user, merged);
    return merged;
  }
  // local fallback
  try {
    const saved = localStorage.getItem(localKeyForResults(user));
    if (saved) {
      const parsed = JSON.parse(saved);
      const normalized = Array.isArray(parsed) ? parsed.map((s: any) => normalizeSession(s)) : [];
      await flushPendingOps(services, user, normalized);
      return normalized;
    }
  } catch {}
  return [];
}

export async function saveSessions(services: FirebaseServicesLite, user: any, results: SessionResult[]) {
  try {
    localStorage.setItem(localKeyForResults(user), JSON.stringify(results));
  } catch {}
  if (services && user && user.uid) {
    try {
      await Promise.all(results.map(r => {
        const payload = { ...r } as any;
        try { delete payload.firestoreId; } catch {}
        return setDoc(doc(services.db, 'users', user.uid, 'sessions', String(r.timestamp)), payload);
      }));
      const daily = getDailyStats(results as any);
      const letters = getLetterStats(results as any);
      await Promise.all([
        setDoc(doc(services.db, 'users', user.uid, 'stats', 'daily'), { items: daily, updatedAt: Date.now() }),
        setDoc(doc(services.db, 'users', user.uid, 'stats', 'letters'), { items: letters, updatedAt: Date.now() }),
      ]);
    } catch (e) {
      console.warn('Failed to write to Firestore; local copy saved.', e);
      const ops = readPendingOps(user);
      ops.needsFullSync = true;
      writePendingOps(user, ops);
    }
  }
}

export async function deleteSessionPersisted(services: FirebaseServicesLite, user: any, timestamp: number, currentResults: SessionResult[]) {
  const filtered = currentResults.filter(r => r.timestamp !== timestamp);
  try { localStorage.setItem(localKeyForResults(user), JSON.stringify(filtered)); } catch {}
  if (services && user && user.uid) {
    try {
      const toDelete = currentResults.find(r => r.timestamp === timestamp);
      const docId = (toDelete as any)?.firestoreId || String(timestamp);
      await deleteDoc(doc(services.db, 'users', user.uid, 'sessions', docId));
    } catch (e) {
      console.warn('Failed to delete from Firestore, will update local cache only.', e);
      const ops = readPendingOps(user);
      ops.deletions = [...(ops.deletions || []), timestamp];
      try {
        const toDelete = currentResults.find(r => r.timestamp === timestamp);
        const docId = (toDelete as any)?.firestoreId || String(timestamp);
        ops.deletionIds = { ...(ops.deletionIds || {}), [String(timestamp)]: docId };
      } catch {}
      writePendingOps(user, ops);
      await flushPendingOps(services, user, filtered);
    }
  }
  return filtered;
}

export async function flushPendingOps(services: FirebaseServicesLite, user: any, currentResults: SessionResult[]) {
  if (!(services && user && user.uid)) return;
  const ops = readPendingOps(user);
  if (!ops.needsFullSync && (ops.deletions || []).length === 0) return;
  try {
    if (ops.needsFullSync) {
      await Promise.all(currentResults.map(r => {
        const payload = { ...r } as any;
        try { delete payload.firestoreId; } catch {}
        return setDoc(doc(services.db, 'users', user.uid, 'sessions', String(r.timestamp)), payload);
      }));
    }
    if (ops.deletions && ops.deletions.length) {
      await Promise.all(ops.deletions.map(async (ts) => {
        try {
          const docId = (ops.deletionIds && ops.deletionIds[String(ts)]) || String(ts);
          await deleteDoc(doc(services.db, 'users', user.uid, 'sessions', docId));
          return { ts, ok: true };
        } catch {
          return { ts, ok: false };
        }
      })).then(results => {
        const remaining = results.filter(r => !r.ok).map(r => r.ts);
        ops.deletions = remaining;
        const successSet = new Set(results.filter(r => r.ok).map(r => String(r.ts)));
        if (ops.deletionIds) {
          Object.keys(ops.deletionIds).forEach((k) => { if (successSet.has(k)) delete ops.deletionIds![k]; });
        }
      });
    }
    const daily = getDailyStats(currentResults as any);
    const letters = getLetterStats(currentResults as any);
    await Promise.all([
      setDoc(doc(services.db, 'users', user.uid, 'stats', 'daily'), { items: daily, updatedAt: Date.now() }),
      setDoc(doc(services.db, 'users', user.uid, 'stats', 'letters'), { items: letters, updatedAt: Date.now() }),
    ]);
    ops.needsFullSync = false;
  } catch (e) {
    console.warn('Pending ops flush failed; will retry later.', e);
  } finally {
    writePendingOps(user, ops);
  }
}


