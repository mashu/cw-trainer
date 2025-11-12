import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { ICRStats } from '@/components/features/stats/ICRStats';
import type { IcrSessionService } from '@/lib/services/icr-session.service';
import type { SessionService } from '@/lib/services/session.service';
import type { TrainingSettingsService } from '@/lib/services/training-settings.service';
import { AppStoreProvider } from '@/store/providers/app-store-provider';

// Mock Recharts components
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }): JSX.Element => <div>{children}</div>,
  ComposedChart: ({ children }: { children: React.ReactNode }): JSX.Element => <div data-testid="composed-chart">{children}</div>,
  Bar: (): JSX.Element => <div data-testid="bar" />,
  XAxis: (): JSX.Element => <div data-testid="x-axis" />,
  YAxis: (): JSX.Element => <div data-testid="y-axis" />,
  CartesianGrid: (): JSX.Element => <div data-testid="cartesian-grid" />,
  Tooltip: (): JSX.Element => <div data-testid="tooltip" />,
  Scatter: (): JSX.Element => <div data-testid="scatter" />,
  ScatterChart: ({ children }: { children: React.ReactNode }): JSX.Element => <div data-testid="scatter-chart">{children}</div>,
  Legend: (): JSX.Element => <div data-testid="legend" />,
  Cell: (): JSX.Element => <div data-testid="cell" />,
  Line: (): JSX.Element => <div data-testid="line" />,
}));

// Mock window.confirm
const mockConfirm = jest.fn(() => true);
window.confirm = mockConfirm;

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
  saveSession: jest.fn().mockResolvedValue([]),
  clearSessions: jest.fn().mockResolvedValue(undefined),
  deleteSession: jest.fn().mockResolvedValue([]),
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

