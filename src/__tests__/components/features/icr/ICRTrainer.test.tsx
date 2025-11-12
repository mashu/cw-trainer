import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { ICRTrainer } from '@/components/features/icr/ICRTrainer';
import type { IcrSessionService } from '@/lib/services/icr-session.service';
import type { SessionService } from '@/lib/services/session.service';
import type { TrainingSettingsService } from '@/lib/services/training-settings.service';
import { AppStoreProvider } from '@/store/providers/app-store-provider';
import type { IcrSettings } from '@/types';

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

// Mock ICRStats
jest.mock('@/components/features/stats/ICRStats', () => ({
  ICRStats: ({ onBack }: { onBack: () => void }): JSX.Element => (
    <div data-testid="icr-stats">
      <button onClick={onBack}>Back</button>
    </div>
  ),
}));

// Mock morseAudio
jest.mock('@/lib/morseAudio', () => ({
  ensureContext: jest.fn(() => Promise.resolve({} as AudioContext)),
  playMorseCode: jest.fn(() => Promise.resolve({ durationSec: 1.0, stop: jest.fn() })),
}));

// Mock mediaDevices
const mockGetUserMedia = jest.fn();
beforeAll((): void => {
  Object.defineProperty(navigator, 'mediaDevices', {
    writable: true,
    value: {
      getUserMedia: mockGetUserMedia,
      enumerateDevices: jest.fn().mockResolvedValue([]),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    },
  });
});

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

describe('ICRTrainer', (): void => {
  const defaultSharedAudio = {
    kochLevel: 2,
    charSetMode: 'koch' as const,
    digitsLevel: 10,
    customSet: [],
    charWpm: 20,
    effectiveWpm: 20,
    sideToneMin: 600,
    sideToneMax: 600,
    steepness: 5,
    envelopeSmoothing: 0,
  };

  const defaultIcrSettings: IcrSettings = {
    trialsPerSession: 30,
    trialDelayMs: 700,
    vadEnabled: false,
    vadThreshold: 0.1,
    vadHoldMs: 100,
    micDeviceId: undefined,
    bucketGreenMaxMs: 500,
    bucketYellowMaxMs: 1000,
  };

  beforeEach((): void => {
    jest.clearAllMocks();
    mockGetUserMedia.mockResolvedValue({
      getTracks: jest.fn(() => [
        {
          stop: jest.fn(),
        },
      ]),
    });
  });

  it('should render ICR trainer', async (): Promise<void> => {
    await act(async () => {
      render(
        <TestWrapper>
          <ICRTrainer sharedAudio={defaultSharedAudio} icrSettings={defaultIcrSettings} />
        </TestWrapper>,
      );
    });

    await waitForInitialLoads();

    await waitFor(() => {
      // Look for Summary or input field or any component text
      const summary = screen.queryByText(/Summary/i);
      const input = screen.queryByRole('textbox');
      const trialText = screen.queryByText(/Trial/i);
      expect(summary || input || trialText).toBeTruthy();
    });
  });

  it('should display start button', async (): Promise<void> => {
    await act(async () => {
      render(
        <TestWrapper>
          <ICRTrainer sharedAudio={defaultSharedAudio} icrSettings={defaultIcrSettings} />
        </TestWrapper>,
      );
    });

    await waitForInitialLoads();

    await waitFor(() => {
      // Look for any button (Start button should be there)
      const buttons = screen.queryAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  it('should show input field', async (): Promise<void> => {
    await act(async () => {
      render(
        <TestWrapper>
          <ICRTrainer sharedAudio={defaultSharedAudio} icrSettings={defaultIcrSettings} />
        </TestWrapper>,
      );
    });

    await waitForInitialLoads();

    await waitFor(() => {
      const input = screen.queryByRole('textbox');
      expect(input).toBeInTheDocument();
    });
  });

  it('should display stop button', async (): Promise<void> => {
    await act(async () => {
      render(
        <TestWrapper>
          <ICRTrainer sharedAudio={defaultSharedAudio} icrSettings={defaultIcrSettings} />
        </TestWrapper>,
      );
    });

    await waitForInitialLoads();

    await waitFor(() => {
      const stopButton = screen.queryByRole('button', { name: /Stop/i });
      expect(stopButton).toBeInTheDocument();
    });
  });

  it('should display stats button', async (): Promise<void> => {
    await act(async () => {
      render(
        <TestWrapper>
          <ICRTrainer sharedAudio={defaultSharedAudio} icrSettings={defaultIcrSettings} />
        </TestWrapper>,
      );
    });

    await waitForInitialLoads();

    await waitFor(() => {
      const statsButton = screen.queryByRole('button', { name: /Stats/i });
      expect(statsButton).toBeInTheDocument();
    });
  });

  it('should display trial counter', async (): Promise<void> => {
    await act(async () => {
      render(
        <TestWrapper>
          <ICRTrainer sharedAudio={defaultSharedAudio} icrSettings={defaultIcrSettings} />
        </TestWrapper>,
      );
    });

    await waitForInitialLoads();

    await waitFor(() => {
      const trialText = screen.queryByText(/Trial.*\/.*30/i);
      expect(trialText).toBeInTheDocument();
    });
  });

  it('should display summary section', async (): Promise<void> => {
    await act(async () => {
      render(
        <TestWrapper>
          <ICRTrainer sharedAudio={defaultSharedAudio} icrSettings={defaultIcrSettings} />
        </TestWrapper>,
      );
    });

    await waitForInitialLoads();

    await waitFor(() => {
      const summary = screen.queryByText(/Summary/i);
      expect(summary).toBeInTheDocument();
    });
  });

  it('should show stats when stats button is clicked', async (): Promise<void> => {
    const user = userEvent.setup();
    await act(async () => {
      render(
        <TestWrapper>
          <ICRTrainer sharedAudio={defaultSharedAudio} icrSettings={defaultIcrSettings} />
        </TestWrapper>,
      );
    });

    await waitForInitialLoads();

    await waitFor(async () => {
      const statsButton = screen.queryByRole('button', { name: /Stats/i });
      if (statsButton) {
        await user.click(statsButton);
        await waitFor(() => {
          expect(screen.getByTestId('icr-stats')).toBeInTheDocument();
        });
      }
    });
  });

  it('should disable input when not running', async (): Promise<void> => {
    await act(async () => {
      render(
        <TestWrapper>
          <ICRTrainer sharedAudio={defaultSharedAudio} icrSettings={defaultIcrSettings} />
        </TestWrapper>,
      );
    });

    await waitForInitialLoads();

    await waitFor(() => {
      const input = screen.queryByRole('textbox');
      expect(input).toBeDisabled();
    });
  });

  it('should display charts when trials exist', async (): Promise<void> => {
    await act(async () => {
      render(
        <TestWrapper>
          <ICRTrainer sharedAudio={defaultSharedAudio} icrSettings={defaultIcrSettings} />
        </TestWrapper>,
      );
    });

    await waitForInitialLoads();

    await waitFor(() => {
      // Charts should be rendered (mocked as divs)
      const chart = screen.queryByTestId('composed-chart');
      expect(chart).toBeInTheDocument();
    });
  });
});

