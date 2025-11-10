import { renderHook, waitFor, act } from '@testing-library/react';

import { useSessionsState, useSessionsActions } from '@/hooks/useSessions';
import type { IcrSessionService } from '@/lib/services/icr-session.service';
import type { SessionService } from '@/lib/services/session.service';
import type { TrainingSettingsService } from '@/lib/services/training-settings.service';
import { AppStoreProvider } from '@/store/providers/app-store-provider';
import type { SessionResult } from '@/types';

const mockTrainingSettingsService: TrainingSettingsService = {
  getSettings: jest.fn(),
  saveSettings: jest.fn(),
  patchSettings: jest.fn(),
  resetSettings: jest.fn(),
} as unknown as TrainingSettingsService;

const mockSessionService: SessionService = {
  listSessions: jest.fn(),
  upsertSession: jest.fn(),
  replaceAll: jest.fn(),
  deleteSession: jest.fn(),
  syncPending: jest.fn(),
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

const createWrapper = (): React.ComponentType<{ children: React.ReactNode }> => TestWrapper;

// Helper to wait for AppStoreProvider's initial async loads to complete
const waitForInitialLoads = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await act(async () => {
    await Promise.all([
      Promise.resolve(),
      Promise.resolve(),
      Promise.resolve(),
    ]);
  });
};

const createMockSession = (overrides?: Partial<SessionResult>): SessionResult => ({
  date: '2025-01-01',
  timestamp: Date.now(),
  startedAt: Date.now() - 1000,
  finishedAt: Date.now(),
  groups: [],
  groupTimings: [],
  accuracy: 1,
  letterAccuracy: {},
  alphabetSize: 0,
  avgResponseMs: 0,
  totalChars: 0,
  effectiveAlphabetSize: 0,
  score: 100,
  ...overrides,
});

describe('useSessionsState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock services to return immediately to avoid act warnings
    (mockTrainingSettingsService.getSettings as jest.Mock).mockResolvedValue({});
    (mockSessionService.listSessions as jest.Mock).mockResolvedValue([]);
    (mockIcrSessionService.listSessions as jest.Mock).mockResolvedValue([]);
  });

  it('should return sessions state', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSessionsState(), { wrapper });

    // Wait for AppStoreProvider's initial async loads
    await waitForInitialLoads();

    // Wait for initial load to complete
    await waitFor(() => {
      expect(result.current.sessionsStatus).not.toBe('loading');
    });

    expect(result.current).toHaveProperty('sessions');
    expect(result.current).toHaveProperty('sessionsStatus');
    expect(result.current).toHaveProperty('sessionsSyncing');
  });

  it('should return empty sessions array initially', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSessionsState(), { wrapper });

    // Wait for AppStoreProvider's initial async loads
    await waitForInitialLoads();

    // Wait for initial load to complete
    await waitFor(() => {
      expect(result.current.sessionsStatus).not.toBe('loading');
    });

    expect(result.current.sessions).toEqual([]);
    expect(result.current.sessionsSyncing).toBe(false);
  });
});

describe('useSessionsActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock services to return immediately to avoid act warnings
    (mockTrainingSettingsService.getSettings as jest.Mock).mockResolvedValue({});
    (mockSessionService.listSessions as jest.Mock).mockResolvedValue([]);
    (mockIcrSessionService.listSessions as jest.Mock).mockResolvedValue([]);
  });

  it('should return all action functions', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSessionsActions(), { wrapper });

    // Wait for AppStoreProvider's initial async loads
    await waitForInitialLoads();

    expect(result.current).toHaveProperty('loadSessions');
    expect(result.current).toHaveProperty('saveSession');
    expect(result.current).toHaveProperty('replaceSessions');
    expect(result.current).toHaveProperty('removeSessionByTimestamp');
    expect(result.current).toHaveProperty('syncPendingSessions');
  });

  it('should call loadSessions', async () => {
    const mockSessions = [createMockSession()];
    (mockSessionService.listSessions as jest.Mock).mockResolvedValue(mockSessions);

    const wrapper = createWrapper();
    const { result } = renderHook(() => useSessionsActions(), { wrapper });

    // Wait for AppStoreProvider's initial async loads
    await waitForInitialLoads();

    await act(async () => {
      await result.current.loadSessions();
    });

    expect(mockSessionService.listSessions).toHaveBeenCalled();
  });

  it('should call saveSession', async () => {
    const mockSession = createMockSession();
    const mockSessions = [mockSession];
    (mockSessionService.upsertSession as jest.Mock).mockResolvedValue(mockSessions);

    const wrapper = createWrapper();
    const { result } = renderHook(() => useSessionsActions(), { wrapper });

    // Wait for AppStoreProvider's initial async loads
    await waitForInitialLoads();

    await act(async () => {
      await result.current.saveSession({
        date: mockSession.date,
        timestamp: mockSession.timestamp,
        startedAt: mockSession.startedAt,
        finishedAt: mockSession.finishedAt,
        groups: mockSession.groups,
        groupTimings: mockSession.groupTimings,
        accuracy: mockSession.accuracy,
        letterAccuracy: mockSession.letterAccuracy,
        alphabetSize: mockSession.alphabetSize,
        avgResponseMs: mockSession.avgResponseMs,
        totalChars: mockSession.totalChars,
        effectiveAlphabetSize: mockSession.effectiveAlphabetSize,
        score: mockSession.score,
      });
    });

    expect(mockSessionService.upsertSession).toHaveBeenCalled();
  });

  it('should call replaceSessions', async () => {
    const mockSessions = [createMockSession()];
    (mockSessionService.replaceAll as jest.Mock).mockResolvedValue(mockSessions);

    const wrapper = createWrapper();
    const { result } = renderHook(() => useSessionsActions(), { wrapper });

    // Wait for AppStoreProvider's initial async loads
    await waitForInitialLoads();

    const sessionInput = {
      date: '2025-01-01',
      timestamp: Date.now(),
      startedAt: Date.now() - 1000,
      finishedAt: Date.now(),
      groups: [],
      groupTimings: [],
      accuracy: 1,
      letterAccuracy: {},
      alphabetSize: 0,
      avgResponseMs: 0,
      totalChars: 0,
      effectiveAlphabetSize: 0,
      score: 100,
    };

    await act(async () => {
      await result.current.replaceSessions([sessionInput]);
    });

    expect(mockSessionService.replaceAll).toHaveBeenCalled();
  });

  it('should call removeSessionByTimestamp', async () => {
    const timestamp = Date.now();
    const mockSessions: SessionResult[] = [];
    (mockSessionService.deleteSession as jest.Mock).mockResolvedValue(mockSessions);

    const wrapper = createWrapper();
    const { result } = renderHook(() => useSessionsActions(), { wrapper });

    // Wait for AppStoreProvider's initial async loads
    await waitForInitialLoads();

    await act(async () => {
      await result.current.removeSessionByTimestamp(timestamp);
    });

    expect(mockSessionService.deleteSession).toHaveBeenCalled();
  });

  it('should call syncPendingSessions', async () => {
    const mockSessions = [createMockSession()];
    (mockSessionService.syncPending as jest.Mock).mockResolvedValue(mockSessions);

    const wrapper = createWrapper();
    const { result } = renderHook(() => useSessionsActions(), { wrapper });

    // Wait for AppStoreProvider's initial async loads
    await waitForInitialLoads();

    await act(async () => {
      await result.current.syncPendingSessions();
    });

    expect(mockSessionService.syncPending).toHaveBeenCalled();
  });
});

