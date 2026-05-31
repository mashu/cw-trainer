import {
  beginGroupTrainingSession,
  cancelGroupTrainingSession,
  completeGroupTrainingSession,
  confirmGroupTrainingAnswer,
  isGroupTrainingRuntimeActive,
  REHYDRATED_SESSION_PAUSE_REASON,
  rehydrateGroupTrainingRuntime,
  setGroupTrainingGroups,
  transitionGroupTrainingStatus,
  updateGroupTrainingInput,
} from '@/lib/training/groupSessionMachine';

describe('groupSessionMachine', () => {
  it('keeps a session active until an explicit terminal transition', () => {
    const started = beginGroupTrainingSession({ sessionId: 1, startedAt: 100 });
    const withGroups = setGroupTrainingGroups(started, ['KM', 'MK']);
    const waiting = transitionGroupTrainingStatus(withGroups, 'waitingForAnswer');
    const withInput = updateGroupTrainingInput(waiting, 0, 'K');
    const confirmed = confirmGroupTrainingAnswer(withInput, 0, 'KM', 150);

    expect(isGroupTrainingRuntimeActive(confirmed)).toBe(true);
    expect(confirmed.status).toBe('waitingForAnswer');
  });

  it('only cancel or completion clears the active runtime invariant', () => {
    const started = beginGroupTrainingSession({ sessionId: 1, startedAt: 100 });
    const failed = transitionGroupTrainingStatus(started, 'failed', {
      errorMessage: 'Audio suspended',
    });

    expect(isGroupTrainingRuntimeActive(failed)).toBe(true);

    const completed = completeGroupTrainingSession({
      accuracy: 1,
      groups: [{ sent: 'KM', received: 'KM', correct: true }],
      avgResponseMs: 100,
      score: 10,
    });

    expect(isGroupTrainingRuntimeActive(completed)).toBe(false);
    expect(cancelGroupTrainingSession().status).toBe('idle');
  });
});

describe('rehydrateGroupTrainingRuntime', () => {
  it('returns idle for invalid or empty input', () => {
    expect(rehydrateGroupTrainingRuntime(undefined).status).toBe('idle');
    expect(rehydrateGroupTrainingRuntime(null).status).toBe('idle');
    expect(rehydrateGroupTrainingRuntime({ status: 'bogus' }).status).toBe('idle');
    expect(rehydrateGroupTrainingRuntime({ status: 'idle' }).status).toBe('idle');
  });

  it('preserves a results snapshot so an accidental reload still shows the result', () => {
    const results = completeGroupTrainingSession({
      accuracy: 0.5,
      groups: [{ sent: 'KM', received: 'KX', correct: false }],
      avgResponseMs: 200,
      score: 5,
    });

    const restored = rehydrateGroupTrainingRuntime(JSON.parse(JSON.stringify(results)));
    expect(restored).toEqual(results);
  });

  it('coerces any active status to paused and preserves answers/timings', () => {
    const started = beginGroupTrainingSession({ sessionId: 7, startedAt: 100 });
    const withGroups = setGroupTrainingGroups(started, ['KM', 'MK']);
    const waiting = transitionGroupTrainingStatus(withGroups, 'waitingForAnswer');
    const playing = transitionGroupTrainingStatus(
      updateGroupTrainingInput(waiting, 0, 'KM'),
      'playingGroup',
    );

    const restored = rehydrateGroupTrainingRuntime(JSON.parse(JSON.stringify(playing)));

    expect(restored.status).toBe('paused');
    if (restored.status === 'paused') {
      expect(restored.sessionId).toBe(7);
      expect(restored.groups).toEqual(['KM', 'MK']);
      expect(restored.userInput[0]).toBe('KM');
      expect(restored.audioStatus).toBe('closed');
      expect(restored.pauseReason).toBe(REHYDRATED_SESSION_PAUSE_REASON);
    }
    expect(isGroupTrainingRuntimeActive(restored)).toBe(true);
  });
});
