import { Suspense } from 'react';

import { PublicProfilePageClient } from '@/components/features/profile/PublicProfilePageClient';

export default function ProfilePage(): JSX.Element {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 px-4 py-8">
          <div className="mx-auto max-w-4xl">
            <p className="text-sm text-slate-600">Loading profile...</p>
          </div>
        </main>
      }
    >
      <PublicProfilePageClient />
    </Suspense>
  );
}
