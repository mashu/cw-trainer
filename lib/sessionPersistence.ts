/* eslint-disable @typescript-eslint/no-explicit-any */
import type { getAuth } from 'firebase/auth';
import { collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, setDoc, where } from 'firebase/firestore';
import type { getFirestore } from 'firebase/firestore';

import { calculateGroupLetterAccuracy } from '@/lib/groupAlignment';
import { calculateAlphabetSize, calculateEffectiveAlphabetSize, calculateTotalChars, computeAverageResponseMs, computeSessionScore, derivePublicIdFromUid } from '@/lib/score';
import { getDailyStats, getLetterStats } from '@/lib/stats';
import type { SessionResult } from '@/src/types/domain';

export type FirebaseServicesLite = { db: ReturnType<typeof getFirestore> | null; auth: ReturnType<typeof getAuth> | null } | null;

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

const writePendingOps = (user: { email?: string } | null, ops: PendingOps): void => {
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

export const normalizeSession = (raw: unknown, opts?: { docId?: string }): SessionResult => {
  const rawObj = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const groupsArr = Array.isArray(rawObj?.['groups']) ? rawObj['groups'] : [];
  const groups = groupsArr.map((g: unknown) => {
    const groupObj = g && typeof g === 'object' ? g as Record<string, unknown> : {};
    const sent = String(groupObj?.['sent'] || '').toUpperCase();
    const received = String(groupObj?.['received'] || '').toUpperCase();
    const correct = typeof groupObj?.['correct'] === 'boolean' ? groupObj['correct'] : (sent.length > 0 && sent === received);
    return { sent, received, correct };
  });
  const groupTimings = (() => {
    if (Array.isArray(rawObj['groupTimings'])) {
      return (rawObj['groupTimings'] as unknown[]).map((t: any) => ({ timeToCompleteMs: Math.max(0, Number(t?.timeToCompleteMs) || 0) }));
    }
    return groups.map(() => ({ timeToCompleteMs: 0 }));
  })();
  const safeAccuracy = (() => {
    if (typeof rawObj['accuracy'] === 'number' && isFinite(rawObj['accuracy'] as number)) return rawObj['accuracy'] as number;
    const total = groups.length;
    return total > 0 ? groups.filter((g: any) => g.correct).length / total : 0;
  })();
  const letterAccuracy = (() => {
    if (rawObj['letterAccuracy'] && typeof rawObj['letterAccuracy'] === 'object') return rawObj['letterAccuracy'] as Record<string, { correct: number; total: number }>;
    // Use group alignment for accurate letter-level accuracy calculation
    return calculateGroupLetterAccuracy(groups);
  })();
  const ts = typeof rawObj['timestamp'] === 'number'
    ? rawObj['timestamp'] as number
    : (opts?.docId && /^\d+$/.test(opts.docId) ? Number(opts.docId) : Date.now());
  const dateValue = rawObj['date'];
  const date: string = typeof dateValue === 'string' ? dateValue : (new Date(ts).toISOString().split('T')[0] ?? '1970-01-01');
  const startedAt = typeof rawObj['startedAt'] === 'number' ? rawObj['startedAt'] as number : ts;
  const finishedAt = typeof rawObj['finishedAt'] === 'number' ? rawObj['finishedAt'] as number : ts;
  const alphabetSize = (typeof rawObj['alphabetSize'] === 'number' && (rawObj['alphabetSize'] as number) > 0)
    ? Math.floor(rawObj['alphabetSize'] as number)
    : calculateAlphabetSize(groups);
  const effectiveAlphabetSize = (typeof rawObj['effectiveAlphabetSize'] === 'number' && (rawObj['effectiveAlphabetSize'] as number) > 0)
    ? Number(rawObj['effectiveAlphabetSize'])
    : calculateEffectiveAlphabetSize(groups, { applyMillerMadow: true });
  const totalChars = (typeof rawObj['totalChars'] === 'number' && (rawObj['totalChars'] as number) > 0)
    ? Math.floor(rawObj['totalChars'] as number)
    : calculateTotalChars(groups);
  const avgResponseMs = (typeof rawObj['avgResponseMs'] === 'number' && isFinite(rawObj['avgResponseMs'] as number) && (rawObj['avgResponseMs'] as number) > 0)
    ? Number(rawObj['avgResponseMs'])
    : computeAverageResponseMs(groupTimings);
  const score = (typeof rawObj['score'] === 'number' && isFinite(rawObj['score'] as number) && (rawObj['score'] as number) > 0)
    ? Math.round((rawObj['score'] as number) * 100) / 100
    : computeSessionScore({ effectiveAlphabetSize, alphabetSize, accuracy: safeAccuracy, avgResponseMs, totalChars });
  const result: SessionResult = { 
    date, 
    timestamp: ts, 
    startedAt, 
    finishedAt, 
    groups, 
    groupTimings, 
    accuracy: safeAccuracy, 
    letterAccuracy, 
    alphabetSize, 
    avgResponseMs, 
    totalChars, 
    effectiveAlphabetSize, 
    score,
    ...(opts?.docId !== undefined ? { firestoreId: opts.docId } : {})
  };
  return result;
};

async function ensurePublicId(services: FirebaseServicesLite, user: { uid: string } | null): Promise<number | null> {
  if (!(services && user && user.uid)) return null;
  try {
    const profileDocRef = doc(services.db, 'users', user.uid, 'meta', 'profile');
    const snap = await getDoc(profileDocRef);
    const current = snap.exists() ? (snap.data() as any) : null;
    const existing = (current && typeof current.publicId === 'number') ? current.publicId : null;
    if (existing) return existing;
    const derived = derivePublicIdFromUid(user.uid);
    await setDoc(profileDocRef, { publicId: derived, updatedAt: Date.now() }, { merge: true });
    return derived;
  } catch {
    // fallback to derived if Firestore not available
    if (user) {
      return derivePublicIdFromUid(user.uid);
    }
    return null;
  }
}

async function writeLeaderboardForSessions(
  services: FirebaseServicesLite,
  user: { uid: string } | null,
  results: SessionResult[]
): Promise<void> {
  if (!(services && user && user.uid)) return;
      const publicId = user?.uid ? await ensurePublicId(services, { uid: user.uid }) : null;
  const now = Date.now();
  await Promise.all(results.map(async (r) => {
    // Nest under user scope for rules friendliness; one doc per session timestamp
    const ref = doc(services.db, 'users', user.uid, 'leaderboard', String(r.timestamp));
    try {
      const ex = await getDoc(ref as any);
      if (ex.exists()) return; // immutable: do not overwrite
    } catch {}
    const alphabetSize = (typeof r.alphabetSize === 'number' && r.alphabetSize > 0) ? r.alphabetSize : calculateAlphabetSize(r.groups || []);
    const effectiveAlphabetSize = (typeof r.effectiveAlphabetSize === 'number' && r.effectiveAlphabetSize > 0)
      ? r.effectiveAlphabetSize
      : calculateEffectiveAlphabetSize(r.groups || [], { applyMillerMadow: true });
    const totalChars = (typeof r.totalChars === 'number' && r.totalChars > 0) ? r.totalChars : calculateTotalChars(r.groups || []);
    const avgResponseMs = (typeof r.avgResponseMs === 'number' && isFinite(r.avgResponseMs) && r.avgResponseMs > 0)
      ? r.avgResponseMs
      : computeAverageResponseMs(r.groupTimings || []);
    const score = (typeof r.score === 'number' && isFinite(r.score) && r.score > 0)
      ? r.score
      : computeSessionScore({ effectiveAlphabetSize, alphabetSize, accuracy: r.accuracy || 0, avgResponseMs, totalChars });
    const payload: any = {
      uid: user.uid,
      publicId: publicId,
      timestamp: r.timestamp,
      date: r.date,
      score,
      accuracy: r.accuracy,
      alphabetSize,
      effectiveAlphabetSize,
      totalChars,
      avgResponseMs,
      createdAt: now,
      version: 1
    };
    await setDoc(ref, payload, { merge: false });
  }));
}

export async function loadSessions(services: FirebaseServicesLite, user: { uid?: string; email?: string } | null): Promise<SessionResult[]> {
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
    let hasLocalOnlyEntries = false;
    try {
      const savedLocal = localStorage.getItem(localKeyForResults(user));
      if (savedLocal) {
        const parsed = JSON.parse(savedLocal);
        const localNorm = Array.isArray(parsed) ? parsed.map((s: any) => normalizeSession(s)) : [];
        const byTs: Record<number, SessionResult> = {};
        merged.forEach(s => { byTs[s.timestamp] = s; });
        localNorm.forEach(s => { 
          if (!byTs[s.timestamp]) {
            byTs[s.timestamp] = s;
            hasLocalOnlyEntries = true; // Found local-only entry that needs syncing
          }
        });
        merged = Object.values(byTs).sort((a, b) => a.timestamp - b.timestamp);
      }
    } catch {}
    
    // Only save to Firestore if there are local-only entries to sync, or if we need to update localStorage
    // This avoids unnecessary writes that can hit quota limits
    if (hasLocalOnlyEntries) {
      try {
        await saveSessions(services, user, merged); // sync local-only entries to cloud
      } catch (e) {
        // If save fails (e.g., quota exceeded), still update localStorage and continue
        console.warn('Failed to sync local sessions to Firestore; will retry later.', e);
        try {
          localStorage.setItem(localKeyForResults(user), JSON.stringify(merged));
        } catch {}
      }
    } else {
      // No local-only entries, just ensure localStorage is in sync
      try {
        localStorage.setItem(localKeyForResults(user), JSON.stringify(merged));
      } catch {}
    }
    
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

export async function saveSessions(services: FirebaseServicesLite, user: { uid?: string; email?: string } | null, results: SessionResult[]): Promise<void> {
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
      // Write immutable leaderboard entries (one per session). Skips existing docs.
      await writeLeaderboardForSessions(services, { uid: user.uid }, results);
    } catch (e: any) {
      // Handle quota errors gracefully - they're already logged by Firebase
      const isQuotaError = e?.code === 'resource-exhausted' || e?.message?.includes('quota') || e?.message?.includes('Quota');
      if (isQuotaError) {
        console.warn('Firestore quota exceeded; local copy saved. Will retry later via pending ops.', e);
      } else {
        console.warn('Failed to write to Firestore; local copy saved.', e);
      }
      const ops = readPendingOps(user);
      ops.needsFullSync = true;
      writePendingOps(user, ops);
    }
  }
}

