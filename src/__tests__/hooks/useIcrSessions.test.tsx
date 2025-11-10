import { renderHook, waitFor, act } from '@testing-library/react';

import { useIcrSessionsState, useIcrSessionsActions } from '@/hooks/useIcrSessions';
import type { IcrSessionService } from '@/lib/services/icr-session.service';
import type { SessionService } from '@/lib/services/session.service';
import type { TrainingSettingsService } from '@/lib/services/training-settings.service';
import { AppStoreProvider } from '@/store/providers/app-store-provider';
import type { IcrSessionResult } from '@/types';

const mockTrainingSettingsService: TrainingSettingsService = {
  getSettings: jest.fn(),
  saveSettings: jest.fn(),
  patchSettings: jest.fn(),
  resetSettings: jest.fn(),
} as unknown as TrainingSettingsService;

const mockSessionService: SessionService = {
  listSessions: jest.fn(),
  upsertSession: jest.fn(),
  deleteSession: jest.fn(),
  syncPendingSessions: jest.fn(),
};

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

const createMockIcrSession = (overrides?: Partial<IcrSessionResult>): IcrSessionResult => ({
  timestamp: Date.now(),
  trials: [],
  accuracyPercent: 100,
  averageReactionMs: 500,
  perLetter: {},
  ...overrides,
});

describe('useIcrSessionsState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock services to return immediately to avoid act warnings
    (mockTrainingSettingsService.getSettings as jest.Mock).mockResolvedValue({});
    (mockSessionService.listSessions as jest.Mock).mockResolvedValue([]);
    (mockIcrSessionService.listSessions as jest.Mock).mockResolvedValue([]);
  });

  it('should return ICR sessions state', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useIcrSessionsState(), { wrapper });

    // Wait for AppStoreProvider's initial async loads
    await waitForInitialLoads();

    // Wait for initial load to complete
    await waitFor(() => {
      expect(result.current.icrSessionsStatus).not.toBe('loading');
    });

    expect(result.current).toHaveProperty('icrSessions');
    expect(result.current).toHaveProperty('icrSessionsStatus');
    expect(result.current).toHaveProperty('icrSessionsSaving');
  });

  it('should return empty sessions array initially', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useIcrSessionsState(), { wrapper });

    // Wait for AppStoreProvider's initial async loads
    await waitForInitialLoads();

    // Wait for initial load to complete
    await waitFor(() => {
      expect(result.current.icrSessionsStatus).not.toBe('loading');
    });

    expect(result.current.icrSessions).toEqual([]);
    expect(result.current.icrSessionsSaving).toBe(false);
  });
});

describe('useIcrSessionsActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock services to return immediately to avoid act warnings
    (mockTrainingSettingsService.getSettings as jest.Mock).mockResolvedValue({});
    (mockSessionService.listSessions as jest.Mock).mockResolvedValue([]);
    (mockIcrSessionService.listSessions as jest.Mock).mockResolvedValue([]);
  });

  it('should return all action functions', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useIcrSessionsActions(), { wrapper });

    // Wait for AppStoreProvider's initial async loads
    await waitForInitialLoads();

    expect(result.current).toHaveProperty('loadIcrSessions');
    expect(result.current).toHaveProperty('saveIcrSession');
    expect(result.current).toHaveProperty('clearIcrSessions');
    expect(result.current).toHaveProperty('deleteIcrSession');
  });

  it('should call loadIcrSessions', async () => {
    const mockSessions = [createMockIcrSession()];
    (mockIcrSessionService.listSessions as jest.Mock).mockResolvedValue(mockSessions);

    const wrapper = createWrapper();
    const { result } = renderHook(() => useIcrSessionsActions(), { wrapper });

    // Wait for AppStoreProvider's initial async loads
    await waitForInitialLoads();

    await act(async () => {
      await result.current.loadIcrSessions();
    });

    expect(mockIcrSessionService.listSessions).toHaveBeenCalled();
  });

  it('should call saveIcrSession', async () => {
    const mockSession = createMockIcrSession();
    const mockSessions = [mockSession];
    (mockIcrSessionService.saveSession as jest.Mock).mockResolvedValue(mockSessions);

    const wrapper = createWrapper();
    const { result } = renderHook(() => useIcrSessionsActions(), { wrapper });

    // Wait for AppStoreProvider's initial async loads
    await waitForInitialLoads();

    await act(async () => {
      await result.current.saveIcrSession(mockSession);
    });

    expect(mockIcrSessionService.saveSession).toHaveBeenCalledWith(mockSession);
  });

  it('should call clearIcrSessions', async () => {
    (mockIcrSessionService.clearSessions as jest.Mock).mockResolvedValue(undefined);

    const wrapper = createWrapper();
    const { result } = renderHook(() => useIcrSessionsActions(), { wrapper });

    // Wait for AppStoreProvider's initial async loads
    await waitForInitialLoads();

    await act(async () => {
      await result.current.clearIcrSessions();
    });

    expect(mockIcrSessionService.clearSessions).toHaveBeenCalled();
  });

  it('should call deleteIcrSession', async () => {
    const timestamp = Date.now();
    const mockSessions: IcrSessionResult[] = [];
    (mockIcrSessionService.deleteSession as jest.Mock).mockResolvedValue(mockSessions);

    const wrapper = createWrapper();
    const { result } = renderHook(() => useIcrSessionsActions(), { wrapper });

    // Wait for AppStoreProvider's initial async loads
    await waitForInitialLoads();

    await act(async () => {
      await result.current.deleteIcrSession(timestamp);
    });

    expect(mockIcrSessionService.deleteSession).toHaveBeenCalledWith(timestamp);
  });
});

