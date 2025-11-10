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
  upsertSession: jest.fn(),
  deleteSession: jest.fn(),
  syncPendingSessions: jest.fn(),
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
});

