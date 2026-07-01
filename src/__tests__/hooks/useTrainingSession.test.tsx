jest.mock('@/hooks/useTrainingAudio');

jest.mock('@/lib/trainingSessionGroups', () => ({
  generateTrainingGroup: jest.fn(() => ({
    group: 'AB',
    state: { beliefs: {}, sessionSampleCounts: {} },
  })),
  updateSamplingStateFromAnswer: jest.fn((state) => state),
}));

import { renderHook, act, waitFor, type RenderHookResult } from '@testing-library/react';
import React from 'react';

import { DEFAULT_TRAINING_SETTINGS } from '@/config/training.config';
import { useTrainingAudio } from '@/hooks/useTrainingAudio';
import { useTrainingSession } from '@/hooks/useTrainingSession';
import { AUTO_CONFIRM_DELAY_MS } from '@/lib/constants';
import type { IcrSessionService } from '@/lib/services/icr-session.service';
import type { SessionService } from '@/lib/services/session.service';
import type { TrainingSettingsService } from '@/lib/services/training-settings.service';
import type {
  GroupTrainingAudioStatus,
  GroupTrainingRuntimeState,
} from '@/lib/training/groupSessionMachine';
import { rehydrateGroupTrainingRuntime } from '@/lib/training/groupSessionMachine';
import { useAppStore } from '@/store';
import { AppStoreProvider } from '@/store/providers/app-store-provider';
import type { TrainingSettings } from '@/types';

const selectRuntimeAudioStatus = (
  runtime: GroupTrainingRuntimeState,
): GroupTrainingAudioStatus => {
  if (runtime.status === 'idle' || runtime.status === 'results') {
    return 'idle';
  }
  return runtime.audioStatus;
};

const mockUseTrainingAudio = useTrainingAudio as jest.MockedFunction<typeof useTrainingAudio>;

const mockTrainingSettingsService: TrainingSettingsService = {
  getSettings: jest.fn(),
  saveSettings: jest.fn(),
  patchSettings: jest.fn(),
  resetSettings: jest.fn(),
} as unknown as TrainingSettingsService;

const mockSessionService = {
  listSessions: jest.fn(),
  upsertSession: jest.fn(),
  replaceAll: jest.fn(),
  deleteSession: jest.fn(),
  syncPending: jest.fn(),
  processRetryQueue: jest.fn(),
} as unknown as SessionService;

const mockIcrSessionService: IcrSessionService = {
  listSessions: jest.fn(),
  saveSession: jest.fn(),
  clearSessions: jest.fn(),
  deleteSession: jest.fn(),
};

const sessionSettings: TrainingSettings = {
  ...DEFAULT_TRAINING_SETTINGS,
  numGroups: 1,
  minGroupSize: 2,
  maxGroupSize: 2,
  groupTimeout: 0,
};

function TestWrapper({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <AppStoreProvider
      user={null}
      sessionService={mockSessionService}
      trainingSettingsService={mockTrainingSettingsService}
      icrSessionService={mockIcrSessionService}
    >
      {children}
    </AppStoreProvider>
  );
}

function createMockAudio(): ReturnType<typeof useTrainingAudio> {
  return {
    playMorse: jest.fn().mockResolvedValue({ status: 'played', durationSec: 0.05 }),
    stopAudio: jest.fn(),
    stopCurrentPlayback: jest.fn(),
    sleepCancelable: jest.fn().mockResolvedValue(undefined),
    ensureAudioReady: jest.fn(),
    trainingAbortRef: { current: false },
    sessionIdRef: { current: 0 },
    audioContextRef: {
      current: {
        state: 'running',
        resume: jest.fn().mockResolvedValue(undefined),
      } as unknown as AudioContext,
    },
  };
}

const waitForInitialLoads = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
};

