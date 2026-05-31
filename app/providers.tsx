'use client';

import type { ReactNode } from 'react';
import React, { useEffect } from 'react';

import { ErrorBoundary } from '@/components/ui/layouts/ErrorBoundary';
import { HydrationGate } from '@/components/ui/layouts/HydrationGate';
import { drainPendingWindowErrors, reportError } from '@/lib/errors/reporter';
import { AppStoreProvider } from '@/store';

interface ProvidersProps {
  readonly children: ReactNode;
}

/** Last-resort fallback for catastrophic failures (e.g. store construction). */
function GlobalErrorFallback(): JSX.Element {
  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-orange-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-rose-100 p-8 text-center space-y-4">
        <h1 className="text-2xl font-semibold text-slate-800">Something went wrong</h1>
        <p className="text-sm text-slate-600">
          An unexpected error occurred. Try reloading the page. If the problem persists, please
          contact support.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="w-full rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-rose-700"
        >
          Reload
        </button>
      </div>
    </div>
  );
}

/** Stable shell shown until the client mounts (kept deterministic for hydration). */
function AppSkeletonShell(): JSX.Element {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 p-2 sm:p-4 lg:p-6">
      <div className="mx-auto max-w-4xl rounded-3xl p-3 sm:p-6 lg:p-8">
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="text-sm text-slate-500">Loading…</div>
        </div>
      </div>
    </div>
  );
}

/**
 * App-shell fallback. This boundary sits BELOW the store provider, so the store
 * and any in-progress training session survive a localized render error — "Try
 * again" re-renders the shell without recreating the store.
 */
function ShellErrorFallback({ reset }: { readonly reset: () => void }): JSX.Element {
  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-orange-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-rose-100 p-8 text-center space-y-4">
        <h1 className="text-2xl font-semibold text-slate-800">The app hit an error</h1>
        <p className="text-sm text-slate-600">
          Your data is safe. Try recovering the interface; if that does not work, reload the page.
        </p>
        <div className="space-y-3">
          <button
            type="button"
            onClick={reset}
            className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-700"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full rounded-lg border-2 border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Reload page
          </button>
        </div>
      </div>
    </div>
  );
}

/** Captures errors that escape React (async callbacks, timers, rejected promises). */
function useGlobalErrorListeners(): void {
  useEffect(() => {
    drainPendingWindowErrors();

    const onError = (event: ErrorEvent): void => {
      reportError(event.error ?? new Error(event.message || 'Unknown window error'), {
        source: 'window',
      });
    };
    const onRejection = (event: PromiseRejectionEvent): void => {
      reportError(event.reason, { source: 'unhandledrejection' });
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return (): void => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);
}

export function Providers({ children }: ProvidersProps): JSX.Element {
  useGlobalErrorListeners();

  return (
    <ErrorBoundary name="root" fallback={<GlobalErrorFallback />}>
      <AppStoreProvider user={null}>
        <ErrorBoundary
          name="app-shell"
          fallback={({ reset }): React.ReactNode => <ShellErrorFallback reset={reset} />}
        >
          <HydrationGate fallback={<AppSkeletonShell />}>{children}</HydrationGate>
        </ErrorBoundary>
      </AppStoreProvider>
    </ErrorBoundary>
  );
}
