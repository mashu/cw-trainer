import {
  beginGroupTrainingSession,
  cancelGroupTrainingSession,
  completeGroupTrainingSession,
  confirmGroupTrainingAnswer,
  isGroupTrainingPlaybackFrozen,
  isGroupTrainingRuntimeActive,
  REHYDRATED_SESSION_PAUSE_REASON,
  rehydrateGroupTrainingRuntime,
  setGroupTrainingAudioStatus,
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

  it('appends the prior error message when rehydrating a failed session', () => {
    const started = beginGroupTrainingSession({ sessionId: 1, startedAt: 100 });
    const failed = transitionGroupTrainingStatus(started, 'failed', {
      errorMessage: 'Audio suspended',
    });

    const restored = rehydrateGroupTrainingRuntime(JSON.parse(JSON.stringify(failed)));

    expect(restored.status).toBe('paused');
    if (restored.status === 'paused') {
      expect(restored.pauseReason).toBe(
        `${REHYDRATED_SESSION_PAUSE_REASON} (Audio suspended)`,
      );
    }
  });
});

describe('isGroupTrainingPlaybackFrozen', () => {
  it('is true for paused sessions with closed audio (reload restore)', () => {
    const started = beginGroupTrainingSession({ sessionId: 1, startedAt: 100 });
    const paused = transitionGroupTrainingStatus(
      setGroupTrainingAudioStatus(started, 'closed'),
      'paused',
      { pauseReason: REHYDRATED_SESSION_PAUSE_REASON },
    );

    expect(isGroupTrainingPlaybackFrozen(paused)).toBe(true);
  });

  it('is false for tab-visibility pauses that keep audio suspended', () => {
    const started = beginGroupTrainingSession({ sessionId: 1, startedAt: 100 });
    const paused = transitionGroupTrainingStatus(
      setGroupTrainingAudioStatus(started, 'suspended'),
      'paused',
      { pauseReason: 'Training paused while the page was hidden.' },
    );

    expect(isGroupTrainingPlaybackFrozen(paused)).toBe(false);
  });

  it('is false for non-paused active statuses', () => {
    const started = beginGroupTrainingSession({ sessionId: 1, startedAt: 100 });
    expect(isGroupTrainingPlaybackFrozen(started)).toBe(false);
  });
});
