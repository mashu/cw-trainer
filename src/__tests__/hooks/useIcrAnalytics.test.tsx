import { renderHook, act, waitFor } from '@testing-library/react';

import { useIcrAnalytics, type IcrAnalyticsSummary } from '@/hooks/useIcrAnalytics';
import { useIcrSessionsActions } from '@/hooks/useIcrSessions';
import type { IcrSessionService } from '@/lib/services/icr-session.service';
import type { SessionService } from '@/lib/services/session.service';
import type { TrainingSettingsService } from '@/lib/services/training-settings.service';
import { AppStoreProvider } from '@/store/providers/app-store-provider';
import type { IcrLetterStats, IcrSessionResult, IcrSettings } from '@/types';

const defaultSettingsSnapshot = {
  audio: {
    kochLevel: 1,
    charWpmMin: 20,
    charWpmMax: 20,
    sideToneMin: 600,
    sideToneMax: 600,
    steepness: 5,
  },
  icr: {
    trialsPerSession: 10,
    trialDelayMs: 500,
    vadEnabled: false,
    vadThreshold: 0.1,
    vadHoldMs: 100,
    bucketGreenMaxMs: 500,
    bucketYellowMaxMs: 1000,
    bucketOrangeMaxMs: 1200,
  } as IcrSettings,
};

function makeSession(overrides: Partial<IcrSessionResult> & { timestamp: number }): IcrSessionResult {
  return {
    date: new Date(overrides.timestamp).toISOString().slice(0, 10),
    trials: [],
    accuracyPercent: 100,
    averageReactionMs: 500,
    perLetter: {},
    settingsSnapshot: defaultSettingsSnapshot,
    ...overrides,
  };
}

function makeLetterStats(correct: number, total: number, averageReactionMs = 500): IcrLetterStats {
  return { correct, total, averageReactionMs };
}

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

const createWrapper = (initialSessions: IcrSessionResult[] = []): React.ComponentType<{ children: React.ReactNode }> => {
  // Note: We can't directly set initial state in AppStoreProvider
  // The store is created internally. For testing, we'll need to use the actions
  // or mock the service to return the initial sessions.
  (mockIcrSessionService.listSessions as jest.Mock).mockResolvedValue(initialSessions);
  return TestWrapper;
};

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

