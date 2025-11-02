'use client';

import type { ReactNode } from 'react';
import React from 'react';

import { ErrorBoundary } from '@/components/ui/layouts/ErrorBoundary';
import { AppStoreProvider } from '@/store';

interface ProvidersProps {
  readonly children: ReactNode;
}

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

export function Providers({ children }: ProvidersProps): JSX.Element {
  return (
    <ErrorBoundary fallback={<GlobalErrorFallback />}>
      <AppStoreProvider user={null}>{children}</AppStoreProvider>
    </ErrorBoundary>
  );
}


