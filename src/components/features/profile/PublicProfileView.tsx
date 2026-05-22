'use client';

import Link from 'next/link';
import React, { useEffect, useMemo, useState } from 'react';

import type { PublicAchievementProfile } from '@/lib/achievements';
import { FirebaseAchievementRepository } from '@/lib/db/repositories';
import { AchievementService } from '@/lib/services';

const formatPublicId = (publicId: number): string => String(publicId).padStart(6, '0');

export function PublicProfileView({
  publicId,
}: {
  readonly publicId: number | null;
}): JSX.Element {
  const [profile, setProfile] = useState<PublicAchievementProfile | null>(null);
  const [loading, setLoading] = useState(Boolean(publicId));
  const [error, setError] = useState<string | null>(null);
  const service = useMemo(
    () => new AchievementService(new FirebaseAchievementRepository()),
    [],
  );

  useEffect(() => {
    if (publicId === null) {
      setLoading(false);
      setError('Missing profile id.');
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    void service
      .getPublicProfile(publicId)
      .then((loaded) => {
        if (cancelled) {
          return;
        }
        if (!loaded) {
          setError('This public profile is not available.');
          setProfile(null);
          return;
        }
        setProfile(loaded);
      })
      .catch(() => {
        if (!cancelled) {
          setError('Unable to load this public profile.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return (): void => {
      cancelled = true;
    };
  }, [publicId, service]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 px-4 py-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <Link href="/" className="inline-flex text-sm font-semibold text-indigo-700 hover:text-indigo-800">
          Back to CW-Trainer
        </Link>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          {loading && <p className="text-sm text-slate-600">Loading profile...</p>}
          {!loading && error && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-800">
              <h1 className="text-xl font-bold">Profile unavailable</h1>
              <p className="mt-2 text-sm">{error}</p>
            </div>
          )}
          {!loading && profile && (
            <div className="space-y-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
                    Public CW-Trainer profile
                  </p>
                  <h1 className="mt-2 text-3xl font-extrabold text-slate-900">
                    {profile.callSign ?? `Operator ${formatPublicId(profile.publicId)}`}
                  </h1>
                  <p className="mt-1 text-sm text-slate-500">
                    Profile #{formatPublicId(profile.publicId)} - Updated{' '}
                    {new Date(profile.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-indigo-800">
                  <div className="text-xs font-semibold uppercase tracking-wide">Trophies</div>
                  <div className="mt-1 text-3xl font-bold">{profile.badgeCount}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs text-slate-500">Best score</div>
                  <div className="mt-1 text-2xl font-bold text-slate-900">
                    {Math.round(profile.bestScore)}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs text-slate-500">Best accuracy</div>
                  <div className="mt-1 text-2xl font-bold text-slate-900">
                    {Math.round(profile.bestAccuracy * 100)}%
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs text-slate-500">Known characters</div>
                  <div className="mt-1 text-2xl font-bold text-slate-900">
                    {profile.masteredCharacterCount}/{profile.totalKnownCharacterCount}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs text-slate-500">Practice days</div>
                  <div className="mt-1 text-2xl font-bold text-slate-900">
                    {profile.practiceDays}
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-lg font-bold text-slate-900">Featured Trophies</h2>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {profile.featuredBadges.length === 0 ? (
                    <p className="text-sm text-slate-600">No trophies shared yet.</p>
                  ) : (
                    profile.featuredBadges.map((badge) => (
                      <div
                        key={badge.id}
                        className="rounded-xl border border-indigo-100 bg-indigo-50 p-4"
                      >
                        <div className="text-sm font-bold text-slate-900">{badge.title}</div>
                        <div className="mt-1 text-xs uppercase tracking-wide text-indigo-700">
                          {badge.tier} - {badge.rarity}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
