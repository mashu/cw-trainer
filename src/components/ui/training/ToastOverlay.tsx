import React from 'react';

import type { Toast } from '@/hooks/useToast';

interface ToastOverlayProps {
  readonly toast: Toast | null;
  readonly onDismiss: () => void;
}

export function ToastOverlay({ toast, onDismiss }: ToastOverlayProps): JSX.Element | null {
  if (!toast) return null;

  return (
    <div className="fixed top-4 left-4 z-50">
      <div
        className={`px-4 py-3 rounded-xl shadow-lg border text-sm ${
          toast.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : toast.type === 'error'
              ? 'bg-rose-50 text-rose-800 border-rose-200'
              : 'bg-slate-50 text-slate-800 border-slate-200'
        }`}
        onClick={onDismiss}
      >
        {toast.message}
      </div>
    </div>
  );
}
