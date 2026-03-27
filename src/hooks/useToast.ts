
import { useCallback, useEffect, useRef, useState } from 'react';

import { TOAST_DURATION_MS } from '@/lib/constants';

/** Lightweight toast message (component-level, not the full domain ToastMessage). */
export interface Toast {
  readonly message: string;
  readonly type: 'success' | 'error' | 'info';
}

export interface UseToastReturn {
  /** Currently visible toast, or null. */
  readonly toast: Toast | null;
  /** Show a new toast (replaces any existing one and resets the dismiss timer). */
  readonly showToast: (t: Toast) => void;
  /** Dismiss the current toast immediately. */
  readonly dismissToast: () => void;
}

/**
 * Self-contained toast state with auto-dismiss timer.
 * Extracted from CWTrainer to keep the orchestrator lean.
 */
export function useToast(): UseToastReturn {
  const [toast, setToast] = useState<Toast | null>(null);
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (toast) {
      try {
        if (timerRef.current) window.clearTimeout(timerRef.current);
      } catch {
        /* no-op */
      }
      timerRef.current = window.setTimeout(() => setToast(null), TOAST_DURATION_MS);
    }
    return (): void => {
      try {
        if (timerRef.current) window.clearTimeout(timerRef.current);
      } catch {
        /* no-op */
      }
    };
  }, [toast]);

  const showToast = useCallback((t: Toast) => setToast(t), []);
  const dismissToast = useCallback(() => setToast(null), []);

  return { toast, showToast, dismissToast };
}
