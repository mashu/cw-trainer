import { SLEEP_CANCELABLE_STEP_MS } from '@/lib/constants';

/** Resolves after `ms` unless `shouldStop` is true (polled every {@link SLEEP_CANCELABLE_STEP_MS}). */
export function sleepCancelablePolled(
  ms: number,
  shouldStop: () => boolean,
): Promise<void> {
  const end = Date.now() + ms;
  return new Promise((resolve) => {
    const step = (): void => {
      if (shouldStop() || Date.now() >= end) {
        resolve();
        return;
      }
      const remaining = end - Date.now();
      window.setTimeout(
        step,
        Math.min(SLEEP_CANCELABLE_STEP_MS, Math.max(0, remaining)),
      );
    };
    step();
  });
}
