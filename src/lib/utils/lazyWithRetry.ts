import { lazy } from 'react';
import type { ComponentType, LazyExoticComponent } from 'react';

interface LazyWithRetryOptions {
  readonly retries?: number;
  readonly delayMs?: number;
}

const DEFAULT_RETRIES = 2;
const DEFAULT_DELAY_MS = 300;

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

async function importWithRetry<T>(
  factory: () => Promise<T>,
  retries: number,
  delayMs: number,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await factory();
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await wait(delayMs * (attempt + 1));
      }
    }
  }
  throw lastError;
}

/**
 * Like `React.lazy`, but retries the dynamic import a few times before giving
 * up. This absorbs the common transient chunk-load failure on static hosting
 * (e.g. a stale GitHub Pages manifest right after a deploy) so most failures
 * never reach the error boundary. Permanent failures still surface and are
 * caught by the surrounding {@link LazyBoundary}.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mirrors React.lazy's own generic constraint; ComponentType is contravariant, so a precise prop type would infer as `never`.
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  options?: LazyWithRetryOptions,
): LazyExoticComponent<T> {
  const retries = options?.retries ?? DEFAULT_RETRIES;
  const delayMs = options?.delayMs ?? DEFAULT_DELAY_MS;
  return lazy(() => importWithRetry(factory, retries, delayMs));
}
