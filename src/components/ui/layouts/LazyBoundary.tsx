'use client';

import React, { Suspense } from 'react';

import { ErrorBoundary } from './ErrorBoundary';

interface LazyBoundaryProps {
  readonly children: React.ReactNode;
  /** Boundary name used in error reports (e.g. 'lazy:icr'). */
  readonly name?: string;
  /** Loading fallback shown while the chunk downloads. Pass `null` for none. */
  readonly fallback?: React.ReactNode;
}

function DefaultLoading(): JSX.Element {
  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <div className="text-sm text-slate-500">Loading…</div>
    </div>
  );
}

function LazyErrorFallback({ reset }: { readonly reset: () => void }): JSX.Element {
  return (
    <div
      className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"
      role="alert"
    >
      <p className="font-semibold">This section failed to load</p>
      <p className="mt-1">
        A required app file may not have downloaded. Retry, or reload the page to recover.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={reset}
          className="rounded-lg bg-amber-600 px-3 py-1.5 font-medium text-white shadow-sm hover:bg-amber-700"
        >
          Try again
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 font-medium text-amber-900 hover:bg-amber-50"
        >
          Reload
        </button>
      </div>
    </div>
  );
}

/**
 * Pairs an {@link ErrorBoundary} with a `Suspense` boundary for lazily-loaded
 * views. Loading is handled by Suspense; chunk-load / render failures are
 * contained here (with retry + reload) instead of propagating up and tearing
 * down the store or an active training session.
 */
export function LazyBoundary({ children, name, fallback }: LazyBoundaryProps): JSX.Element {
  return (
    <ErrorBoundary
      {...(name !== undefined ? { name } : {})}
      fallback={({ reset }): React.ReactNode => <LazyErrorFallback reset={reset} />}
    >
      <Suspense fallback={fallback === undefined ? <DefaultLoading /> : fallback}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}