export async function deleteSessionPersisted(services: FirebaseServicesLite, user: { uid?: string; email?: string } | null, timestamp: number, currentResults: SessionResult[]): Promise<SessionResult[]> {
  const filtered = currentResults.filter(r => r.timestamp !== timestamp);
  try { localStorage.setItem(localKeyForResults(user), JSON.stringify(filtered)); } catch {}
  if (services && user && user.uid) {
    try {
      let toDelete = currentResults.find(r => r.timestamp === timestamp);
      let docId = (toDelete as any)?.firestoreId || String(timestamp);
      
      // If session not found in memory, query Firebase directly by timestamp
      if (!toDelete) {
        try {
          const sessionsQuery = query(
            collection(services.db, 'users', user.uid, 'sessions'),
            where('timestamp', '==', timestamp)
          );
          const querySnapshot = await getDocs(sessionsQuery);
          if (!querySnapshot.empty) {
            const docSnapshot = querySnapshot.docs[0];
            docId = docSnapshot.id;
            toDelete = normalizeSession(docSnapshot.data(), { docId: docSnapshot.id });
          }
        } catch (queryError) {
          console.warn('Failed to query Firebase for session by timestamp', queryError);
        }
      }
      
      await deleteDoc(doc(services.db, 'users', user.uid, 'sessions', docId));
      // Delete matching leaderboard entry for consistency (per-session)
      try { await deleteDoc(doc(services.db, 'users', user.uid, 'leaderboard', String(timestamp))); } catch {}
    } catch (e) {
      console.warn('Failed to delete from Firestore, will update local cache only.', e);
      const ops = readPendingOps(user);
      ops.deletions = [...(ops.deletions || []), timestamp];
      try {
        let toDelete = currentResults.find(r => r.timestamp === timestamp);
        let docId = (toDelete as any)?.firestoreId || String(timestamp);
        
        // If session not found in memory, try to query Firebase for the docId
        if (!toDelete && services && user && user.uid) {
          try {
            const sessionsQuery = query(
              collection(services.db, 'users', user.uid, 'sessions'),
              where('timestamp', '==', timestamp)
            );
            const querySnapshot = await getDocs(sessionsQuery);
            if (!querySnapshot.empty) {
              docId = querySnapshot.docs[0].id;
            }
          } catch (queryError) {
            // Ignore query errors, fall back to String(timestamp)
          }
        }
        
        ops.deletionIds = { ...(ops.deletionIds || {}), [String(timestamp)]: docId };
      } catch {}
      writePendingOps(user, ops);
      await flushPendingOps(services, user, filtered);
    }
  }
  return filtered;
}

export async function flushPendingOps(services: FirebaseServicesLite, user: { uid?: string; email?: string } | null, currentResults: SessionResult[]): Promise<void> {
  if (!(services && user && user.uid)) return;
  const ops = readPendingOps(user);
  if (!ops.needsFullSync && (ops.deletions || []).length === 0) return;
  try {
    if (ops.needsFullSync) {
      await Promise.all(currentResults.map(r => {
        const payload = { ...r } as any;
        try { delete payload.firestoreId; } catch {}
        // Use firestoreId if available, otherwise fall back to String(timestamp)
        // This matches the logic used in deleteSessionPersisted and ensures consistency
        const docId = (r as any)?.firestoreId || String(r.timestamp);
        return setDoc(doc(services.db, 'users', user.uid, 'sessions', docId), payload);
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
    // Also ensure leaderboard entries exist for all sessions (idempotent; skips existing)
    if (user?.uid) {
      await writeLeaderboardForSessions(services, { uid: user.uid }, currentResults);
    }
    ops.needsFullSync = false;
  } catch (e) {
    console.warn('Pending ops flush failed; will retry later.', e);
  } finally {
    writePendingOps(user, ops);
  }
}


