import { renderHook, act, waitFor } from '@testing-library/react';

import { useIcrAnalytics } from '@/hooks/useIcrAnalytics';
import { useIcrSessionsActions } from '@/hooks/useIcrSessions';
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
    let hookResult: ReturnType<typeof renderHook>;
    
    // Wrap renderHook in act() to handle the initial mount and useEffect
    await act(async () => {
      hookResult = renderHook(() => useIcrAnalytics(), { wrapper });
    });

    // Wait for AppStoreProvider's initial async loads to complete
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
      {
        timestamp: 1000,
        trials: [{ letter: 'A', reactionMs: 500, correct: true }],
        accuracyPercent: 100,
        averageReactionMs: 500,
        perLetter: { A: { correct: 1, total: 1 } },
      },
      {
        timestamp: 2000,
        trials: [
          { letter: 'A', reactionMs: 400, correct: true },
          { letter: 'B', reactionMs: 600, correct: false },
        ],
        accuracyPercent: 50,
        averageReactionMs: 500,
        perLetter: {
          A: { correct: 1, total: 1 },
          B: { correct: 0, total: 1 },
        },
      },
    ];

    const wrapper = createWrapper(sessions);
    let actionsResult: ReturnType<typeof renderHook>;
    let hookResult: ReturnType<typeof renderHook>;
    
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
      {
        timestamp: 1000,
        trials: [],
        accuracyPercent: 100,
        averageReactionMs: 500,
        perLetter: {
          A: { correct: 10, total: 10 },
          B: { correct: 8, total: 10 },
          C: { correct: 5, total: 10 },
        },
      },
    ];

    const wrapper = createWrapper(sessions);
    let actionsResult: ReturnType<typeof renderHook>;
    let hookResult: ReturnType<typeof renderHook>;
    
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
      {
        timestamp: 1000,
        trials: [],
        accuracyPercent: 100,
        averageReactionMs: 500,
        perLetter: {
          A: { correct: 10, total: 10 },
          B: { correct: 8, total: 10 },
          C: { correct: 5, total: 10 },
        },
      },
    ];

    const wrapper = createWrapper(sessions);
    let actionsResult: ReturnType<typeof renderHook>;
    let hookResult: ReturnType<typeof renderHook>;
    
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
    const sessions: IcrSessionResult[] = [
      {
        timestamp: 1000,
        trials: [],
        accuracyPercent: 100,
        averageReactionMs: 500,
        perLetter: {},
      },
    ];

    const wrapper = createWrapper(sessions);
    let hookResult: ReturnType<typeof renderHook>;
    
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
      {
        timestamp: 1000,
        trials: [],
        accuracyPercent: 100,
        averageReactionMs: 333.7,
        perLetter: {},
      },
      {
        timestamp: 2000,
        trials: [],
        accuracyPercent: 100,
        averageReactionMs: 666.3,
        perLetter: {},
      },
    ];

    const wrapper = createWrapper(sessions);
    let actionsResult: ReturnType<typeof renderHook>;
    let hookResult: ReturnType<typeof renderHook>;
    
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
      {
        timestamp: 1000,
        trials: [],
        accuracyPercent: 83.3,
        averageReactionMs: 500,
        perLetter: {},
      },
      {
        timestamp: 2000,
        trials: [],
        accuracyPercent: 86.7,
        averageReactionMs: 500,
        perLetter: {},
      },
    ];

    const wrapper = createWrapper(sessions);
    let actionsResult: ReturnType<typeof renderHook>;
    let hookResult: ReturnType<typeof renderHook>;
    
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