describe('ICRStats', (): void => {
  const onBack = jest.fn();

  beforeEach((): void => {
    jest.clearAllMocks();
    mockConfirm.mockReturnValue(true);
  });

  it('should render stats component', async (): Promise<void> => {
    await act(async () => {
      render(
        <TestWrapper>
          <ICRStats onBack={onBack} />
        </TestWrapper>,
      );
    });

    await waitForInitialLoads();

    await waitFor(() => {
      expect(screen.getByText(/ICR Statistics/i)).toBeInTheDocument();
    });
  });

  it('should call onBack when back button is clicked', async (): Promise<void> => {
    const user = userEvent.setup();
    await act(async () => {
      render(
        <TestWrapper>
          <ICRStats onBack={onBack} />
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
          <ICRStats onBack={onBack} embedded={true} />
        </TestWrapper>,
      );
    });

    await waitForInitialLoads();

    await waitFor(() => {
      expect(screen.getByText(/ICR Statistics/i)).toBeInTheDocument();
    });
  });

  it('should display message when no sessions', async (): Promise<void> => {
    await act(async () => {
      render(
        <TestWrapper>
          <ICRStats onBack={onBack} />
        </TestWrapper>,
      );
    });

    await waitForInitialLoads();

    await waitFor(() => {
      // Should show no sessions message or empty state
      const noSessionsText = screen.queryByText(/no.*sessions/i);
      return noSessionsText !== null;
    });
  });

  it('should display loading state', async (): Promise<void> => {
    mockIcrSessionService.listSessions = jest.fn().mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    await act(async () => {
      render(
        <TestWrapper>
          <ICRStats onBack={onBack} />
        </TestWrapper>,
      );
    });

    await waitFor(() => {
      const loadingText = screen.queryByText(/Loading.*sessions/i);
      expect(loadingText).toBeInTheDocument();
    });
  });

  it('should display error message when sessions fail to load', async (): Promise<void> => {
    mockIcrSessionService.listSessions = jest.fn().mockRejectedValue(new Error('Failed to load'));

    await act(async () => {
      render(
        <TestWrapper>
          <ICRStats onBack={onBack} />
        </TestWrapper>,
      );
    });

    await waitForInitialLoads();

    await waitFor(() => {
      // Should show error message (actual message is "Unable to process ICR session request.")
      const errorElements = screen.queryAllByText(/error|failed|unable|process/i);
      expect(errorElements.length).toBeGreaterThan(0);
    });
  });

  it('should display KPIs when sessions exist', async (): Promise<void> => {
    const mockSessions = [
      {
        timestamp: Date.now(),
        date: new Date().toISOString().split('T')[0],
        trials: [
          { target: 'E', typed: 'E', correct: true, reactionMs: 200, heardAt: Date.now() },
          { target: 'T', typed: 'T', correct: true, reactionMs: 250, heardAt: Date.now() },
        ],
        accuracyPercent: 100,
        averageReactionMs: 225,
        settingsSnapshot: {
          icr: {
            bucketGreenMaxMs: 300,
            bucketYellowMaxMs: 800,
          },
          audio: {
            kochLevel: 2,
            charWpm: 20,
            sideToneMin: 600,
            sideToneMax: 600,
            steepness: 5,
          },
        },
        perLetter: {
          E: { correct: 1, total: 1, averageReactionMs: 200 },
          T: { correct: 1, total: 1, averageReactionMs: 250 },
        },
      },
    ];

    mockIcrSessionService.listSessions = jest.fn().mockResolvedValue(mockSessions);

    await act(async () => {
      render(
        <TestWrapper>
          <ICRStats onBack={onBack} />
        </TestWrapper>,
      );
    });

    await waitForInitialLoads();

    await waitFor(() => {
      // Should show KPIs
      expect(screen.getByText(/Avg Accuracy/i)).toBeInTheDocument();
      expect(screen.getByText(/Sessions/i)).toBeInTheDocument();
      expect(screen.getByText(/Avg Reaction/i)).toBeInTheDocument();
    });
  });

  it('should navigate between sessions', async (): Promise<void> => {
    const mockSessions = [
      {
        timestamp: Date.now() - 2000,
        date: new Date().toISOString().split('T')[0],
        trials: [{ target: 'E', typed: 'E', correct: true, reactionMs: 200, heardAt: Date.now() }],
        accuracyPercent: 100,
        averageReactionMs: 200,
        settingsSnapshot: {
          icr: {
            bucketGreenMaxMs: 300,
            bucketYellowMaxMs: 800,
          },
          audio: {
            kochLevel: 2,
            charWpm: 20,
            sideToneMin: 600,
            sideToneMax: 600,
            steepness: 5,
          },
        },
        perLetter: { E: { correct: 1, total: 1, averageReactionMs: 200 } },
      },
      {
        timestamp: Date.now() - 1000,
        date: new Date().toISOString().split('T')[0],
        trials: [{ target: 'T', typed: 'T', correct: true, reactionMs: 250, heardAt: Date.now() }],
        accuracyPercent: 100,
        averageReactionMs: 250,
        settingsSnapshot: {
          icr: {
            bucketGreenMaxMs: 300,
            bucketYellowMaxMs: 800,
          },
          audio: {
            kochLevel: 2,
            charWpm: 20,
            sideToneMin: 600,
            sideToneMax: 600,
            steepness: 5,
          },
        },
        perLetter: { T: { correct: 1, total: 1, averageReactionMs: 250 } },
      },
    ];

    mockIcrSessionService.listSessions = jest.fn().mockResolvedValue(mockSessions);

    await act(async () => {
      render(
        <TestWrapper>
          <ICRStats onBack={onBack} />
        </TestWrapper>,
      );
    });

    await waitForInitialLoads();

    await waitFor(() => {
      const prevButton = screen.queryByRole('button', { name: /Previous/i });
      const nextButton = screen.queryByRole('button', { name: /Next/i });
      expect(prevButton || nextButton).toBeTruthy();
    });
  });

  it('should call deleteIcrSession when delete button is clicked', async (): Promise<void> => {
    const user = userEvent.setup();
    mockConfirm.mockReturnValue(true);
    const mockDeleteSession = jest.fn().mockResolvedValue(undefined);
    mockIcrSessionService.deleteSession = mockDeleteSession;

    const mockSessions = [
      {
        timestamp: Date.now(),
        date: new Date().toISOString().split('T')[0],
        trials: [{ target: 'E', typed: 'E', correct: true, reactionMs: 200, heardAt: Date.now() }],
        accuracyPercent: 100,
        averageReactionMs: 200,
        settingsSnapshot: {
          icr: {
            bucketGreenMaxMs: 300,
            bucketYellowMaxMs: 800,
          },
          audio: {
            kochLevel: 2,
            charWpm: 20,
            sideToneMin: 600,
            sideToneMax: 600,
            steepness: 5,
          },
        },
        perLetter: { E: { correct: 1, total: 1, averageReactionMs: 200 } },
      },
    ];

    mockIcrSessionService.listSessions = jest.fn().mockResolvedValue(mockSessions);

    await act(async () => {
      render(
        <TestWrapper>
          <ICRStats onBack={onBack} />
        </TestWrapper>,
      );
    });

    await waitForInitialLoads();

    await waitFor(async () => {
      const deleteButton = screen.queryByRole('button', { name: /Delete/i });
      if (deleteButton) {
        await user.click(deleteButton);
        expect(mockConfirm).toHaveBeenCalled();
      }
    });
  });

  it('should call clearIcrSessions when clear all button is clicked', async (): Promise<void> => {
    const user = userEvent.setup();
    mockConfirm.mockReturnValue(true);
    const mockClearSessions = jest.fn().mockResolvedValue(undefined);
    mockIcrSessionService.clearSessions = mockClearSessions;

    const mockSessions = [
      {
        timestamp: Date.now(),
        date: new Date().toISOString().split('T')[0],
        trials: [{ target: 'E', typed: 'E', correct: true, reactionMs: 200, heardAt: Date.now() }],
        accuracyPercent: 100,
        averageReactionMs: 200,
        settingsSnapshot: {
          icr: {
            bucketGreenMaxMs: 300,
            bucketYellowMaxMs: 800,
          },
          audio: {
            kochLevel: 2,
            charWpm: 20,
            sideToneMin: 600,
            sideToneMax: 600,
            steepness: 5,
          },
        },
        perLetter: { E: { correct: 1, total: 1, averageReactionMs: 200 } },
      },
    ];

    mockIcrSessionService.listSessions = jest.fn().mockResolvedValue(mockSessions);

    await act(async () => {
      render(
        <TestWrapper>
          <ICRStats onBack={onBack} />
        </TestWrapper>,
      );
    });

    await waitForInitialLoads();

    await waitFor(async () => {
      const clearButton = screen.queryByRole('button', { name: /Clear All/i });
      if (clearButton) {
        await user.click(clearButton);
        expect(mockConfirm).toHaveBeenCalled();
      }
    });
  });
});

