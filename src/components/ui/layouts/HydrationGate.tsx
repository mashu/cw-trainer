'use client';

import type { ReactNode } from 'react';

import { useHasMounted } from '@/hooks/useHasMounted';

interface HydrationGateProps {
  readonly children: ReactNode;
  /** Stable placeholder rendered on the server and on the first client render. */
  readonly fallback: ReactNode;
}

/**
 * Renders a stable `fallback` on the server and during the first client render,
 * then swaps to `children` only after mount. Because both sides initially emit
 * the same `fallback`, this eliminates the entire class of hydration mismatches
 * (locale dates, `Date.now()`, `Math.random()`, `localStorage`-derived output)
 * that could otherwise throw and remount the app back to the front page.
 */
export function HydrationGate({ children, fallback }: HydrationGateProps): JSX.Element {
  const mounted = useHasMounted();
  return <>{mounted ? children : fallback}</>;
}
