import { renderHook, act } from '@testing-library/react';
import { useEffect, useRef } from 'react';

import { DEFAULT_TRAINING_SETTINGS } from '@/config/training.config';
import { useSettingsAutoSave } from '@/hooks/useSettingsAutoSave';
import { AUTO_SAVE_DELAY_MS } from '@/lib/constants';
import type { IcrSessionService } from '@/lib/services/icr-session.service';
import type { SessionService } from '@/lib/services/session.service';
import type { TrainingSettingsService } from '@/lib/services/training-settings.service';
import { useAppStore } from '@/store';
import { AppStoreProvider } from '@/store/providers/app-store-provider';
import type { TrainingSettings } from '@/types';

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

function LockedWrapper({ children }: { children: React.ReactNode }): JSX.Element {
  const acquire = useAppStore((s) => s.acquireTrainingSessionLock);
  const acquiredRef = useRef(false);
  if (!acquiredRef.current) {
    acquiredRef.current = true;
    acquire();
  }

  return <>{children}</>;
}

const waitForInitialLoads = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
};

describe('useSettingsAutoSave', () => {
  const baseSettings: TrainingSettings = {
    ...DEFAULT_TRAINING_SETTINGS,
    kochLevel: 3,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    (mockTrainingSettingsService.getSettings as jest.Mock).mockResolvedValue(baseSettings);
    (mockSessionService.listSessions as jest.Mock).mockResolvedValue([]);
    (mockIcrSessionService.listSessions as jest.Mock).mockResolvedValue([]);
  });

  afterEach(() => {
    jest.useRealTimers();
    const releaseLock = renderHook(() => useAppStore((s) => s.releaseTrainingSessionLock), {
      wrapper: TestWrapper,
    }).result.current;
    act(() => {
      releaseLock();
    });
  });

  it('debounces auto-save when settings change', async () => {
    jest.useFakeTimers();
    const saveTrainingSettings = jest.fn().mockResolvedValue(baseSettings);
    const showToast = jest.fn();

    const { rerender } = renderHook(
      ({ settings }: { settings: TrainingSettings }) =>
        useSettingsAutoSave({
          settings,
          trainingSettingsStatus: 'ready',
          saveTrainingSettings,
          firebaseServices: null,
          firebaseUserUid: undefined,
          showToast,
        }),
      {
        wrapper: TestWrapper,
        initialProps: { settings: baseSettings },
      },
    );

    await act(async () => {
      jest.advanceTimersByTime(50);
      await Promise.resolve();
    });

    rerender({ settings: { ...baseSettings, kochLevel: 5 } });

    expect(saveTrainingSettings).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(AUTO_SAVE_DELAY_MS);
      await Promise.resolve();
    });

    expect(saveTrainingSettings).toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Settings synced locally', type: 'info' }),
    );
  });

  it('skips debounced auto-save while training session is active', async () => {
    jest.useFakeTimers();
    const saveTrainingSettings = jest.fn().mockResolvedValue(baseSettings);
    const showToast = jest.fn();

    const wrapper = ({ children }: { children: React.ReactNode }): JSX.Element => (
      <TestWrapper>
        <LockedWrapper>{children}</LockedWrapper>
      </TestWrapper>
    );

    const { rerender } = renderHook(
      ({ settings }: { settings: TrainingSettings }) =>
        useSettingsAutoSave({
          settings,
          trainingSettingsStatus: 'ready',
          saveTrainingSettings,
          firebaseServices: null,
          firebaseUserUid: undefined,
          showToast,
        }),
      { wrapper, initialProps: { settings: baseSettings } },
    );

    await act(async () => {
      jest.advanceTimersByTime(50);
      await Promise.resolve();
    });

    saveTrainingSettings.mockClear();
    rerender({ settings: { ...baseSettings, kochLevel: 7 } });

    await act(async () => {
      jest.advanceTimersByTime(AUTO_SAVE_DELAY_MS + 100);
      await Promise.resolve();
    });

    expect(saveTrainingSettings).not.toHaveBeenCalled();
  });

  it('manual save still persists during active session but suppresses toast', async () => {
    const saveTrainingSettings = jest.fn().mockResolvedValue(baseSettings);
    const showToast = jest.fn();

    const wrapper = ({ children }: { children: React.ReactNode }): JSX.Element => (
      <TestWrapper>
        <LockedWrapper>{children}</LockedWrapper>
      </TestWrapper>
    );

    const { result } = renderHook(
      () =>
        useSettingsAutoSave({
          settings: baseSettings,
          trainingSettingsStatus: 'ready',
          saveTrainingSettings,
          firebaseServices: null,
          firebaseUserUid: undefined,
          showToast,
        }),
      { wrapper },
    );

    await waitForInitialLoads();

    await act(async () => {
      await result.current.saveSettings({ source: 'manual' });
    });

    expect(saveTrainingSettings).toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });

  it('manual save shows cloud sync message when Firebase user is present', async () => {
    const saved = { ...baseSettings, kochLevel: 4 };
    const saveTrainingSettings = jest.fn().mockResolvedValue(saved);
    const showToast = jest.fn();

    const { result } = renderHook(() =>
      useSettingsAutoSave({
        settings: baseSettings,
        trainingSettingsStatus: 'ready',
        saveTrainingSettings,
        firebaseServices: { db: {}, auth: {} },
        firebaseUserUid: 'uid-1',
        showToast,
      }),
      { wrapper: TestWrapper },
    );

    await waitForInitialLoads();

    await act(async () => {
      await result.current.saveSettings({ source: 'manual' });
    });

    expect(saveTrainingSettings).toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith({
      message: 'Settings saved',
      type: 'success',
    });
  });

  it('shows error toast when save fails', async () => {
    const saveTrainingSettings = jest.fn().mockRejectedValue(new Error('Save failed'));
    const showToast = jest.fn();

    const { result } = renderHook(() =>
      useSettingsAutoSave({
        settings: baseSettings,
        trainingSettingsStatus: 'ready',
        saveTrainingSettings,
        firebaseServices: null,
        firebaseUserUid: undefined,
        showToast,
      }),
      { wrapper: TestWrapper },
    );

    await waitForInitialLoads();

    await act(async () => {
      await result.current.saveSettings();
    });

    expect(showToast).toHaveBeenCalledWith({
      message: 'Save failed',
      type: 'error',
    });
  });
});
