jest.mock('@/hooks/useTrainingAudio');

jest.mock('@/lib/morseAudio', () => ({
  playMorseCodeControlled: jest.fn(() =>
    Promise.resolve({ durationSec: 0.01, stop: jest.fn() }),
  ),
  resumeAudioContextFromUserGesture: jest.fn(),
}));

jest.mock('@/lib/trainingSessionGroups', () => ({
  generateTrainingGroup: jest.fn(() => 'A'),
}));

import { renderHook, act, waitFor, type RenderHookResult } from '@testing-library/react';

import { DEFAULT_TRAINING_SETTINGS } from '@/config/training.config';
import { useEchoTrainingSession } from '@/hooks/useEchoTrainingSession';
import { useTrainingAudio } from '@/hooks/useTrainingAudio';
import { MORSE_CODE } from '@/lib/morseConstants';
import type { IcrSessionService } from '@/lib/services/icr-session.service';
import type { SessionService } from '@/lib/services/session.service';
import type { TrainingSettingsService } from '@/lib/services/training-settings.service';
import { generateTrainingGroup } from '@/lib/trainingSessionGroups';
import { AppStoreProvider } from '@/store/providers/app-store-provider';
import type { TrainingSettings } from '@/types';

const mockGenerateTrainingGroup = generateTrainingGroup as jest.MockedFunction<
  typeof generateTrainingGroup
>;

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

const echoSettings: TrainingSettings = {
  ...DEFAULT_TRAINING_SETTINGS,
  numGroups: 1,
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
    playMorse: jest.fn().mockResolvedValue({ status: 'played', durationSec: 0.01 }),
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

function fireKey(
  type: 'keydown' | 'keyup',
  code: string,
  key: string,
  repeat = false,
): void {
  window.dispatchEvent(
    new KeyboardEvent(type, {
      code,
      key,
      bubbles: true,
      cancelable: true,
      repeat,
    }),
  );
}

function tapPaddle(code: string, key: string): void {
  fireKey('keydown', code, key);
  fireKey('keyup', code, key);
}

function sendMorsePattern(pattern: string): void {
  for (const symbol of pattern) {
    if (symbol === '.') {
      tapPaddle('BracketLeft', '{');
    } else if (symbol === '-') {
      tapPaddle('BracketRight', '}');
    }
  }
}

const waitForInitialLoads = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
};