describe('useIcrAnalytics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock services to return immediately to avoid act warnings
    (mockTrainingSettingsService.getSettings as jest.Mock).mockResolvedValue({});
    (mockSessionService.listSessions as jest.Mock).mockResolvedValue([]);
  });

  it('should return default values when no sessions', async () => {
    const wrapper = createWrapper([]);
    let hookResult: { result: { current: IcrAnalyticsSummary } };
    
    await act(async () => {
      hookResult = renderHook(() => useIcrAnalytics(), { wrapper });
    });

    await waitForInitialLoads();

    expect(hookResult!.result.current.totalSessions).toBe(0);
    expect(hookResult!.result.current.totalTrials).toBe(0);
    expect(hookResult!.result.current.averageReactionMs).toBe(0);
    expect(hookResult!.result.current.averageAccuracyPercent).toBe(0);
    expect(hookResult!.result.current.bestLetter).toBeUndefined();
    expect(hookResult!.result.current.needsWorkLetter).toBeUndefined();
    expect(hookResult!.result.current.lastSessionAt).toBeUndefined();
  });

  it('should calculate analytics from sessions', async () => {
    const sessions: IcrSessionResult[] = [
      makeSession({
        timestamp: 1000,
        trials: [{ target: 'A', heardAt: 0, reactionMs: 500, correct: true }],
        accuracyPercent: 100,
        averageReactionMs: 500,
        perLetter: { A: makeLetterStats(1, 1) },
      }),
      makeSession({
        timestamp: 2000,
        trials: [
          { target: 'A', heardAt: 0, reactionMs: 400, correct: true },
          { target: 'B', heardAt: 0, reactionMs: 600, correct: false },
        ],
        accuracyPercent: 50,
        averageReactionMs: 500,
        perLetter: {
          A: makeLetterStats(1, 1),
          B: makeLetterStats(0, 1),
        },
      }),
    ];

    const wrapper = createWrapper(sessions);
    let actionsResult: { result: { current: ReturnType<typeof useIcrSessionsActions> } };
    let hookResult: { result: { current: IcrAnalyticsSummary } };
    
    // Wrap renderHook in act() to handle the initial mount and useEffect
    await act(async () => {
      actionsResult = renderHook(() => useIcrSessionsActions(), { wrapper });
    });
    
    // Wait for AppStoreProvider's initial async loads
    await waitForInitialLoads();
    
    // Load sessions into store
    await act(async () => {
      await actionsResult!.result.current.loadIcrSessions();
    });

    await act(async () => {
      hookResult = renderHook(() => useIcrAnalytics(), { wrapper });
    });

    await waitFor(() => {
      expect(hookResult!.result.current.totalSessions).toBe(2);
    });

    expect(hookResult!.result.current.totalTrials).toBe(3);
    expect(hookResult!.result.current.averageReactionMs).toBe(500); // (500 + 500) / 2
    expect(hookResult!.result.current.averageAccuracyPercent).toBe(75); // (100 + 50) / 2
    expect(hookResult!.result.current.lastSessionAt).toBe(2000);
  });

  it('should identify best letter', async () => {
    const sessions: IcrSessionResult[] = [
      makeSession({
        timestamp: 1000,
        trials: [],
        accuracyPercent: 100,
        averageReactionMs: 500,
        perLetter: {
          A: makeLetterStats(10, 10),
          B: makeLetterStats(8, 10),
          C: makeLetterStats(5, 10),
        },
      }),
    ];

    const wrapper = createWrapper(sessions);
    let actionsResult: { result: { current: ReturnType<typeof useIcrSessionsActions> } };
    let hookResult: { result: { current: IcrAnalyticsSummary } };
    
    // Wrap renderHook in act() to handle the initial mount and useEffect
    await act(async () => {
      actionsResult = renderHook(() => useIcrSessionsActions(), { wrapper });
    });
    
    // Wait for AppStoreProvider's initial async loads
    await waitForInitialLoads();
    
    await act(async () => {
      await actionsResult!.result.current.loadIcrSessions();
    });

    await act(async () => {
      hookResult = renderHook(() => useIcrAnalytics(), { wrapper });
    });

    await waitFor(() => {
      expect(hookResult!.result.current.bestLetter).toBeDefined();
    });

    expect(hookResult!.result.current.bestLetter?.letter).toBe('A');
    expect(hookResult!.result.current.bestLetter?.accuracyPercent).toBe(100);
  });

  it('should identify needs work letter', async () => {
    const sessions: IcrSessionResult[] = [
      makeSession({
        timestamp: 1000,
        trials: [],
        accuracyPercent: 100,
        averageReactionMs: 500,
        perLetter: {
          A: makeLetterStats(10, 10),
          B: makeLetterStats(8, 10),
          C: makeLetterStats(5, 10),
        },
      }),
    ];

    const wrapper = createWrapper(sessions);
    let actionsResult: { result: { current: ReturnType<typeof useIcrSessionsActions> } };
    let hookResult: { result: { current: IcrAnalyticsSummary } };
    
    // Wrap renderHook in act() to handle the initial mount and useEffect
    await act(async () => {
      actionsResult = renderHook(() => useIcrSessionsActions(), { wrapper });
    });
    
    // Wait for AppStoreProvider's initial async loads
    await waitForInitialLoads();
    
    await act(async () => {
      await actionsResult!.result.current.loadIcrSessions();
    });

    await act(async () => {
      hookResult = renderHook(() => useIcrAnalytics(), { wrapper });
    });

    await waitFor(() => {
      expect(hookResult!.result.current.needsWorkLetter).toBeDefined();
    });

    expect(hookResult!.result.current.needsWorkLetter?.letter).toBe('C');
    expect(hookResult!.result.current.needsWorkLetter?.accuracyPercent).toBe(50);
  });

  it('should handle sessions with no letter data', async () => {
    const sessions: IcrSessionResult[] = [makeSession({ timestamp: 1000 })];

    const wrapper = createWrapper(sessions);
    let hookResult: { result: { current: IcrAnalyticsSummary } };
    
    // Wrap renderHook in act() to handle the initial mount and useEffect
    await act(async () => {
      hookResult = renderHook(() => useIcrAnalytics(), { wrapper });
    });
    
    // Wait for AppStoreProvider's initial async loads
    await waitForInitialLoads();

    expect(hookResult!.result.current.bestLetter).toBeUndefined();
    expect(hookResult!.result.current.needsWorkLetter).toBeUndefined();
  });

  it('should round average reaction time', async () => {
    const sessions: IcrSessionResult[] = [
      makeSession({ timestamp: 1000, averageReactionMs: 333.7 }),
      makeSession({ timestamp: 2000, averageReactionMs: 666.3 }),
    ];

    const wrapper = createWrapper(sessions);
    let actionsResult: { result: { current: ReturnType<typeof useIcrSessionsActions> } };
    let hookResult: { result: { current: IcrAnalyticsSummary } };
    
    // Wrap renderHook in act() to handle the initial mount and useEffect
    await act(async () => {
      actionsResult = renderHook(() => useIcrSessionsActions(), { wrapper });
    });
    
    // Wait for AppStoreProvider's initial async loads
    await waitForInitialLoads();
    
    await act(async () => {
      await actionsResult!.result.current.loadIcrSessions();
    });

    await act(async () => {
      hookResult = renderHook(() => useIcrAnalytics(), { wrapper });
    });

    await waitFor(() => {
      expect(hookResult!.result.current.averageReactionMs).toBe(500); // (333.7 + 666.3) / 2 = 500
    });
  });

  it('should round average accuracy percent', async () => {
    const sessions: IcrSessionResult[] = [
      makeSession({ timestamp: 1000, accuracyPercent: 83.3 }),
      makeSession({ timestamp: 2000, accuracyPercent: 86.7 }),
    ];

    const wrapper = createWrapper(sessions);
    let actionsResult: { result: { current: ReturnType<typeof useIcrSessionsActions> } };
    let hookResult: { result: { current: IcrAnalyticsSummary } };
    
    // Wrap renderHook in act() to handle the initial mount and useEffect
    await act(async () => {
      actionsResult = renderHook(() => useIcrSessionsActions(), { wrapper });
    });
    
    // Wait for AppStoreProvider's initial async loads
    await waitForInitialLoads();
    
    await act(async () => {
      await actionsResult!.result.current.loadIcrSessions();
    });

    await act(async () => {
      hookResult = renderHook(() => useIcrAnalytics(), { wrapper });
    });

    await waitFor(() => {
      expect(hookResult!.result.current.averageAccuracyPercent).toBe(85); // (83.3 + 86.7) / 2 = 85
    });
  });
});

