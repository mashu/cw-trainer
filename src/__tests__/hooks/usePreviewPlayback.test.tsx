import { renderHook, act } from '@testing-library/react';

import { usePreviewPlayback } from '@/hooks/usePreviewPlayback';
import type { IcrSessionService } from '@/lib/services/icr-session.service';
import type { SessionService } from '@/lib/services/session.service';
import type { TrainingSettingsService } from '@/lib/services/training-settings.service';
import { useAppStore } from '@/store';
import { AppStoreProvider } from '@/store/providers/app-store-provider';
import { selectTrainingSessionActive } from '@/store/selectors';

const mockTrainingSettingsService = {
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

describe('usePreviewPlayback', () => {
  it('releases blocking sync on unmount when playback was started', () => {
    const { result, unmount } = renderHook(
      () => ({
        playback: usePreviewPlayback('text-player'),
        sessionActive: useAppStore(selectTrainingSessionActive),
      }),
      { wrapper: TestWrapper },
    );

    act(() => {
      result.current.playback.startPlayback();
    });

    expect(result.current.sessionActive).toBe(true);

    unmount();

    const { result: afterUnmount } = renderHook(
      () => useAppStore(selectTrainingSessionActive),
      { wrapper: TestWrapper },
    );
    expect(afterUnmount.current).toBe(false);
  });

  it('stopPlayback is idempotent', () => {
    const { result } = renderHook(
      () => ({
        playback: usePreviewPlayback('letter-preview'),
        sessionActive: useAppStore(selectTrainingSessionActive),
      }),
      { wrapper: TestWrapper },
    );

    act(() => {
      result.current.playback.startPlayback();
      result.current.playback.stopPlayback();
      result.current.playback.stopPlayback();
    });

    expect(result.current.sessionActive).toBe(false);
  });
});

describe('cancelAncillaryTrainingRuntimes', () => {
  it('clears preview playback and ICR blocking state', () => {
    const { result } = renderHook(
      () => ({
        beginPreviewPlayback: useAppStore((s) => s.beginPreviewPlayback),
        beginIcrTrainingSession: useAppStore((s) => s.beginIcrTrainingSession),
        cancelAncillaryTrainingRuntimes: useAppStore((s) => s.cancelAncillaryTrainingRuntimes),
        sessionActive: useAppStore(selectTrainingSessionActive),
        previewPlaybackRuntime: useAppStore((s) => s.previewPlaybackRuntime),
        icrTrainingRuntime: useAppStore((s) => s.icrTrainingRuntime),
      }),
      { wrapper: TestWrapper },
    );

    act(() => {
      result.current.beginPreviewPlayback('letter-preview');
      result.current.beginIcrTrainingSession({ sessionId: 1 });
    });

    expect(result.current.sessionActive).toBe(true);

    act(() => {
      result.current.cancelAncillaryTrainingRuntimes();
    });

    expect(result.current.previewPlaybackRuntime.status).toBe('idle');
    expect(result.current.icrTrainingRuntime.status).toBe('idle');
    expect(result.current.sessionActive).toBe(false);
  });
});
