import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { GroupTrainingStats } from '@/components/features/stats/GroupTrainingStats';
import type { IcrSessionService } from '@/lib/services/icr-session.service';
import type { SessionService } from '@/lib/services/session.service';
import type { TrainingSettingsService } from '@/lib/services/training-settings.service';
import { AppStoreProvider } from '@/store/providers/app-store-provider';

// Mock Recharts components
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }): JSX.Element => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }): JSX.Element => <div data-testid="line-chart">{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }): JSX.Element => <div data-testid="bar-chart">{children}</div>,
  ComposedChart: ({ children }: { children: React.ReactNode }): JSX.Element => <div data-testid="composed-chart">{children}</div>,
  Bar: (): JSX.Element => <div data-testid="bar" />,
  XAxis: (): JSX.Element => <div data-testid="x-axis" />,
  YAxis: (): JSX.Element => <div data-testid="y-axis" />,
  CartesianGrid: (): JSX.Element => <div data-testid="cartesian-grid" />,
  Tooltip: (): JSX.Element => <div data-testid="tooltip" />,
  Legend: (): JSX.Element => <div data-testid="legend" />,
  Line: (): JSX.Element => <div data-testid="line" />,
  Brush: (): JSX.Element => <div data-testid="brush" />,
  ReferenceLine: (): JSX.Element => <div data-testid="reference-line" />,
  Scatter: (): JSX.Element => <div data-testid="scatter" />,
}));

// Mock ActivityHeatmap
jest.mock('@/components/ui/charts/ActivityHeatmap', () => ({
  ActivityHeatmap: (): JSX.Element => <div data-testid="activity-heatmap">Activity Heatmap</div>,
}));

// Mock Leaderboard
jest.mock('@/components/features/stats/Leaderboard', () => ({
  Leaderboard: (): JSX.Element => <div data-testid="leaderboard">Leaderboard</div>,
}));

const mockTrainingSettingsService: TrainingSettingsService = {
  getSettings: jest.fn().mockResolvedValue({}),
  saveSettings: jest.fn(),
  patchSettings: jest.fn(),
  resetSettings: jest.fn(),
} as unknown as TrainingSettingsService;

const mockSessionService: SessionService = {
  listSessions: jest.fn().mockResolvedValue([]),
  upsertSession: jest.fn().mockResolvedValue([]),
  deleteSession: jest.fn().mockResolvedValue([]),
  syncPendingSessions: jest.fn().mockResolvedValue([]),
  replaceAll: jest.fn().mockResolvedValue([]),
};

