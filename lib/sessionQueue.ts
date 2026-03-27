/**
 * Session save queue for resilient Firebase operations.
 * Provides local-first saving with automatic retry for failed Firebase operations.
 */

import type { SessionResult } from '@/types/domain';

interface QueuedSession {
  session: SessionResult;
  attempts: number;
  lastAttempt: number;
}

const QUEUE_STORAGE_KEY = 'morse_session_queue';
const MAX_RETRY_ATTEMPTS = 5;
const BASE_RETRY_DELAY_MS = 5000;
const MAX_RETRY_DELAY_MS = 300000; // 5 minutes

/**
 * Read the pending session queue from local storage.
 */
export function readSessionQueue(): QueuedSession[] {
  try {
    const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item: unknown): item is QueuedSession =>
        typeof item === 'object' &&
        item !== null &&
        'session' in item &&
        typeof (item as QueuedSession).attempts === 'number'
    );
  } catch {
    return [];
  }
}

/**
 * Write the session queue to local storage.
 */
function writeSessionQueue(queue: QueuedSession[]): void {
  try {
    if (queue.length === 0) {
      localStorage.removeItem(QUEUE_STORAGE_KEY);
    } else {
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
    }
  } catch {
    // Ignore storage errors
  }
}

/**
 * Add a session to the retry queue.
 */
export function queueSession(session: SessionResult): void {
  const queue = readSessionQueue();
  // Check if session already queued (by timestamp)
  const existing = queue.findIndex(q => q.session.timestamp === session.timestamp);
  if (existing >= 0) {
    // Update existing entry
    const entry = queue[existing];
    if (entry) {
      queue[existing] = {
        session,
        attempts: entry.attempts,
        lastAttempt: entry.lastAttempt,
      };
    }
  } else {
    queue.push({
      session,
      attempts: 0,
      lastAttempt: 0,
    });
  }
  writeSessionQueue(queue);
}

/**
 * Mark a session as successfully saved (remove from queue).
 */
export function dequeueSession(timestamp: number): void {
  const queue = readSessionQueue();
  const filtered = queue.filter(q => q.session.timestamp !== timestamp);
  writeSessionQueue(filtered);
}

/**
 * Get sessions that are ready for retry (based on exponential backoff).
 */
export function getRetryReadySessions(): SessionResult[] {
  const queue = readSessionQueue();
  const now = Date.now();
  const ready: SessionResult[] = [];

  queue.forEach(item => {
    if (item.attempts >= MAX_RETRY_ATTEMPTS) {
      // Too many attempts, keep in queue but don't retry yet
      // Will be retried on next app load
      return;
    }
    const delay = Math.min(
      BASE_RETRY_DELAY_MS * Math.pow(2, item.attempts),
      MAX_RETRY_DELAY_MS
    );
    if (now - item.lastAttempt >= delay) {
      ready.push(item.session);
    }
  });

  return ready;
}

/**
 * Record a retry attempt for a session.
 */
export function recordRetryAttempt(timestamp: number, success: boolean): void {
  if (success) {
    dequeueSession(timestamp);
    return;
  }

  const queue = readSessionQueue();
  const updated = queue.map(item => {
    if (item.session.timestamp === timestamp) {
      return {
        ...item,
        attempts: item.attempts + 1,
        lastAttempt: Date.now(),
      };
    }
    return item;
  });
  writeSessionQueue(updated);
}

/**
 * Get count of queued sessions (for UI indicator).
 */
export function getQueuedSessionCount(): number {
  return readSessionQueue().length;
}

/**
 * Get detailed sync status for UI indicator.
 */
export interface SyncStatus {
  pending: number;  // Sessions waiting for retry
  failed: number;   // Sessions that exceeded max attempts
  total: number;    // Total queued sessions
}

export function getSyncStatus(): SyncStatus {
  const queue = readSessionQueue();
  let pending = 0;
  let failed = 0;

  queue.forEach(item => {
    if (item.attempts >= MAX_RETRY_ATTEMPTS) {
      failed++;
    } else {
      pending++;
    }
  });

  return {
    pending,
    failed,
    total: queue.length,
  };
}

/**
 * Clear the entire queue (e.g., after successful sync).
 */
export function clearSessionQueue(): void {
  writeSessionQueue([]);
}

/**
 * Reset failed sessions to retry them again.
 * Useful when user manually triggers a sync.
 */
export function resetFailedSessions(): void {
  const queue = readSessionQueue();
  const reset = queue.map(item => ({
    ...item,
    attempts: 0,
    lastAttempt: 0,
  }));
  writeSessionQueue(reset);
}

