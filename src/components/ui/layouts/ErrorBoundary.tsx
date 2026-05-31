'use client';

import React, { Component } from 'react';

import { reportError } from '@/lib/errors/reporter';

/** Render-prop signature for fallbacks that need to trigger a recovery. */
export type ErrorFallbackRender = (props: {
  readonly reset: () => void;
  readonly error: Error | null;
}) => React.ReactNode;

interface Props {
  readonly children: React.ReactNode;
  readonly fallback?: React.ReactNode | ErrorFallbackRender;
  /** Identifies this boundary in error reports (e.g. 'root', 'app-shell', 'training-router'). */
  readonly name?: string;
  /** When any value in this array changes (after an error), the boundary auto-resets. */
  readonly resetKeys?: readonly unknown[];
  readonly onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  readonly hasError: boolean;
  readonly error: Error | null;
}

const resetKeysChanged = (
  prev: readonly unknown[] | undefined,
  next: readonly unknown[] | undefined,
): boolean => {
  if (prev === undefined || next === undefined) {
    return false;
  }
  if (prev.length !== next.length) {
    return true;
  }
  return prev.some((value, index) => !Object.is(value, next[index]));
};

/**
 * ErrorBoundary catches React rendering errors and displays a fallback UI.
 * Prevents the entire app from crashing due to component errors.
 *
 * Boundaries are composed hierarchically (root -> app-shell -> feature) so a
 * localized failure is contained at the lowest level and the store / active
 * training session above it survive. Every caught error is forwarded to the
 * central reporter, tagged with this boundary's `name`.
 *
 * Usage:
 * <ErrorBoundary name="feature" fallback={({ reset }) => <Retry onClick={reset} />}>
 *   <YourComponent />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    reportError(error, {
      source: 'react',
      ...(this.props.name !== undefined ? { boundary: this.props.name } : {}),
      ...(errorInfo.componentStack ? { componentStack: errorInfo.componentStack } : {}),
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  override componentDidUpdate(prevProps: Props): void {
    if (this.state.hasError && resetKeysChanged(prevProps.resetKeys, this.props.resetKeys)) {
      this.handleReset();
    }
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  override render(): React.ReactNode {
    if (this.state.hasError) {
      // Custom fallback UI if provided
      if (this.props.fallback !== undefined) {
        return typeof this.props.fallback === 'function'
          ? this.props.fallback({ reset: this.handleReset, error: this.state.error })
          : this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-orange-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 border border-rose-100">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-rose-100 rounded-full mb-4">
                <svg
                  className="w-8 h-8 text-rose-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-slate-800 mb-2">Something went wrong</h1>
              <p className="text-slate-600 mb-4">
                The application encountered an unexpected error.
              </p>
            </div>

            {this.state.error && process.env['NODE_ENV'] === 'development' && (
              <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-xs font-mono text-slate-700 break-words">
                  {this.state.error.toString()}
                </p>
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={this.handleReset}
                className="w-full px-6 py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-semibold rounded-lg hover:from-emerald-600 hover:to-green-700 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="w-full px-6 py-3 bg-white border-2 border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition-all duration-200"
              >
                Reload Page
              </button>
            </div>

            <p className="text-xs text-slate-500 text-center mt-6">
              If the problem persists, try clearing your browser cache or contact support.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

interface FeatureErrorFallbackProps {
  readonly reset: () => void;
  readonly title?: string;
  readonly message?: string;
}

/**
 * Compact, inline fallback for feature-level boundaries. Unlike the full-screen
 * default, this keeps the surrounding shell (and any active session) in place
 * and offers a non-destructive "Try again" that re-renders just this subtree.
 */
export function FeatureErrorFallback({
  reset,
  title = 'This section ran into a problem',
  message = 'You can keep your current session. Try reloading just this section.',
}: FeatureErrorFallbackProps): JSX.Element {
  return (
    <div
      className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"
      role="alert"
    >
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-rose-800/90">{message}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-3 rounded-lg bg-rose-600 px-3 py-1.5 font-medium text-white shadow-sm hover:bg-rose-700"
      >
        Try again
      </button>
    </div>
  );
}
