import { render, screen, waitFor, act } from '@testing-library/react';
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
});

