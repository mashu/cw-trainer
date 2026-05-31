import {
  clearGroupRuntime,
  readGroupRuntime,
  writeGroupRuntime,
} from '@/lib/persistence/groupRuntimePersistence';
import {
  beginGroupTrainingSession,
  completeGroupTrainingSession,
  setGroupTrainingGroups,
  transitionGroupTrainingStatus,
  updateGroupTrainingInput,
} from '@/lib/training/groupSessionMachine';

const STORAGE_KEY = 'cw-trainer:group-runtime';

describe('groupRuntimePersistence', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    jest.restoreAllMocks();
  });

  it('returns idle when nothing is stored', () => {
    expect(readGroupRuntime().status).toBe('idle');
  });

  it('round-trips a results snapshot intact', () => {
    const results = completeGroupTrainingSession({
      accuracy: 0.8,
      groups: [{ sent: 'KM', received: 'KM', correct: true }],
      avgResponseMs: 120,
      score: 8,
    });
    writeGroupRuntime(results);
    expect(readGroupRuntime()).toEqual(results);
  });

  it('restores an active session as paused with answers preserved', () => {
    const started = beginGroupTrainingSession({ sessionId: 3, startedAt: 100 });
    const playing = transitionGroupTrainingStatus(
      updateGroupTrainingInput(setGroupTrainingGroups(started, ['KM', 'MK']), 0, 'KM'),
      'playingGroup',
    );
    writeGroupRuntime(playing);

    const restored = readGroupRuntime();
    expect(restored.status).toBe('paused');
    if (restored.status === 'paused') {
      expect(restored.userInput[0]).toBe('KM');
      expect(restored.audioStatus).toBe('closed');
    }
  });

  it('clears the key when writing an idle runtime', () => {
    writeGroupRuntime(beginGroupTrainingSession({ sessionId: 1, startedAt: 1 }));
    expect(window.sessionStorage.getItem(STORAGE_KEY)).not.toBeNull();
    writeGroupRuntime({ status: 'idle' });
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('clearGroupRuntime removes any persisted snapshot', () => {
    writeGroupRuntime(beginGroupTrainingSession({ sessionId: 1, startedAt: 1 }));
    clearGroupRuntime();
    expect(readGroupRuntime().status).toBe('idle');
  });

  it('returns idle for corrupt JSON', () => {
    window.sessionStorage.setItem(STORAGE_KEY, '{not valid json');
    expect(readGroupRuntime().status).toBe('idle');
  });

  it('returns idle for schema-invalid JSON', () => {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ status: 'nonsense' }));
    expect(readGroupRuntime().status).toBe('idle');
  });

  it('never throws when storage access fails', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => readGroupRuntime()).not.toThrow();
    expect(readGroupRuntime().status).toBe('idle');
  });
});