describe('useEchoTrainingSession', () => {
  const saveSession = jest.fn().mockResolvedValue([]);
  const setTrainingSettingsState = jest.fn();
  const showToast = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    mockGenerateTrainingGroup.mockReturnValue('A');
    mockUseTrainingAudio.mockReturnValue(createMockAudio());
    (mockTrainingSettingsService.getSettings as jest.Mock).mockResolvedValue(echoSettings);
    (mockSessionService.listSessions as jest.Mock).mockResolvedValue([]);
    (mockIcrSessionService.listSessions as jest.Mock).mockResolvedValue([]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const renderEchoHook = (): RenderHookResult<
    ReturnType<typeof useEchoTrainingSession>,
    unknown
  > =>
    renderHook(
      () =>
        useEchoTrainingSession({
          settings: echoSettings,
          sessions: [],
          saveSession,
          setTrainingSettingsState,
          showToast,
        }),
      { wrapper: TestWrapper },
    );

  it('starts idle', async () => {
    const { result } = renderEchoHook();
    await waitForInitialLoads();

    expect(result.current.isTraining).toBe(false);
    expect(result.current.showResults).toBe(false);
    expect(result.current.currentCharacterState).toBe('idle');
  });

  it('stopTraining is safe when idle', async () => {
    const { result } = renderEchoHook();
    await waitForInitialLoads();

    act(() => {
      result.current.stopTraining();
    });

    expect(result.current.isTraining).toBe(false);
    expect(result.current.currentCharacterState).toBe('idle');
  });

  it('completes echo session when morse input matches the character', async () => {
    const { result } = renderEchoHook();
    await waitForInitialLoads();

    await act(async () => {
      void result.current.startTraining();
    });

    await waitFor(
      () => {
        expect(result.current.currentCharacterState).toBe('awaiting');
      },
      { timeout: 3000 },
    );

    const pattern = MORSE_CODE['A'];
    expect(pattern).toBe('.-');

    for (const symbol of pattern ?? '') {
      await act(async () => {
        if (symbol === '.') {
          tapPaddle('BracketLeft', '{');
        } else if (symbol === '-') {
          tapPaddle('BracketRight', '}');
        }
        await Promise.resolve();
        await Promise.resolve();
      });
    }

    await waitFor(
      () => {
        expect(result.current.showResults).toBe(true);
      },
      { timeout: 3000 },
    );

    expect(saveSession).toHaveBeenCalled();
    expect(result.current.lastSessionResult?.correctCharacters).toBe(1);
    expect(result.current.correctCharacters).toBe(1);
  });

  it('records incorrect character for invalid morse prefix', async () => {
    const { result } = renderEchoHook();
    await waitForInitialLoads();

    await act(async () => {
      void result.current.startTraining();
    });

    await waitFor(() => {
      expect(result.current.currentCharacterState).toBe('awaiting');
    });

    await act(async () => {
      sendMorsePattern('-');
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.showResults).toBe(true);
    });

    expect(result.current.incorrectCharacters).toBe(1);
    expect(result.current.lastSessionResult?.incorrectCharacters).toBe(1);
  });

  it('stopTraining aborts an in-progress session without results', async () => {
    const { result } = renderEchoHook();
    await waitForInitialLoads();

    await act(async () => {
      void result.current.startTraining();
    });

    await waitFor(() => {
      expect(result.current.isTraining).toBe(true);
    });

    await act(async () => {
      result.current.stopTraining();
      await Promise.resolve();
    });

    expect(result.current.isTraining).toBe(false);
    expect(result.current.showResults).toBe(false);
    expect(saveSession).not.toHaveBeenCalled();
  });

  it('dismissResults clears the results screen', async () => {
    const { result } = renderEchoHook();
    await waitForInitialLoads();

    await act(async () => {
      void result.current.startTraining();
    });

    await waitFor(() => {
      expect(result.current.currentCharacterState).toBe('awaiting');
    });

    const pattern = MORSE_CODE['A'] ?? '';
    for (const symbol of pattern) {
      await act(async () => {
        if (symbol === '.') {
          tapPaddle('BracketLeft', '{');
        } else if (symbol === '-') {
          tapPaddle('BracketRight', '}');
        }
        await Promise.resolve();
      });
    }

    await waitFor(() => {
      expect(result.current.showResults).toBe(true);
    });

    act(() => {
      result.current.dismissResults();
    });

    expect(result.current.showResults).toBe(false);
    expect(result.current.lastSessionResult).toBeNull();
  });

  it('times out awaiting input when groupTimeout elapses', async () => {
    const timeoutSettings: TrainingSettings = { ...echoSettings, groupTimeout: 1 };
    const { result } = renderHook(
      () =>
        useEchoTrainingSession({
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
      expect(result.current.currentCharacterState).toBe('awaiting');
    });

    await waitFor(
      () => {
        expect(result.current.showResults).toBe(true);
      },
      { timeout: 2500 },
    );

    expect(result.current.incorrectCharacters).toBe(1);
  });

  it('shows toast when saveSession fails after results', async () => {
    saveSession.mockRejectedValueOnce(new Error('Cloud save failed'));
    const { result } = renderEchoHook();
    await waitForInitialLoads();

    await act(async () => {
      void result.current.startTraining();
    });

    await waitFor(() => {
      expect(result.current.currentCharacterState).toBe('awaiting');
    });

    for (const symbol of MORSE_CODE['A'] ?? '') {
      await act(async () => {
        if (symbol === '.') tapPaddle('BracketLeft', '{');
        else if (symbol === '-') tapPaddle('BracketRight', '}');
        await Promise.resolve();
      });
    }

    await waitFor(() => {
      expect(result.current.showResults).toBe(true);
    });

    expect(showToast).toHaveBeenCalledWith({
      message: 'Cloud save failed',
      type: 'error',
    });
  });

  it('applies echo auto-level adjust and shows adjustment toast', async () => {
    localStorage.clear();
    const autoSettings: TrainingSettings = {
      ...echoSettings,
      echoAutoAdjustKoch: true,
      echoAutoAdjustThreshold: 90,
      echoAutoAdjustAboveThresholdCount: 0,
      kochLevel: 5,
    };
    const { result } = renderHook(
      () =>
        useEchoTrainingSession({
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
      expect(result.current.currentCharacterState).toBe('awaiting');
    });

    for (const symbol of MORSE_CODE['A'] ?? '') {
      await act(async () => {
        if (symbol === '.') tapPaddle('BracketLeft', '{');
        else if (symbol === '-') tapPaddle('BracketRight', '}');
        await Promise.resolve();
      });
    }

    await waitFor(() => {
      expect(result.current.showResults).toBe(true);
    });

    expect(setTrainingSettingsState).toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'success', message: expect.stringContaining('increased') }),
    );
  });

  it('unmount aborts training and stops audio', async () => {
    const audio = createMockAudio();
    mockUseTrainingAudio.mockReturnValue(audio);
    const { result, unmount } = renderEchoHook();
    await waitForInitialLoads();

    await act(async () => {
      void result.current.startTraining();
    });

    await waitFor(() => {
      expect(result.current.isTraining).toBe(true);
    });

    unmount();

    expect(audio.stopAudio).toHaveBeenCalled();
  });

  it('shows error toast when startTraining throws', async () => {
    mockGenerateTrainingGroup.mockImplementationOnce(() => {
      throw new Error('Group generation failed');
    });
    const { result } = renderEchoHook();
    await waitForInitialLoads();

    await act(async () => {
      await result.current.startTraining();
    });

    expect(showToast).toHaveBeenCalledWith({
      message: 'Echo training error: Group generation failed',
      type: 'error',
    });
    expect(result.current.isTraining).toBe(false);
  });

  it('completes two groups when numGroups is 2', async () => {
    mockGenerateTrainingGroup.mockReturnValue('E');
    const twoGroupSettings: TrainingSettings = { ...echoSettings, numGroups: 2 };
    const { result } = renderHook(
      () =>
        useEchoTrainingSession({
          settings: twoGroupSettings,
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

    for (let group = 0; group < 2; group += 1) {
      await waitFor(() => {
        expect(result.current.currentCharacterState).toBe('awaiting');
      });
      for (const symbol of MORSE_CODE['E'] ?? '') {
        await act(async () => {
          if (symbol === '.') tapPaddle('BracketLeft', '{');
          else if (symbol === '-') tapPaddle('BracketRight', '}');
          await Promise.resolve();
        });
      }
    }

    await waitFor(() => {
      expect(result.current.showResults).toBe(true);
    });

    expect(result.current.lastSessionResult?.correctCharacters).toBe(2);
    expect(mockGenerateTrainingGroup).toHaveBeenCalledTimes(2);
  });

  it('applies digits-mode echo auto-level adjust', async () => {
    localStorage.clear();
    mockGenerateTrainingGroup.mockReturnValue('5');
    const digitsSettings: TrainingSettings = {
      ...echoSettings,
      charSetMode: 'digits',
      digitsLevel: 5,
      echoAutoAdjustKoch: true,
      echoAutoAdjustThreshold: 90,
      echoAutoAdjustAboveThresholdCount: 0,
    };
    const { result } = renderHook(
      () =>
        useEchoTrainingSession({
          settings: digitsSettings,
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
      expect(result.current.currentCharacterState).toBe('awaiting');
    });

    for (const symbol of MORSE_CODE['5'] ?? '') {
      await act(async () => {
        if (symbol === '.') tapPaddle('BracketLeft', '{');
        await Promise.resolve();
      });
    }

    await waitFor(() => {
      expect(result.current.showResults).toBe(true);
    });

    expect(setTrainingSettingsState).toHaveBeenCalledWith(expect.any(Function));
  });

  it('ignores keydown when not training', async () => {
    const { result } = renderEchoHook();
    await waitForInitialLoads();

    act(() => {
      tapPaddle('BracketLeft', '{');
    });

    expect(result.current.currentSymbols).toBe('');
  });

  it('runs iambic keyer timing when both paddles are held', async () => {
    const audio = createMockAudio();
    let keyerTicks = 0;
    jest.mocked(audio.sleepCancelable).mockImplementation(async () => {
      keyerTicks += 1;
      if (keyerTicks >= 2) {
        act(() => {
          fireKey('keyup', 'BracketLeft', '{');
          fireKey('keyup', 'BracketRight', '}');
        });
      }
    });
    mockUseTrainingAudio.mockReturnValue(audio);

    const { result } = renderEchoHook();
    await waitForInitialLoads();

    await act(async () => {
      void result.current.startTraining();
    });

    await waitFor(() => {
      expect(result.current.currentCharacterState).toBe('awaiting');
    });

    act(() => {
      fireKey('keydown', 'BracketLeft', '{');
      fireKey('keydown', 'BracketRight', '}');
    });

    await waitFor(() => {
      expect(keyerTicks).toBeGreaterThanOrEqual(2);
    });
  });

  it('ignores repeated keydown while awaiting input', async () => {
    const { result } = renderEchoHook();
    await waitForInitialLoads();

    await act(async () => {
      void result.current.startTraining();
    });

    await waitFor(() => {
      expect(result.current.currentCharacterState).toBe('awaiting');
    });

    await act(async () => {
      fireKey('keydown', 'BracketLeft', '{', true);
      await Promise.resolve();
    });

    expect(result.current.currentSymbols).toBe('');
  });
});
