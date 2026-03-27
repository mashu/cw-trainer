'use client';

import { useCallback, useEffect, useState } from 'react';

import { getSyncStatus, resetFailedSessions, type SyncStatus } from '@/lib/sessionQueue';

interface SyncStatusIndicatorProps {
  /** Total number of sessions in the store */
  totalSessions: number;
  /** Whether a sync operation is currently in progress */
  isSyncing?: boolean;
  /** Callback when user requests a manual retry */
  onRetry?: () => void;
}

/**
 * Discrete sync status indicator in the bottom-right corner.
 * Always visible when there are unsynced sessions, expandable on click.
 * Focus: pill uses tabIndex={-1} and onMouseDown preventDefault so it does not
 * steal focus from the training input during active sessions.
 */
export function SyncStatusIndicator({
  totalSessions,
  isSyncing = false,
  onRetry,
}: SyncStatusIndicatorProps): JSX.Element | null {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ pending: 0, failed: 0, total: 0 });
  const [isExpanded, setIsExpanded] = useState(false);

  // Poll sync status periodically
  useEffect(() => {
    const updateStatus = (): void => {
      setSyncStatus(getSyncStatus());
    };
    
    updateStatus();
    const interval = setInterval(updateStatus, 2000);
    
    return (): void => clearInterval(interval);
  }, []);

  const handleRetry = useCallback(() => {
    resetFailedSessions();
    setSyncStatus(getSyncStatus());
    onRetry?.();
    setIsExpanded(false);
  }, [onRetry]);

  // Don't show if everything is synced
  if (syncStatus.total === 0 && !isSyncing) {
    return null;
  }

  // Calculate percentages for the progress bar
  const totalForBar = Math.max(totalSessions, syncStatus.total);
  const syncedCount = totalSessions - syncStatus.total;
  const syncedPercent = totalForBar > 0 ? (syncedCount / totalForBar) * 100 : 0;
  const pendingPercent = totalForBar > 0 ? (syncStatus.pending / totalForBar) * 100 : 0;
  const failedPercent = totalForBar > 0 ? (syncStatus.failed / totalForBar) * 100 : 0;

  // Determine the status
  const hasFailures = syncStatus.failed > 0;
  const hasPending = syncStatus.pending > 0;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Expanded panel */}
      {isExpanded && (
        <div className="absolute bottom-full right-0 mb-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 p-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <h4 className="font-semibold text-slate-800 text-sm mb-3">Sync Status</h4>
          
          {/* Progress bar */}
          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden flex mb-3">
            <div
              className="h-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${syncedPercent}%` }}
            />
            <div
              className="h-full bg-amber-400 transition-all duration-500"
              style={{ width: `${pendingPercent}%` }}
            />
            <div
              className="h-full bg-rose-500 transition-all duration-500"
              style={{ width: `${failedPercent}%` }}
            />
          </div>
          
          {/* Legend */}
          <div className="space-y-1 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-slate-600">Synced</span>
              </div>
              <span className="font-medium text-slate-800">{syncedCount}</span>
            </div>
            {hasPending && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="text-slate-600">Pending</span>
                </div>
                <span className="font-medium text-slate-800">{syncStatus.pending}</span>
              </div>
            )}
            {hasFailures && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-rose-500" />
                  <span className="text-slate-600">Failed</span>
                </div>
                <span className="font-medium text-slate-800">{syncStatus.failed}</span>
              </div>
            )}
          </div>
          
          {/* Retry button */}
          {hasFailures && (
            <button
              onClick={handleRetry}
              onMouseDown={(e) => e.preventDefault()}
              tabIndex={-1}
              className="mt-3 w-full px-3 py-1.5 bg-rose-600 text-white text-xs font-medium rounded-lg hover:bg-rose-700 transition-colors"
            >
              Retry Failed
            </button>
          )}
          
          {/* Info text */}
          <p className="mt-2 text-[10px] text-slate-400">
            {hasPending && 'Auto-retrying in background'}
          </p>
        </div>
      )}

      {/* Compact pill indicator - prevents focus stealing during training */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        onMouseDown={(e) => e.preventDefault()}
        tabIndex={-1}
        className={`
          flex items-center gap-2 px-3 py-2 rounded-full shadow-lg border backdrop-blur-sm
          transition-all duration-200 hover:scale-105
          ${hasFailures 
            ? 'bg-rose-500 border-rose-400 text-white' 
            : hasPending 
              ? 'bg-amber-500 border-amber-400 text-white'
              : 'bg-blue-500 border-blue-400 text-white'
          }
        `}
        title="Click for sync details"
      >
        {/* Icon */}
        {isSyncing ? (
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ) : hasFailures ? (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        )}

        {/* Count badge */}
        <span className="text-xs font-bold">
          {syncStatus.total}
        </span>
      </button>
    </div>
  );
}