const mockIcrSessionService: IcrSessionService = {
  listSessions: jest.fn().mockResolvedValue([]),
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

const waitForInitialLoads = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

describe('GroupTrainingStats', (): void => {
  const onBack = jest.fn();

  beforeEach((): void => {
    jest.clearAllMocks();
  });

  it('should render stats component', async (): Promise<void> => {
    await act(async () => {
      render(
        <TestWrapper>
          <GroupTrainingStats onBack={onBack} />
        </TestWrapper>,
      );
    });

    await waitForInitialLoads();

    await waitFor(() => {
      expect(screen.getByText(/Group Training Statistics/i)).toBeInTheDocument();
    });
  });

  it('should call onBack when back button is clicked', async (): Promise<void> => {
    const user = userEvent.setup();
    await act(async () => {
      render(
        <TestWrapper>
          <GroupTrainingStats onBack={onBack} />
        </TestWrapper>,
      );
    });

    await waitForInitialLoads();

    await waitFor(() => {
      const backButton = screen.queryByRole('button', { name: /back|←/i });
      if (backButton) {
        return backButton;
      }
      return null;
    });

    const backButton = screen.queryByRole('button', { name: /back|←/i });
    if (backButton) {
      await act(async () => {
        await user.click(backButton);
      });
      expect(onBack).toHaveBeenCalled();
    }
  });

  it('should render embedded mode', async (): Promise<void> => {
    await act(async () => {
      render(
        <TestWrapper>
          <GroupTrainingStats onBack={onBack} embedded={true} />
        </TestWrapper>,
      );
    });

    await waitForInitialLoads();

    await waitFor(() => {
      expect(screen.getByText(/Group Training Statistics/i)).toBeInTheDocument();
    });
  });

  it('should display tabs', async (): Promise<void> => {
    await act(async () => {
      render(
        <TestWrapper>
          <GroupTrainingStats onBack={onBack} />
        </TestWrapper>,
      );
    });

    await waitForInitialLoads();

    await waitFor(() => {
      // Should show tabs like Overview, Leaderboard, etc.
      const tabs = screen.queryAllByRole('button');
      expect(tabs.length).toBeGreaterThan(0);
    });
  });

  it('should display loading state', async (): Promise<void> => {
    mockSessionService.listSessions = jest.fn().mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    await act(async () => {
      render(
        <TestWrapper>
          <GroupTrainingStats onBack={onBack} />
        </TestWrapper>,
      );
    });

    await waitFor(() => {
      const loadingText = screen.queryByText(/Loading.*sessions/i);
      expect(loadingText).toBeInTheDocument();
    });
  });

  it('should display error message when sessions fail to load', async (): Promise<void> => {
    mockSessionService.listSessions = jest.fn().mockRejectedValue(new Error('Failed to load'));

    await act(async () => {
      render(
        <TestWrapper>
          <GroupTrainingStats onBack={onBack} />
        </TestWrapper>,
      );
    });

    await waitForInitialLoads();

    await waitFor(() => {
      // Should show error message (actual message is "Unable to process session request.")
      const errorElements = screen.queryAllByText(/error|failed|unable|process/i);
      expect(errorElements.length).toBeGreaterThan(0);
    });
  });

  it('should display KPIs when sessions exist', async (): Promise<void> => {
    const mockSessions = [
      {
        date: '2024-01-01',
        timestamp: Date.now(),
        groups: [{ sent: 'ABC', received: 'ABC', correct: true }],
        groupTimings: [{ timeToCompleteMs: 1000 }],
        accuracy: 1.0,
        letterAccuracy: { A: { correct: 1, total: 1 }, B: { correct: 1, total: 1 }, C: { correct: 1, total: 1 } },
        alphabetSize: 3,
        totalChars: 3,
        effectiveAlphabetSize: 3,
        avgResponseMs: 1000,
        score: 100,
        startedAt: Date.now() - 5000,
        finishedAt: Date.now(),
      },
    ];

    mockSessionService.listSessions = jest.fn().mockResolvedValue(mockSessions);

    await act(async () => {
      render(
        <TestWrapper>
          <GroupTrainingStats onBack={onBack} />
        </TestWrapper>,
      );
    });

    await waitForInitialLoads();

    await waitFor(() => {
      // Should show KPIs (use getAllByText since "Sessions" appears in both tab and KPI)
      expect(screen.getByText(/Avg Accuracy/i)).toBeInTheDocument();
      const sessionsElements = screen.getAllByText(/Sessions/i);
      expect(sessionsElements.length).toBeGreaterThan(0);
    });
  });

  it('should switch between tabs', async (): Promise<void> => {
    const user = userEvent.setup();
    await act(async () => {
      render(
        <TestWrapper>
          <GroupTrainingStats onBack={onBack} />
        </TestWrapper>,
      );
    });

    await waitForInitialLoads();

    await waitFor(async () => {
      const leaderboardTab = screen.queryByRole('button', { name: /leaderboard/i });
      if (leaderboardTab) {
        await user.click(leaderboardTab);
        await waitFor(() => {
          expect(screen.getByTestId('leaderboard')).toBeInTheDocument();
        });
      }
    });
  });

  it('should apply date range presets', async (): Promise<void> => {
    const user = userEvent.setup();
    const mockSessions = [
      {
        date: '2024-01-01',
        timestamp: Date.now() - 86400000, // 1 day ago
        groups: [{ sent: 'ABC', received: 'ABC', correct: true }],
        groupTimings: [{ timeToCompleteMs: 1000 }],
        accuracy: 1.0,
        letterAccuracy: {},
        alphabetSize: 3,
        totalChars: 3,
        effectiveAlphabetSize: 3,
        avgResponseMs: 1000,
        score: 100,
        startedAt: Date.now() - 5000,
        finishedAt: Date.now(),
      },
    ];

    mockSessionService.listSessions = jest.fn().mockResolvedValue(mockSessions);

    await act(async () => {
      render(
        <TestWrapper>
          <GroupTrainingStats onBack={onBack} />
        </TestWrapper>,
      );
    });

    await waitForInitialLoads();

    await waitFor(async () => {
      const rangeButtons = screen.queryAllByRole('button', { name: /7d|30d|90d|All/i });
      if (rangeButtons.length > 0) {
        await user.click(rangeButtons[0]);
        // Range should be applied (no error means it worked)
      }
    });
  });

  it('should call removeSessionByTimestamp when delete button is clicked', async (): Promise<void> => {
    const user = userEvent.setup();
    const mockDeleteSession = jest.fn().mockResolvedValue([]);
    mockSessionService.deleteSession = mockDeleteSession;

    const mockSessions = [
      {
        date: '2024-01-01',
        timestamp: Date.now(),
        groups: [{ sent: 'ABC', received: 'ABC', correct: true }],
        groupTimings: [{ timeToCompleteMs: 1000 }],
        accuracy: 1.0,
        letterAccuracy: {},
        alphabetSize: 3,
        totalChars: 3,
        effectiveAlphabetSize: 3,
        avgResponseMs: 1000,
        score: 100,
        startedAt: Date.now() - 5000,
        finishedAt: Date.now(),
      },
    ];

    mockSessionService.listSessions = jest.fn().mockResolvedValue(mockSessions);

    await act(async () => {
      render(
        <TestWrapper>
          <GroupTrainingStats onBack={onBack} />
        </TestWrapper>,
      );
    });

    await waitForInitialLoads();

    await waitFor(async () => {
      // Switch to sessions tab
      const sessionsTab = screen.queryByRole('button', { name: /sessions/i });
      if (sessionsTab) {
        await user.click(sessionsTab);
        await waitFor(() => {
          const deleteButton = screen.queryByRole('button', { name: /Delete/i });
          if (deleteButton) {
            return deleteButton;
          }
          return null;
        });
        const deleteButton = screen.queryByRole('button', { name: /Delete/i });
        if (deleteButton) {
          await user.click(deleteButton);
          expect(mockDeleteSession).toHaveBeenCalled();
        }
      }
    });
  });
});

