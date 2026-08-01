'use client';

import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import React, { useEffect, useMemo, useState } from 'react';

import { useHasMounted } from '@/hooks/useHasMounted';
import { initFirebase } from '@/lib/firebaseClient';
import { DEFAULT_SCORE_CONSTANTS } from '@/lib/score';

type LeaderboardEntry = {
  publicId: number;
  callSign?: string;
  score: number;
  timestamp: number;
  date?: string;
  accuracy?: number;
  alphabetSize?: number;
  avgResponseMs?: number;
  effectiveAlphabetSize?: number;
  totalChars?: number;
};

type LeaderboardDoc = {
  uid?: string;
  publicId?: number;
  callSign?: string;
  score?: number;
  timestamp?: number;
  date?: string;
  accuracy?: number;
  alphabetSize?: number;
  avgResponseMs?: number;
  effectiveAlphabetSize?: number;
  totalChars?: number;
};

const formatPublicId = (n: number): string => String(n).padStart(6, '0');

export type LeaderboardPeriod = 'all' | 'week';

/** Monday of the current week (local time) as YYYY-MM-DD, matching session date format. */
function currentWeekStartDate(now = new Date()): string {
  const day = now.getDay(); // 0 = Sunday
  const daysSinceMonday = (day + 6) % 7;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceMonday);
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, '0');
  const d = String(monday.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function Leaderboard({ limitCount = 20 }: { limitCount?: number }): JSX.Element {
  const [items, setItems] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [period, setPeriod] = useState<LeaderboardPeriod>('all');
  const hasMounted = useHasMounted();

  useEffect(() => {
    const services = initFirebase();
    if (!services || !services.db) {
      return;
    }

    let cancelled = false;

    const load = async (): Promise<void> => {
      setLoading(true);
      setError(null);
      setHint(null);

      try {
        const rows: LeaderboardEntry[] = [];
        const limitN = Math.max(1, Math.min(100, limitCount));
        // Entries are one-per-session, but the board shows one row per operator.
        // Over-fetch so that after per-user dedupe we can still fill limitN rows
        // even when one prolific user holds many of the top session scores.
        // 3x balances board fill against per-view read cost.
        const fetchLimit = Math.min(200, limitN * 3);
        let lastErrorCode: string | null = null;

        const attempt = async (makeQuery: () => ReturnType<typeof query>): Promise<boolean> => {
          const q = makeQuery();
          try {
            const snap = await getDocs(q);
            rows.length = 0;
            
            // Collect all UIDs to look up call-signs in batch
            const uidSet = new Set<string>();
            const tempEntries: Array<{ data: LeaderboardDoc; entry: Partial<LeaderboardEntry> }> = [];
            
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            snap.forEach((document: any) => {
              const data = document.data() as LeaderboardDoc;
              if (typeof data.score !== 'number' || typeof data.publicId !== 'number') {
                return;
              }

              // Collect UID for call-sign lookup
              if (data.uid && typeof data.uid === 'string') {
                uidSet.add(data.uid);
              }

              // Use call-sign from entry as fallback (for backwards compatibility)
              const entryCallSign = typeof data.callSign === 'string' && data.callSign.length > 0 ? data.callSign : undefined;

              const entry: Partial<LeaderboardEntry> = {
                publicId: data.publicId,
                ...(entryCallSign ? { callSign: entryCallSign } : {}),
                score: Math.round(data.score * 100) / 100,
                timestamp: typeof data.timestamp === 'number' ? data.timestamp : 0,
                ...(typeof data.date === 'string' ? { date: data.date } : {}),
                ...(typeof data.accuracy === 'number' ? { accuracy: data.accuracy } : {}),
                ...(typeof data.alphabetSize === 'number' ? { alphabetSize: data.alphabetSize } : {}),
                ...(typeof data.avgResponseMs === 'number' ? { avgResponseMs: data.avgResponseMs } : {}),
                ...(typeof data.effectiveAlphabetSize === 'number'
                  ? { effectiveAlphabetSize: data.effectiveAlphabetSize }
                  : {}),
                ...(typeof data.totalChars === 'number' ? { totalChars: data.totalChars } : {}),
              };
              tempEntries.push({ data, entry });
            });

            // One row per operator: keep each user's best-scoring session so a
            // single prolific user cannot fill the whole board.
            const bestByUser = new Map<string, { data: LeaderboardDoc; entry: Partial<LeaderboardEntry> }>();
            tempEntries.forEach((item) => {
              const key =
                typeof item.data.uid === 'string' && item.data.uid.length > 0
                  ? item.data.uid
                  : `pid:${item.data.publicId}`;
              const current = bestByUser.get(key);
              if (!current || (item.entry.score ?? 0) > (current.entry.score ?? 0)) {
                bestByUser.set(key, item);
              }
            });
            tempEntries.length = 0;
            [...bestByUser.values()]
              .sort((a, b) => (b.entry.score ?? 0) - (a.entry.score ?? 0))
              .slice(0, limitN)
              .forEach((item) => tempEntries.push(item));
            uidSet.clear();
            tempEntries.forEach(({ data }) => {
              if (data.uid && typeof data.uid === 'string') uidSet.add(data.uid);
            });

            // Look up call-signs from user profiles (current/latest call-sign)
            const callSignMap = new Map<string, string | null>();
            if (uidSet.size > 0 && services.db) {
              await Promise.all(
                Array.from(uidSet).map(async (uid) => {
                  try {
                    const profileRef = doc(services.db, 'users', uid, 'meta', 'profile');
                    const profileSnap = await getDoc(profileRef);
                    if (profileSnap.exists()) {
                      const profileData = profileSnap.data() as { callSign?: string } | undefined;
                      const callSign = typeof profileData?.callSign === 'string' && profileData.callSign.length > 0
                        ? profileData.callSign.trim()
                        : null;
                      callSignMap.set(uid, callSign);
                    } else {
                      callSignMap.set(uid, null);
                    }
                  } catch (_e) {
                    // If we can't read the profile, use null (will fall back to entry's call-sign if available)
                    callSignMap.set(uid, null);
                  }
                })
              );
            }

            // Build final entries with call-signs from profiles (preferred) or entries (fallback)
            tempEntries.forEach(({ data, entry }) => {
              let finalCallSign: string | undefined = undefined;
              if (data.uid && typeof data.uid === 'string') {
                const profileCallSign = callSignMap.get(data.uid);
                // Prefer call-sign from profile (current), fall back to entry's call-sign (for old entries)
                finalCallSign = profileCallSign || entry.callSign;
              } else {
                // No UID, use entry's call-sign if available
                finalCallSign = entry.callSign;
              }

              const finalEntry: LeaderboardEntry = {
                ...entry,
                publicId: entry.publicId!,
                score: entry.score!,
                timestamp: entry.timestamp!,
                ...(finalCallSign ? { callSign: finalCallSign } : {}),
              } as LeaderboardEntry;
              rows.push(finalEntry);
            });

            return true;
          } catch (error) {
            const typedError = error as { code?: string } | null;
            lastErrorCode = typedError?.code ?? null;
            return false;
          }
        };

        let ok = false;
        if (period === 'week') {
          // Weekly board: filter by date, sort client-side (a range filter and a
          // different orderBy field can't be combined without a composite
          // collection-group index). Entries are pre-sorted and deduped in
          // attempt(), so fetching by date is enough.
          const weekStart = currentWeekStartDate();
          try {
            ok = await attempt(() =>
              query(
                collectionGroup(services.db, 'leaderboard'),
                where('date', '>=', weekStart),
                limit(Math.max(fetchLimit, 200)),
              ),
            );
          } catch (_error) {
            ok = false;
          }
          if (!ok && services.auth?.currentUser?.uid) {
            const uid = services.auth.currentUser.uid;
            try {
              ok = await attempt(() =>
                query(
                  collection(services.db, 'users', uid, 'leaderboard'),
                  where('date', '>=', weekStart),
                  limit(Math.max(fetchLimit, 200)),
                ),
              );
              if (ok) setHint('Weekly board is limited to your own sessions right now.');
            } catch (_error) {
              ok = false;
            }
          }
          if (!ok) {
            setHint('Weekly leaderboard unavailable (may need a Firestore index).');
            setItems([]);
            return;
          }
          setItems(rows.sort((a, b) => b.score - a.score));
          return;
        }
        // Try global leaderboard first (collectionGroup)
        try {
          ok = await attempt(() =>
            query(
              collectionGroup(services.db, 'leaderboard'),
              orderBy('score', 'desc'),
              limit(fetchLimit),
            ),
          );
        } catch (_error) {
          ok = false;
        }

        // Fallback to top-level leaderboard collection
        if (!ok) {
          try {
            ok = await attempt(() =>
              query(
                collection(services.db, 'leaderboard'),
                orderBy('score', 'desc'),
                limit(fetchLimit),
              ),
            );
          } catch (_error) {
            ok = false;
          }
        }

        // Final fallback to user's personal leaderboard
        if (!ok && services.auth?.currentUser?.uid) {
          const uid = services.auth.currentUser.uid;
          try {
            ok = await attempt(() =>
              query(
                collection(services.db, 'users', uid, 'leaderboard'),
                orderBy('score', 'desc'),
                limit(fetchLimit),
              ),
            );
          } catch (_error) {
            ok = false;
          }
        }

        if (cancelled) {
          return;
        }

        if (!ok) {
          if (lastErrorCode) {
            setHint(`Leaderboard unavailable (${lastErrorCode}).`);
            setItems([]);
          } else {
            setError('Unable to load leaderboard');
          }
          return;
        }

        setItems(rows.sort((a, b) => b.score - a.score));
        // Don't show hint - personal leaderboard is a valid data source
        // If global leaderboard isn't accessible due to security rules, that's fine
        setHint(null);
      } catch (error) {
        if (!cancelled) {
          console.error(error);
          setError('Unexpected error while loading leaderboard');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return (): void => {
      cancelled = true;
    };
  }, [limitCount, refreshKey, period]);

  // Auto-refresh every 30 seconds to pick up call-sign updates
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshKey((prev) => prev + 1);
    }, 30000); // Refresh every 30 seconds

    return (): void => clearInterval(interval);
  }, []);

  const top = useMemo(() => items.slice(0, limitCount), [items, limitCount]);

  const { alpha, beta, gamma, delta, K } = DEFAULT_SCORE_CONSTANTS;
  const htmlMain = useMemo(() => {
    const f = `S = C^{${delta}}\cdot N_{\\mathrm{eff}}^{${alpha}}\cdot A^{${beta}}\cdot\\left( \\frac{${K}}{t_{\\mathrm{avg}}} \\right)^{${gamma}}`;
    return katex.renderToString(f, { throwOnError: false, displayMode: true });
  }, [alpha, beta, gamma, delta, K]);
  const htmlH = useMemo(
    () =>
      katex.renderToString('H = -\\sum_{i=1}^{M} p_i \\ln p_i', {
        throwOnError: false,
        displayMode: true,
      }),
    [],
  );
  const htmlMM = useMemo(
    () =>
      katex.renderToString('H_{\\mathrm{MM}} = H + \\frac{M - 1}{2 \\cdot C}', {
        throwOnError: false,
        displayMode: true,
      }),
    [],
  );
  const htmlNeff = useMemo(
    () =>
      katex.renderToString('N_{\\mathrm{eff}} = e^{H_{\\mathrm{MM}}}', {
        throwOnError: false,
        displayMode: true,
      }),
    [],
  );

  return (
    <div className="mt-8 rounded-2xl border border-slate-200 bg-white/80 p-4 relative">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-slate-800">Leaderboard</h2>
          <button
            type="button"
            onClick={() => setShowHelp((value) => !value)}
            className="inline-flex items-center justify-center w-5 h-5 text-xs rounded-full bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200"
            title="Score formula help"
            aria-label="Score formula help"
          >
            ?
          </button>
          <button
            type="button"
            onClick={() => setRefreshKey((prev) => prev + 1)}
            disabled={loading}
            className="inline-flex items-center justify-center w-5 h-5 text-xs rounded-full bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 disabled:opacity-50"
            title="Refresh leaderboard"
            aria-label="Refresh leaderboard"
          >
            ↻
          </button>
          <div className="ml-1 inline-flex rounded-lg border border-slate-200 overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => setPeriod('all')}
              className={`px-2 py-1 font-semibold ${
                period === 'all'
                  ? 'bg-slate-700 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              All-time
            </button>
            <button
              type="button"
              onClick={() => setPeriod('week')}
              className={`px-2 py-1 font-semibold ${
                period === 'week'
                  ? 'bg-slate-700 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
              title="Best scores since Monday — resets every week"
            >
              This week
            </button>
          </div>
        </div>
        <div className="text-xs text-slate-500">Top {limitCount}</div>
      </div>
      <p className="text-xs text-slate-500 mb-2">
        Competitive milestone — scores track difficulty × accuracy × speed. Not tied to teaching
        plan progress. Trophies celebrate score milestones.
      </p>
      {showHelp && (
        <div className="absolute right-3 top-10 z-50 w-[min(32rem,calc(100vw-2rem))] max-w-[32rem] p-3 rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-start justify-between mb-2">
            <div className="text-sm font-semibold text-slate-800">Leaderboard score formula</div>
            <button
              onClick={() => setShowHelp(false)}
              className="text-slate-500 hover:text-slate-700"
            >
              ×
            </button>
          </div>
          <div className="text-xs text-slate-700">
            <div dangerouslySetInnerHTML={{ __html: htmlMain }} />
            <div className="mt-2">Where:</div>
            <ul className="list-disc pl-5 space-y-1 mt-1">
              <li>
                <span className="font-mono">C</span> — total characters in session
              </li>
              <li>
                <span className="font-mono">N_eff</span> — effective alphabet size from Shannon
                entropy
              </li>
              <li>
                <span className="font-mono">A</span> — per-group accuracy (0..1)
              </li>
              <li>
                <span className="font-mono">t_avg</span> — average response time (ms)
              </li>
              <li>
                <span className="font-mono">K</span> — timing constant ({K})
              </li>
              <li>
                <span className="font-mono">α, β, γ, δ</span> — weighting exponents ({alpha}, {beta}
                , {gamma}, {delta})
              </li>
            </ul>
            <div className="mt-3">Entropy-based diversity:</div>
            <div dangerouslySetInnerHTML={{ __html: htmlH }} />
            <div dangerouslySetInnerHTML={{ __html: htmlMM }} />
            <div dangerouslySetInnerHTML={{ __html: htmlNeff }} />
            <div className="mt-1 text-[11px] text-slate-600">
              M is the number of distinct observed characters; C is sample size (= total
              characters). The Miller–Madow term reduces small-sample bias.
            </div>
          </div>
        </div>
      )}
      {loading && <div className="text-sm text-slate-600">Loading…</div>}
      {error && <div className="text-sm text-rose-600">{error}</div>}
      {!error && hint && <div className="text-sm text-amber-700">{hint}</div>}
      {!loading && !error && top.length === 0 && (
        <div className="text-sm text-slate-500">
          No scores yet. Complete a session to appear here.
        </div>
      )}
      {top.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-600">
                <th className="py-2 pr-3">#</th>
                <th className="py-2 pr-3">ID</th>
                <th className="py-2 pr-3">Score</th>
                <th className="py-2 pr-3 hidden sm:table-cell">Accuracy</th>
                <th className="py-2 pr-3 hidden md:table-cell">Alphabet</th>
                <th className="py-2 pr-3 hidden md:table-cell">Avg ms</th>
                <th className="py-2 pr-3 hidden lg:table-cell">When</th>
              </tr>
            </thead>
            <tbody>
              {top.map((row, index) => (
                <tr key={`${row.publicId}_${row.timestamp}`} className="border-t border-slate-100">
                  <td className="py-2 pr-3 font-medium text-slate-700">{index + 1}</td>
                  <td className="py-2 pr-3 font-mono">
                    {row.callSign ? (
                      <span className="font-semibold text-blue-600">{row.callSign}</span>
                    ) : (
                      formatPublicId(row.publicId)
                    )}
                  </td>
                  <td className="py-2 pr-3 font-semibold text-slate-900">{row.score.toFixed(2)}</td>
                  <td className="py-2 pr-3 hidden sm:table-cell">
                    {typeof row.accuracy === 'number' ? `${Math.round(row.accuracy * 100)}%` : '—'}
                  </td>
                  <td className="py-2 pr-3 hidden md:table-cell">{row.alphabetSize ?? '—'}</td>
                  <td className="py-2 pr-3 hidden md:table-cell">
                    {typeof row.avgResponseMs === 'number' ? Math.round(row.avgResponseMs) : '—'}
                  </td>
                  <td className="py-2 pr-3 hidden lg:table-cell">
                    {row.date || (row.timestamp ? (hasMounted ? new Date(row.timestamp).toLocaleString() : new Date(row.timestamp).toISOString()) : '—')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
