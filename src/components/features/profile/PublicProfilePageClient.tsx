'use client';

import { useSearchParams } from 'next/navigation';

import { PublicProfileView } from '@/components/features/profile/PublicProfileView';

function parsePublicId(raw: string | null): number | null {
  if (!raw || !/^\d+$/.test(raw)) {
    return null;
  }
  return Number(raw);
}

export function PublicProfilePageClient(): JSX.Element {
  const searchParams = useSearchParams();
  const publicId = parsePublicId(searchParams.get('u'));

  return <PublicProfileView publicId={publicId} />;
}