describe('useTrainingSession', () => {
  const saveSession = jest.fn().mockResolvedValue([]);
  const setTrainingSettingsState = jest.fn();
  const showToast = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    mockUseTrainingAudio.mockReturnValue(createMockAudio());
    (mockTrainingSettingsService.getSettings as jest.Mock).mockResolvedValue(sessionSettings);
    (mockSessionService.listSessions as jest.Mock).mockResolvedValue([]);
    (mockIcrSessionService.listSessions as jest.Mock).mockResolvedValue([]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const renderSessionHook = (): RenderHookResult<
    ReturnType<typeof useTrainingSession>,
    unknown
  > =>
    renderHook(
      () =>
        useTrainingSession({
          settings: sessionSettings,
          sessions: [],
          saveSession,
          setTrainingSettingsState,
          showToast,
        }),
      { wrapper: TestWrapper },
    );

  it('starts idle with no active session', async () => {
    const { result } = renderSessionHook();
    await waitForInitialLoads();

    expect(result.current.isTraining).toBe(false);
    expect(result.current.hasActiveSession).toBe(false);
    expect(result.current.runtimeStatus).toBe('idle');
    expect(result.current.showResults).toBe(false);
  });

  it('stopTraining is safe when idle', async () => {
    const { result } = renderSessionHook();
    await waitForInitialLoads();

    act(() => {
      result.current.stopTraining();
    });

    expect(result.current.runtimeStatus).toBe('idle');
  });

  it('completes a single-group session and shows results', async () => {
    const { result } = renderSessionHook();
    await waitForInitialLoads();

    await act(async () => {
      void result.current.startTraining();
    });

    await waitFor(
      () => {
        expect(result.current.runtimeStatus).toBe('waitingForAnswer');
      },
      { timeout: 3000 },
    );

    act(() => {
      result.current.confirmGroupAnswer(0, 'AB');
    });

    await waitFor(
      () => {
        expect(result.current.showResults).toBe(true);
      },
      { timeout: 3000 },
    );

    expect(saveSession).toHaveBeenCalled();
    expect(result.current.lastSessionResult).not.toBeNull();
  });

  it('submitAnswer ends an in-progress session', async () => {
    const { result } = renderSessionHook();
    await waitForInitialLoads();

    await act(async () => {
      void result.current.startTraining();
    });

    await waitFor(() => {
      expect(result.current.hasActiveSession).toBe(true);
    });

    act(() => {
      result.current.submitAnswer();
    });

    await waitFor(() => {
      expect(result.current.showResults).toBe(true);
    });
  });

  it('handleAnswerChange updates input for active session', async () => {
    const { result } = renderSessionHook();
    await waitForInitialLoads();

    await act(async () => {
      void result.current.startTraining();
    });

    await waitFor(() => {
      expect(result.current.sentGroups.length).toBeGreaterThan(0);
    });

    act(() => {
      result.current.handleAnswerChange(0, 'A');
    });

    expect(result.current.userInput[0]).toBe('A');
  });

  it('blocks submit and input changes when playback is frozen after reload restore', async () => {
    const frozenRuntime = rehydrateGroupTrainingRuntime({
      status: 'playingGroup',
      sessionId: 1,
      startedAt: 100,
      groups: ['AB'],
      userInput: ['A'],
      confirmedGroups: {},
      currentGroup: 0,
      currentFocusedGroup: 0,
      groupStartAt: [100],
      groupEndAt: [200],
      groupAnswerAt: [],
      audioStatus: 'running',
    });

    function RestoreFrozenWrapper({ children }: { children: React.ReactNode }): JSX.Element {
      const restore = useAppStore((s) => s.restoreGroupTrainingRuntime);
      React.useEffect(() => {
        restore(frozenRuntime);
      }, [restore]);
      return <>{children}</>;
    }

    const { result } = renderHook(
      () =>
        useTrainingSession({
          settings: sessionSettings,
          sessions: [],
          saveSession,
          setTrainingSettingsState,
          showToast,
        }),
      {
        wrapper: ({ children }) => (
          <TestWrapper>
            <RestoreFrozenWrapper>{children}</RestoreFrozenWrapper>
          </TestWrapper>
        ),
      },
    );

    await waitForInitialLoads();

    await waitFor(() => {
      expect(result.current.isPlaybackFrozen).toBe(true);
      expect(result.current.isTraining).toBe(false);
      expect(result.current.hasActiveSession).toBe(true);
    });

    act(() => {
      result.current.handleAnswerChange(0, 'AB');
      result.current.submitAnswer();
    });

    expect(result.current.userInput[0]).toBe('A');
    expect(result.current.showResults).toBe(false);
    expect(saveSession).not.toHaveBeenCalled();
  });

  it('waits for scheduled playback duration before unlocking input', async () => {
    const audio = createMockAudio();
    jest.mocked(audio.playMorse).mockResolvedValue({ status: 'played', durationSec: 2.5 });
    mockUseTrainingAudio.mockReturnValue(audio);

    const { result } = renderSessionHook();
    await waitForInitialLoads();

    await act(async () => {
      void result.current.startTraining();
    });

    await waitFor(() => {
      expect(result.current.runtimeStatus).toBe('waitingForAnswer');
    });

    expect(audio.sleepCancelable).toHaveBeenCalledWith(
      Math.ceil(2.5 * 1000) + 60,
      expect.any(Number),
    );
  });

  it('stopTraining during session cancels without showing results', async () => {
    const { result } = renderSessionHook();
    await waitForInitialLoads();

    await act(async () => {
      void result.current.startTraining();
    });

    await waitFor(() => {
      expect(result.current.hasActiveSession).toBe(true);
    });

    act(() => {
      result.current.stopTraining();
    });

    expect(result.current.hasActiveSession).toBe(false);
    expect(result.current.showResults).toBe(false);
    expect(saveSession).not.toHaveBeenCalled();
  });

  it('dismissResults hides the results screen', async () => {
    const { result } = renderSessionHook();
    await waitForInitialLoads();

    await act(async () => {
      void result.current.startTraining();
    });

    await waitFor(() => {
      expect(result.current.runtimeStatus).toBe('waitingForAnswer');
    });

    act(() => {
      result.current.confirmGroupAnswer(0, 'AB');
    });

    await waitFor(() => {
      expect(result.current.showResults).toBe(true);
    });

    act(() => {
      result.current.dismissResults();
    });

    expect(result.current.showResults).toBe(false);
    expect(result.current.lastSessionResult).toBeNull();
  });

  it('aborts session without results when morse playback fails', async () => {
    const failingAudio = createMockAudio();
    jest.mocked(failingAudio.playMorse).mockResolvedValue({
      status: 'failed',
      message: 'Audio blocked',
    });
    mockUseTrainingAudio.mockReturnValue(failingAudio);

    const { result } = renderSessionHook();
    await waitForInitialLoads();

    await act(async () => {
      void result.current.startTraining();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(failingAudio.playMorse).toHaveBeenCalled();
      expect(result.current.runtimeStatus).toBe('failed');
    });

    expect(result.current.sessionIssueMessage).toBe('Audio blocked');
    expect(result.current.showResults).toBe(false);
    expect(result.current.hasActiveSession).toBe(true);
    expect(saveSession).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith({ message: 'Audio blocked', type: 'error' });
  });

  it('auto-confirms a complete answer after AUTO_CONFIRM_DELAY_MS', async () => {
    const { result } = renderSessionHook();
    await waitForInitialLoads();

    await act(async () => {
      void result.current.startTraining();
    });

    await waitFor(() => {
      expect(result.current.runtimeStatus).toBe('waitingForAnswer');
    });

    act(() => {
      result.current.handleAnswerChange(0, 'AB');
    });

    await waitFor(
      () => {
        expect(result.current.showResults).toBe(true);
      },
      { timeout: AUTO_CONFIRM_DELAY_MS + 500 },
    );
  });

  it('pauses when the page is hidden during training', async () => {
    const { result } = renderSessionHook();
    await waitForInitialLoads();

    await act(async () => {
      void result.current.startTraining();
    });

    await waitFor(() => {
      expect(result.current.hasActiveSession).toBe(true);
    });

    const originalDescriptor = Object.getOwnPropertyDescriptor(document, 'visibilityState');
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(result.current.runtimeStatus).toBe('paused');
    expect(result.current.sessionIssueMessage).toBe(
      'Training paused while the page was hidden.',
    );

    if (originalDescriptor) {
      Object.defineProperty(document, 'visibilityState', originalDescriptor);
    }
  });

  it('marks runtime failed when playback returns suspended', async () => {
    const suspendedAudio = createMockAudio();
    jest.mocked(suspendedAudio.playMorse).mockResolvedValue({ status: 'suspended' });
    mockUseTrainingAudio.mockReturnValue(suspendedAudio);

    const { result } = renderSessionHook();
    await waitForInitialLoads();

    await act(async () => {
      void result.current.startTraining();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(suspendedAudio.playMorse).toHaveBeenCalled();
      expect(result.current.runtimeStatus).toBe('failed');
    });

    expect(result.current.sessionIssueMessage).toBe(
      'Audio was suspended by the browser. Tap Submit or Stop, or start a new run.',
    );
    expect(result.current.showResults).toBe(false);
    expect(result.current.hasActiveSession).toBe(true);
    expect(saveSession).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error' }),
    );
  });

  it('keeps audio suspended when context resume is rejected', async () => {
    const mockAudio = createMockAudio();
    const resume = jest.fn().mockRejectedValue(new Error('Not allowed'));
    mockAudio.audioContextRef.current = {
      state: 'suspended',
      resume,
    } as unknown as AudioContext;
    mockUseTrainingAudio.mockReturnValue(mockAudio);

    const { result } = renderHook(
      () => {
        const session = useTrainingSession({
          settings: sessionSettings,
          sessions: [],
          saveSession,
          setTrainingSettingsState,
          showToast,
        });
        const audioStatus = useAppStore((s) => selectRuntimeAudioStatus(s.groupTrainingRuntime));
        return { ...session, audioStatus };
      },
      { wrapper: TestWrapper },
    );
    await waitForInitialLoads();

    await act(async () => {
      void result.current.startTraining();
    });

    await waitFor(() => {
      expect(result.current.hasActiveSession).toBe(true);
    });

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.audioStatus).toBe('suspended');
    });

    act(() => {
      result.current.stopTraining();
    });
  });

  it('resumes suspended audio when the page becomes visible', async () => {
    const mockAudio = createMockAudio();
    const resume = jest.fn().mockResolvedValue(undefined);
    mockAudio.audioContextRef.current = {
      state: 'suspended',
      resume,
    } as unknown as AudioContext;
    mockUseTrainingAudio.mockReturnValue(mockAudio);

    const { result } = renderSessionHook();
    await waitForInitialLoads();

    await act(async () => {
      void result.current.startTraining();
    });

    await waitFor(() => {
      expect(result.current.hasActiveSession).toBe(true);
    });

    const originalDescriptor = Object.getOwnPropertyDescriptor(document, 'visibilityState');
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });

    expect(resume).toHaveBeenCalled();

    if (originalDescriptor) {
      Object.defineProperty(document, 'visibilityState', originalDescriptor);
    }

    act(() => {
      result.current.stopTraining();
    });
  });

  it('restarts training when Enter is pressed on the results screen', async () => {
    const { result } = renderSessionHook();
    await waitForInitialLoads();

    await act(async () => {
      void result.current.startTraining();
    });

    await waitFor(() => {
      expect(result.current.runtimeStatus).toBe('waitingForAnswer');
    });

    act(() => {
      result.current.confirmGroupAnswer(0, 'AB');
    });

    await waitFor(() => {
      expect(result.current.showResults).toBe(true);
    });

    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
      );
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.showResults).toBe(false);
      expect(result.current.hasActiveSession).toBe(true);
    });
  });

  it('pauses on pagehide during training', async () => {
    const { result } = renderSessionHook();
    await waitForInitialLoads();

    await act(async () => {
      void result.current.startTraining();
    });

    await waitFor(() => {
      expect(result.current.hasActiveSession).toBe(true);
    });

    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });

    expect(result.current.runtimeStatus).toBe('paused');
  });

  it('unmount while training stops audio and aborts playback', async () => {
    const audio = createMockAudio();
    mockUseTrainingAudio.mockReturnValue(audio);
    const { result, unmount } = renderSessionHook();
    await waitForInitialLoads();

    await act(async () => {
      void result.current.startTraining();
    });

    await waitFor(() => {
      expect(result.current.hasActiveSession).toBe(true);
    });

    unmount();

    expect(audio.stopAudio).toHaveBeenCalled();
    expect(audio.trainingAbortRef.current).toBe(true);
  });

  it('auto-confirms empty answer when groupTimeout elapses', async () => {
    const timeoutSettings: TrainingSettings = { ...sessionSettings, groupTimeout: 1 };
    const { result } = renderHook(
      () =>
        useTrainingSession({
          settings: timeoutSettings,
          sessions: [],
          saveSession,
          setTrainingSettingsState,
          showToast,
        }),
      { wrapper: TestWrapper },
    );
    await waitForInitialLoads();

    await act(async () => {
      void result.current.startTraining();
    });

    await waitFor(() => {
      expect(result.current.runtimeStatus).toBe('waitingForAnswer');
    });

    await waitFor(
      () => {
        expect(result.current.showResults).toBe(true);
      },
      { timeout: 2500 },
    );
  });

  it('records every group when the playback loop finishes without submitAnswer', async () => {
    const multiGroupSettings: TrainingSettings = {
      ...sessionSettings,
      numGroups: 3,
      groupTimeout: 1,
    };
    const { result } = renderHook(
      () =>
        useTrainingSession({
          settings: multiGroupSettings,
          sessions: [],
          saveSession,
          setTrainingSettingsState,
          showToast,
        }),
      { wrapper: TestWrapper },
    );
    await waitForInitialLoads();

    await act(async () => {
      void result.current.startTraining();
    });

    await waitFor(() => {
      expect(result.current.runtimeStatus).toBe('waitingForAnswer');
    });

    act(() => {
      result.current.confirmGroupAnswer(0, 'AB');
    });

    await waitFor(() => {
      expect(result.current.currentGroup).toBe(1);
      expect(result.current.runtimeStatus).toBe('waitingForAnswer');
    });

    act(() => {
      result.current.confirmGroupAnswer(1, 'AB');
    });

    await waitFor(() => {
      expect(result.current.currentGroup).toBe(2);
      expect(result.current.runtimeStatus).toBe('waitingForAnswer');
    });

    await waitFor(
      () => {
        expect(result.current.showResults).toBe(true);
      },
      { timeout: 4000 },
    );

    expect(result.current.lastSessionResult?.groups).toHaveLength(3);
    expect(saveSession).toHaveBeenCalledWith(
      expect.objectContaining({
        groups: expect.arrayContaining([
          expect.objectContaining({ sent: 'AB' }),
          expect.objectContaining({ sent: 'AB' }),
          expect.objectContaining({ sent: 'AB' }),
        ]),
      }),
    );
  });

  it('shows toast when saveSession fails after results', async () => {
    saveSession.mockRejectedValueOnce(new Error('Persist failed'));
    const { result } = renderSessionHook();
    await waitForInitialLoads();

    await act(async () => {
      void result.current.startTraining();
    });

    await waitFor(() => {
      expect(result.current.runtimeStatus).toBe('waitingForAnswer');
    });

    act(() => {
      result.current.confirmGroupAnswer(0, 'AB');
    });

    await waitFor(() => {
      expect(result.current.showResults).toBe(true);
    });

    expect(showToast).toHaveBeenCalledWith({
      message: 'Persist failed',
      type: 'error',
    });
  });

  it('applies group auto-level adjust after a perfect session', async () => {
    localStorage.clear();
    const autoSettings: TrainingSettings = {
      ...sessionSettings,
      autoAdjustKoch: true,
      autoAdjustThreshold: 90,
      autoAdjustAboveThresholdCount: 1,
      kochLevel: 4,
    };
    const { result } = renderHook(
      () =>
        useTrainingSession({
          settings: autoSettings,
          sessions: [],
          saveSession,
          setTrainingSettingsState,
          showToast,
        }),
      { wrapper: TestWrapper },
    );
    await waitForInitialLoads();

    await act(async () => {
      void result.current.startTraining();
    });

    await waitFor(() => {
      expect(result.current.runtimeStatus).toBe('waitingForAnswer');
    });

    act(() => {
      result.current.confirmGroupAnswer(0, 'AB');
    });

    await waitFor(() => {
      expect(result.current.showResults).toBe(true);
    });

    expect(setTrainingSettingsState).toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('increased') }),
    );
  });

  it('scrolls focused input into view via inputRefCallback', async () => {
    const scrollIntoView = jest.fn();
    const focus = jest.fn();
    const input = {
      focus,
      scrollIntoView,
      disabled: false,
      tagName: 'INPUT',
    } as unknown as HTMLInputElement;

    const { result } = renderSessionHook();
    await waitForInitialLoads();

    await act(async () => {
      void result.current.startTraining();
    });

    await waitFor(() => {
      expect(result.current.sentGroups.length).toBeGreaterThan(0);
    });

    act(() => {
      result.current.inputRefCallback(0, input);
      result.current.setCurrentFocusedGroup(0);
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
  });

  it('sets audio status to closed when context is closed on pageshow', async () => {
    const mockAudio = createMockAudio();
    mockAudio.audioContextRef.current = {
      state: 'closed',
      resume: jest.fn().mockResolvedValue(undefined),
    } as unknown as AudioContext;
    mockUseTrainingAudio.mockReturnValue(mockAudio);

    const { result } = renderHook(
      () => {
        const session = useTrainingSession({
          settings: sessionSettings,
          sessions: [],
          saveSession,
          setTrainingSettingsState,
          showToast,
        });
        const audioStatus = useAppStore((s) => selectRuntimeAudioStatus(s.groupTrainingRuntime));
        return { ...session, audioStatus };
      },
      { wrapper: TestWrapper },
    );
    await waitForInitialLoads();

    await act(async () => {
      void result.current.startTraining();
    });

    await waitFor(() => {
      expect(result.current.hasActiveSession).toBe(true);
    });

    act(() => {
      window.dispatchEvent(new Event('pageshow'));
    });

    expect(result.current.audioStatus).toBe('closed');

    act(() => {
      result.current.stopTraining();
    });
  });

  // Regression: the single most common training bug. Ending a session (Submit) while its
  // detached playback loop is still awaiting, then starting a new session before that loop
  // unwinds, used to make the stale loop cancel the live session — bouncing the UI back to
  // the home screen while the new session's audio kept playing.
  it('does not bounce to home when a new session starts before a prior loop unwinds', async () => {
    const audio = createMockAudio();
    const playResolvers: Array<() => void> = [];
    jest.mocked(audio.playMorse).mockImplementation(
      () =>
        new Promise((resolve) => {
          playResolvers.push(() => resolve({ status: 'played', durationSec: 0 }));
        }),
    );
    mockUseTrainingAudio.mockReturnValue(audio);

    const { result } = renderSessionHook();
    await waitForInitialLoads();

    // Session A parks awaiting its (deferred) playback.
    await act(async () => {
      void result.current.startTraining();
    });
    await waitFor(() => {
      expect(result.current.runtimeStatus).toBe('playingGroup');
    });
    expect(playResolvers).toHaveLength(1);

    // End session A via Submit while its loop is still awaiting playback.
    await act(async () => {
      result.current.submitAnswer();
    });
    await waitFor(() => {
      expect(result.current.showResults).toBe(true);
    });

    // Session B starts before A's loop has unwound, and parks awaiting its own playback.
    await act(async () => {
      void result.current.startTraining();
    });
    await waitFor(() => {
      expect(result.current.runtimeStatus).toBe('playingGroup');
    });
    expect(playResolvers).toHaveLength(2);

    const stopCallsBeforeStaleUnwind = jest.mocked(audio.stopAudio).mock.calls.length;

    // Now A's stale playback resolves and its loop tail runs against shared state.
    await act(async () => {
      playResolvers[0]?.();
      await Promise.resolve();
    });

    // The stale loop is inert: B's live session survives — no bounce to idle/home...
    expect(result.current.runtimeStatus).toBe('playingGroup');
    expect(result.current.hasActiveSession).toBe(true);
    expect(result.current.showResults).toBe(false);
    // ...and it never tore down the live session's audio.
    expect(jest.mocked(audio.stopAudio).mock.calls.length).toBe(stopCallsBeforeStaleUnwind);

    act(() => {
      result.current.stopTraining();
    });
  });
});
