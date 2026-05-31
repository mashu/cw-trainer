import { PublicProfilePageClient } from '@/components/features/profile/PublicProfilePageClient';
import { LazyBoundary } from '@/components/ui/layouts/LazyBoundary';

export default function ProfilePage(): JSX.Element {
  return (
    <LazyBoundary
      name="profile"
      fallback={
        <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 px-4 py-8">
          <div className="mx-auto max-w-4xl">
            <p className="text-sm text-slate-600">Loading profile...</p>
          </div>
        </main>
      }
    >
      <PublicProfilePageClient />
    </LazyBoundary>
  );
}
