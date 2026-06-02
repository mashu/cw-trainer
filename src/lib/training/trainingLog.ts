/**
 * Lightweight observability for the group-training lifecycle.
 *
 * This is a deliberate exception to the `lib/` purity rule (like `errors/reporter` and
 * `morseAudio`): its whole job is side effects (console + an in-memory ring buffer).
 * It exists because the training playback loop previously had *zero* logging, so the
 * "returned to the home screen mid-session" regression was impossible to diagnose from
 * a user's console. Every meaningful lifecycle transition now emits a compact line.
 *
 * The most recent entries are also exposed on `window.__cwTrainingLog()` so a user who
 * hits the bug can paste a clean timeline without a debugger attached.
 */

export interface TrainingLogEntry {
  readonly seq: number;
  readonly t: number;
  readonly event: string;
  readonly data?: Readonly<Record<string, unknown>>;
}

const RING_BUFFER_SIZE = 300;
const entries: TrainingLogEntry[] = [];
let sequence = 0;
let consoleEnabled = true;
let windowBound = false;

/** Snapshot of recent training-lifecycle entries (oldest first). */
export function getTrainingLog(): readonly TrainingLogEntry[] {
  return [...entries];
}

export function clearTrainingLog(): void {
  entries.length = 0;
}

/** Toggle console output. The ring buffer is always populated regardless. */
export function setTrainingLogConsole(enabled: boolean): void {
  consoleEnabled = enabled;
}

const bindWindowAccessor = (): void => {
  if (windowBound || typeof window === 'undefined') {
    return;
  }
  windowBound = true;
  try {
    (window as unknown as { __cwTrainingLog?: () => readonly TrainingLogEntry[] }).__cwTrainingLog =
      getTrainingLog;
  } catch {
    /* no-op: hardened environments may forbid window writes */
  }
};

/**
 * Record a training-lifecycle event. Never throws. Keep `event` short and stable
 * (e.g. `loop-end`) and put variable details in `data`.
 */
export function logTraining(event: string, data?: Readonly<Record<string, unknown>>): void {
  bindWindowAccessor();
  const entry: TrainingLogEntry = {
    seq: (sequence += 1),
    t: Date.now(),
    event,
    ...(data !== undefined ? { data } : {}),
  };
  entries.push(entry);
  while (entries.length > RING_BUFFER_SIZE) {
    entries.shift();
  }
  if (!consoleEnabled) {
    return;
  }
  try {
    if (data !== undefined) {
      console.info(`[grp] ${event}`, data);
    } else {
      console.info(`[grp] ${event}`);
    }
  } catch {
    /* no-op */
  }
}
