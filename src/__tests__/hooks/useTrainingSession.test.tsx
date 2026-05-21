jest.mock('@/hooks/useTrainingAudio');

jest.mock('@/lib/trainingSessionGroups', () => ({
  generateTrainingGroup: jest.fn(() => 'AB'),
}));

import { renderHook, act, waitFor } from '@testing-library/react';

import { DEFAULT_TRAINING_SETTINGS } from '@/config/training.config';
import { AUTO_CONFIRM_DELAY_MS } from '@/lib/constants';
import { useTrainingAudio } from '@/hooks/useTrainingAudio';
import { useTrainingSession } from '@/hooks/useTrainingSession';
import type { IcrSessionService } from '@/lib/services/icr-session.service';
import type { SessionService } from '@/lib/services/session.service';
import type { TrainingSettingsService } from '@/lib/services/training-settings.service';
import { AppStoreProvider } from '@/store/providers/app-store-provider';
import type { TrainingSettings } from '@/types';

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

  const renderSessionHook = () =>
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
    failingAudio.playMorse.mockResolvedValue({
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
    });

    expect(result.current.showResults).toBe(false);
    expect(result.current.hasActiveSession).toBe(false);
    expect(saveSession).not.toHaveBeenCalled();
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
});
