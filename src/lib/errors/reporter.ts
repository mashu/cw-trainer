import { ensureAppError } from './index';

/**
 * Central client-side error reporter.
 *
 * This is a deliberate exception to the `lib/` purity rule (like `morseAudio`):
 * it touches `console` and `window` because its whole job is observability. It
 * stays free of Firebase imports — remote delivery is injected via
 * {@link setRemoteErrorSink} so the persistence layer remains optional.
 */

export type ErrorSource = 'react' | 'window' | 'unhandledrejection' | 'manual';

export interface ErrorReport {
  readonly message: string;
  readonly stack?: string;
  readonly code?: string;
  readonly source: ErrorSource;
  readonly boundary?: string;
  readonly componentStack?: string;
  readonly timestamp: number;
  readonly url?: string;
}

export interface ReportErrorContext {
  readonly source?: ErrorSource;
  readonly boundary?: string;
  readonly componentStack?: string;
}

export type ErrorSink = (report: ErrorReport) => void;
export type ErrorSubscriber = (report: ErrorReport) => void;

interface QueuedWindowError {
  readonly message: string;
  readonly source?: ErrorSource;
}

const RING_BUFFER_SIZE = 50;
const recentErrors: ErrorReport[] = [];
const subscribers = new Set<ErrorSubscriber>();
let remoteSink: ErrorSink | null = null;

/** Snapshot of the most recent reports (oldest first), for dev surfaces / debugging. */
export function getRecentErrors(): readonly ErrorReport[] {
  return [...recentErrors];
}

/** Subscribe to every reported error. Returns an unsubscribe function. */
export function subscribeToErrors(subscriber: ErrorSubscriber): () => void {
  subscribers.add(subscriber);
  return (): void => {
    subscribers.delete(subscriber);
  };
}

/**
 * Install (or clear) the best-effort remote delivery sink. The sink must never
 * throw and should no-op when persistence is unavailable (e.g. signed out).
 */
export function setRemoteErrorSink(sink: ErrorSink | null): void {
  remoteSink = sink;
}

/** Normalise, record, log, and fan out an error. Never throws. */
export function reportError(error: unknown, ctx?: ReportErrorContext): ErrorReport {
  const appError = ensureAppError(error);
  const report: ErrorReport = {
    message: appError.message,
    source: ctx?.source ?? 'manual',
    timestamp: Date.now(),
    code: appError.code,
    ...(appError.stack !== undefined ? { stack: appError.stack } : {}),
    ...(ctx?.boundary !== undefined ? { boundary: ctx.boundary } : {}),
    ...(ctx?.componentStack !== undefined ? { componentStack: ctx.componentStack } : {}),
    ...(typeof window !== 'undefined' ? { url: window.location.href } : {}),
  };

  recentErrors.push(report);
  while (recentErrors.length > RING_BUFFER_SIZE) {
    recentErrors.shift();
  }

  try {
    console.error(`[cw-error]${report.boundary ? ` (${report.boundary})` : ''}`, report.message, report);
  } catch {
    /* no-op */
  }

  subscribers.forEach((subscriber) => {
    try {
      subscriber(report);
    } catch {
      /* no-op */
    }
  });

  if (remoteSink) {
    try {
      remoteSink(report);
    } catch {
      /* no-op */
    }
  }

  return report;
}

/**
 * Drain errors captured by the pre-hydration inline script in `app/layout.tsx`
 * (stored on `window.__cwErrorQueue`) once the reporter is live.
 */
export function drainPendingWindowErrors(): void {
  if (typeof window === 'undefined') {
    return;
  }
  const holder = window as unknown as { __cwErrorQueue?: QueuedWindowError[] };
  const queue = holder.__cwErrorQueue;
  if (!Array.isArray(queue)) {
    return;
  }
  while (queue.length > 0) {
    const item = queue.shift();
    if (!item) {
      continue;
    }
    reportError(new Error(item.message), { source: item.source ?? 'window' });
  }
}
