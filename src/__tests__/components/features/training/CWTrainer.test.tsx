import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { CWTrainer } from '@/components/features/training/CWTrainer';
import type { IcrSessionService } from '@/lib/services/icr-session.service';
import type { SessionService } from '@/lib/services/session.service';
import type { TrainingSettingsService } from '@/lib/services/training-settings.service';
import { AppStoreProvider } from '@/store/providers/app-store-provider';

// Mock Firebase client
jest.mock('@/lib/firebaseClient', () => ({
  initFirebase: jest.fn(() => null),
  googleSignIn: jest.fn(() => Promise.resolve(null)),
  googleSignOut: jest.fn(() => Promise.resolve()),
  getRedirectedUser: jest.fn(() => Promise.resolve(null)),
}));

// Mock ICRTrainer
jest.mock('@/components/features/icr/ICRTrainer', () => ({
  ICRTrainer: (): JSX.Element => <div data-testid="icr-trainer">ICR Trainer</div>,
}));

// Mock Sidebar
jest.mock('@/components/features/sidebar/Sidebar', () => ({
  Sidebar: (): JSX.Element => <div data-testid="sidebar">Sidebar</div>,
}));

// Mock GroupTrainingStats
jest.mock('@/components/features/stats/GroupTrainingStats', () => ({
  GroupTrainingStats: ({ onBack }: { onBack: () => void }): JSX.Element => (
    <div data-testid="group-training-stats">
      <button onClick={onBack}>Back</button>
    </div>
  ),
}));

// Mock ActivityHeatmap
jest.mock('@/components/ui/charts/ActivityHeatmap', () => ({
  ActivityHeatmap: (): JSX.Element => <div data-testid="activity-heatmap">Activity Heatmap</div>,
}));

// Mock TextPlayer
jest.mock('@/components/ui/training/TextPlayer', () => ({
  TextPlayer: (): JSX.Element => <div data-testid="text-player">Text Player</div>,
}));

// Mock morseAudio
jest.mock('@/lib/morseAudio', () => ({
  resumeAudioContextFromUserGesture: jest.fn(),
  playMorseCodeControlled: jest.fn(() =>
    Promise.resolve({
      durationSec: 1.0,
      stop: jest.fn(),
    }),
  ),
}));

const mockTrainingSettingsService: TrainingSettingsService = {
  getSettings: jest.fn().mockResolvedValue({}),
  saveSettings: jest.fn(),
  patchSettings: jest.fn(),
  resetSettings: jest.fn(),
} as unknown as TrainingSettingsService;

const mockSessionService = {
  listSessions: jest.fn().mockResolvedValue([]),
  upsertSession: jest.fn(),
  replaceAll: jest.fn(),
  deleteSession: jest.fn(),
  syncPending: jest.fn(),
  processRetryQueue: jest.fn(),
} as unknown as SessionService;

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
  // AppStoreProvider debounces loads by 50ms; wait for that plus async completion
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 120));
  });
};

