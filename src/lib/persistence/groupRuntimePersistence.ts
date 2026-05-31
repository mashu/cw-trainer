import {
  IDLE_GROUP_TRAINING_RUNTIME,
  rehydrateGroupTrainingRuntime,
  type GroupTrainingRuntimeState,
} from '@/lib/training/groupSessionMachine';

const STORAGE_KEY = 'cw-trainer:group-runtime';

/** sessionStorage may be unavailable (SSR/static export, private mode). Never throw. */
const getStore = (): Storage | null => {
  try {
    if (typeof window === 'undefined') return null;
    return window.sessionStorage;
  } catch {
    return null;
  }
};

/**
 * Reads the persisted group runtime and maps it to a safe in-memory state via
 * {@link rehydrateGroupTrainingRuntime}. Returns idle when storage is unavailable,
 * empty, corrupt, or schema-invalid.
 */
export function readGroupRuntime(): GroupTrainingRuntimeState {
  const store = getStore();
  if (!store) return IDLE_GROUP_TRAINING_RUNTIME;
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return IDLE_GROUP_TRAINING_RUNTIME;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      clearGroupRuntime();
      return IDLE_GROUP_TRAINING_RUNTIME;
    }
    const rehydrated = rehydrateGroupTrainingRuntime(parsed);
    if (rehydrated.status === 'idle') {
      clearGroupRuntime();
    }
    return rehydrated;
  } catch {
    return IDLE_GROUP_TRAINING_RUNTIME;
  }
}

/** Persists a non-idle runtime; clears the key on idle. Best-effort (never throws). */
export function writeGroupRuntime(state: GroupTrainingRuntimeState): void {
  const store = getStore();
  if (!store) return;
  try {
    if (state.status === 'idle') {
      store.removeItem(STORAGE_KEY);
      return;
    }
    store.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* no-op: private mode / quota exceeded */
  }
}

export function clearGroupRuntime(): void {
  const store = getStore();
  if (!store) return;
  try {
    store.removeItem(STORAGE_KEY);
  } catch {
    /* no-op */
  }
}
