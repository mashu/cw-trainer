'use client';

import {
  collection,
  collectionGroup,
  getDocs,
  limit,
  orderBy,
  query,
} from 'firebase/firestore';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import React, { useEffect, useMemo, useState } from 'react';

import { initFirebase } from '@/lib/firebaseClient';
import { DEFAULT_SCORE_CONSTANTS } from '@/lib/score';

type LeaderboardEntry = {
  publicId: number;
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
  publicId?: number;
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

export function Leaderboard({ limitCount = 20 }: { limitCount?: number }): JSX.Element {
  const [items, setItems] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

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
        let lastErrorCode: string | null = null;
        let loadedFromPersonal = false;

        const attempt = async (makeQuery: () => ReturnType<typeof query>): Promise<boolean> => {
          const q = makeQuery();
          try {
            const snap = await getDocs(q);
            rows.length = 0;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            snap.forEach((document: any) => {
              const data = document.data() as LeaderboardDoc;
              if (typeof data.score !== 'number' || typeof data.publicId !== 'number') {
                return;
              }

              const entry: LeaderboardEntry = {
                publicId: data.publicId,
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
              rows.push(entry);
            });
            return true;
          } catch (error) {
            const typedError = error as { code?: string } | null;
            lastErrorCode = typedError?.code ?? null;
            return false;
          }
        };

        let ok = false;
        // Try global leaderboard first (collectionGroup)
        try {
          ok = await attempt(() =>
            query(
              collectionGroup(services.db, 'leaderboard'),
              orderBy('score', 'desc'),
              limit(limitN),
            ),
          );
        } catch (error) {
          ok = false;
        }

        // Fallback to top-level leaderboard collection
        if (!ok) {
          try {
            ok = await attempt(() =>
              query(
                collection(services.db, 'leaderboard'),
                orderBy('score', 'desc'),
                limit(limitN),
              ),
            );
          } catch (error) {
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
                limit(limitN),
              ),
            );
            if (ok) {
              loadedFromPersonal = true;
            }
          } catch (error) {
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
  }, [limitCount]);

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
        </div>
        <div className="text-xs text-slate-500">Top {limitCount}</div>
      </div>
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
                  <td className="py-2 pr-3 font-mono">{formatPublicId(row.publicId)}</td>
                  <td className="py-2 pr-3 font-semibold text-slate-900">{row.score.toFixed(2)}</td>
                  <td className="py-2 pr-3 hidden sm:table-cell">
                    {typeof row.accuracy === 'number' ? `${Math.round(row.accuracy * 100)}%` : '—'}
                  </td>
                  <td className="py-2 pr-3 hidden md:table-cell">{row.alphabetSize ?? '—'}</td>
                  <td className="py-2 pr-3 hidden md:table-cell">
                    {typeof row.avgResponseMs === 'number' ? Math.round(row.avgResponseMs) : '—'}
                  </td>
                  <td className="py-2 pr-3 hidden lg:table-cell">
                    {row.date || (row.timestamp ? new Date(row.timestamp).toLocaleString() : '—')}
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
