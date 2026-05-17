import {
  beginGroupTrainingSession,
  cancelGroupTrainingSession,
  completeGroupTrainingSession,
  confirmGroupTrainingAnswer,
  isGroupTrainingRuntimeActive,
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
