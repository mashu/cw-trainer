import { PublicProfileView } from '@/components/features/profile/PublicProfileView';

export default function ProfilePage({
  searchParams,
}: {
  readonly searchParams?: Readonly<Record<string, string | string[] | undefined>>;
}): JSX.Element {
  const raw = searchParams?.['u'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  const publicId = value && /^\d+$/.test(value) ? Number(value) : null;

  return <PublicProfileView publicId={publicId} />;
}