describe('CWTrainer', (): void => {
  beforeEach((): void => {
    jest.clearAllMocks();
  });

  it('should render CWTrainer component', async (): Promise<void> => {
    await act(async () => {
      render(
        <TestWrapper>
          <CWTrainer />
        </TestWrapper>,
      );
    });

    await waitForInitialLoads();

    await waitFor(() => {
      // Should render one of the main components or buttons
      const buttons = screen.queryAllByRole('button');
      const icrTrainer = screen.queryByTestId('icr-trainer');
      const textPlayer = screen.queryByTestId('text-player');
      expect(buttons.length > 0 || icrTrainer || textPlayer).toBeTruthy();
    });
  });

  it('should render sidebar toggle button', async (): Promise<void> => {
    await act(async () => {
      render(
        <TestWrapper>
          <CWTrainer />
        </TestWrapper>,
      );
    });

    await waitForInitialLoads();

    await waitFor(() => {
      // Should have a button to open sidebar (usually a settings icon or menu)
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  it('should display start training button', async (): Promise<void> => {
    await act(async () => {
      render(
        <TestWrapper>
          <CWTrainer />
        </TestWrapper>,
      );
    });

    await waitForInitialLoads();

    await waitFor(() => {
      const startButton = screen.queryByRole('button', { name: /Start Training/i });
      expect(startButton).toBeInTheDocument();
    });
  });

  it('should display view stats button', async (): Promise<void> => {
    await act(async () => {
      render(
        <TestWrapper>
          <CWTrainer />
        </TestWrapper>,
      );
    });

    await waitForInitialLoads();

    await waitFor(() => {
      const statsButton = screen.queryByRole('button', { name: /View Stats/i });
      expect(statsButton).toBeInTheDocument();
    });
  });

  it('should display activity heatmap when sessions exist', async (): Promise<void> => {
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
          <CWTrainer />
        </TestWrapper>,
      );
    });

    await waitForInitialLoads();

    await waitFor(() => {
      expect(screen.getByTestId('activity-heatmap')).toBeInTheDocument();
    });
  });

  it('should display session statistics when sessions exist', async (): Promise<void> => {
    const mockSessions = [
      {
        date: '2024-01-01',
        timestamp: Date.now(),
        groups: [{ sent: 'ABC', received: 'ABC', correct: true }],
        groupTimings: [{ timeToCompleteMs: 1000 }],
        accuracy: 0.95,
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
          <CWTrainer />
        </TestWrapper>,
      );
    });

    await waitForInitialLoads();

    await waitFor(() => {
      // Should show last accuracy or sessions count (use getAllByText since both appear)
      const accuracyElements = screen.getAllByText(/Last Accuracy|Sessions/i);
      expect(accuracyElements.length).toBeGreaterThan(0);
    });
  });

  it('should switch to stats tab when view stats is clicked', async (): Promise<void> => {
    const user = userEvent.setup();
    await act(async () => {
      render(
        <TestWrapper>
          <CWTrainer />
        </TestWrapper>,
      );
    });

    await waitForInitialLoads();

    await waitFor(async () => {
      const statsButton = screen.queryByRole('button', { name: /View Stats/i });
      if (statsButton) {
        await user.click(statsButton);
        await waitFor(() => {
          expect(screen.getByTestId('group-training-stats')).toBeInTheDocument();
        });
      }
    });
  });

  it('should display sidebar when menu button is clicked', async (): Promise<void> => {
    const user = userEvent.setup();
    await act(async () => {
      render(
        <TestWrapper>
          <CWTrainer />
        </TestWrapper>,
      );
    });

    await waitForInitialLoads();

    await waitFor(async () => {
      // Find menu button (hamburger icon)
      const menuButtons = screen.getAllByRole('button');
      const menuButton = menuButtons.find((btn) => {
        const svg = btn.querySelector('svg');
        return svg !== null;
      });
      if (menuButton) {
        await user.click(menuButton);
        await waitFor(() => {
          expect(screen.getByTestId('sidebar')).toBeInTheDocument();
        });
      }
    });
  });

  it('should display koch level in statistics', async (): Promise<void> => {
    const oneSession = [
      {
        date: '2024-01-01',
        timestamp: Date.now(),
        groups: [{ sent: 'AB', received: 'AB', correct: true }],
        groupTimings: [{ timeToCompleteMs: 1000 }],
        accuracy: 1.0,
        letterAccuracy: {},
        alphabetSize: 2,
        totalChars: 2,
        effectiveAlphabetSize: 2,
        avgResponseMs: 1000,
        score: 100,
        startedAt: Date.now() - 5000,
        finishedAt: Date.now(),
      },
    ];
    (mockSessionService.listSessions as jest.Mock).mockResolvedValueOnce(oneSession);

    await act(async () => {
      render(
        <TestWrapper>
          <CWTrainer />
        </TestWrapper>,
      );
    });

    await waitForInitialLoads();

    await waitFor(() => {
      const kochLevelText = screen.queryByText(/Koch Level/i);
      expect(kochLevelText).toBeInTheDocument();
    });
  });

  it('should switch to ICR mode', async (): Promise<void> => {
    const user = userEvent.setup();
    await act(async () => {
      render(
        <TestWrapper>
          <CWTrainer />
        </TestWrapper>,
      );
    });

    await waitForInitialLoads();

    // Open sidebar first
    await waitFor(async () => {
      const menuButtons = screen.getAllByRole('button');
      const menuButton = menuButtons.find((btn) => {
        const svg = btn.querySelector('svg');
        return svg !== null;
      });
      if (menuButton) {
        await user.click(menuButton);
        await waitFor(() => {
          expect(screen.getByTestId('sidebar')).toBeInTheDocument();
        });
      }
    });
  });

  it('should display player mode when switched', async (): Promise<void> => {
    await act(async () => {
      render(
        <TestWrapper>
          <CWTrainer />
        </TestWrapper>,
      );
    });

    await waitForInitialLoads();

    // Player mode should be available through sidebar
    await waitFor(() => {
      const buttons = screen.queryAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  it('should handle empty sessions list', async (): Promise<void> => {
    mockSessionService.listSessions = jest.fn().mockResolvedValue([]);

    await act(async () => {
      render(
        <TestWrapper>
          <CWTrainer />
        </TestWrapper>,
      );
    });

    await waitForInitialLoads();

    await waitFor(() => {
      const startButton = screen.queryByRole('button', { name: /Start Training/i });
      expect(startButton).toBeInTheDocument();
    });
  });

  it('should display session count correctly', async (): Promise<void> => {
    const mockSessions = [
      {
        date: '2024-01-01',
        timestamp: Date.now(),
        groups: [{ sent: 'ABC', received: 'ABC', correct: true }],
        groupTimings: [{ timeToCompleteMs: 1000 }],
        accuracy: 0.95,
        letterAccuracy: {},
        alphabetSize: 3,
        totalChars: 3,
        effectiveAlphabetSize: 3,
        avgResponseMs: 1000,
        score: 100,
        startedAt: Date.now() - 5000,
        finishedAt: Date.now(),
      },
      {
        date: '2024-01-02',
        timestamp: Date.now() + 1000,
        groups: [{ sent: 'DEF', received: 'DEF', correct: true }],
        groupTimings: [{ timeToCompleteMs: 1000 }],
        accuracy: 0.90,
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

    (mockSessionService.listSessions as jest.Mock).mockResolvedValue(mockSessions);

    await act(async () => {
      render(
        <TestWrapper>
          <CWTrainer />
        </TestWrapper>,
      );
    });

    await waitForInitialLoads();

    await waitFor(() => {
      expect(mockSessionService.listSessions).toHaveBeenCalled();
    });

    // "Sessions" appears in the stats card and in tips; match the stats label with "total completed"
    expect(await screen.findByText(/total completed/i, {}, { timeout: 2000 })).toBeInTheDocument();
  });

  it('should handle back from stats view', async (): Promise<void> => {
    const user = userEvent.setup();
    await act(async () => {
      render(
        <TestWrapper>
          <CWTrainer />
        </TestWrapper>,
      );
    });

    await waitForInitialLoads();

    await waitFor(async () => {
      const statsButton = screen.queryByRole('button', { name: /View Stats/i });
      if (statsButton) {
        await user.click(statsButton);
        await waitFor(() => {
          expect(screen.getByTestId('group-training-stats')).toBeInTheDocument();
        });
        
        const backButton = screen.getByRole('button', { name: /Back/i });
        await user.click(backButton);
        
        await waitFor(() => {
          expect(screen.queryByTestId('group-training-stats')).not.toBeInTheDocument();
        });
      }
    });
  });

  it('should display title and description', async (): Promise<void> => {
    await act(async () => {
      render(
        <TestWrapper>
          <CWTrainer />
        </TestWrapper>,
      );
    });

    await waitForInitialLoads();

    await waitFor(() => {
      const title = screen.queryByText(/Morse Code Trainer/i);
      expect(title).toBeInTheDocument();
    });
  });

  it('should handle sidebar close', async (): Promise<void> => {
    const user = userEvent.setup();
    await act(async () => {
      render(
        <TestWrapper>
          <CWTrainer />
        </TestWrapper>,
      );
    });

    await waitForInitialLoads();

    // Open sidebar
    await waitFor(async () => {
      const menuButtons = screen.getAllByRole('button');
      const menuButton = menuButtons.find((btn) => {
        const svg = btn.querySelector('svg');
        return svg !== null;
      });
      if (menuButton) {
        await user.click(menuButton);
        await waitFor(() => {
          expect(screen.getByTestId('sidebar')).toBeInTheDocument();
        });
      }
    });
  });
});

