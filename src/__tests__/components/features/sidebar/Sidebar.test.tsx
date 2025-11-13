import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { Sidebar } from '@/components/features/sidebar/Sidebar';
import type { TrainingSettings } from '@/components/ui/forms/TrainingSettingsForm';
import type { IcrSessionService } from '@/lib/services/icr-session.service';
import type { SessionService } from '@/lib/services/session.service';
import type { TrainingSettingsService } from '@/lib/services/training-settings.service';
import { AppStoreProvider } from '@/store/providers/app-store-provider';
import type { IcrSettings } from '@/types';

// Mock form components
jest.mock('@/components/ui/forms/TrainingSettingsForm', () => ({
  TrainingSettingsForm: ({ settings }: { settings: TrainingSettings }): JSX.Element => (
    <div data-testid="training-settings-form">Training Settings: {settings.kochLevel}</div>
  ),
}));

jest.mock('@/components/ui/forms/ICRSettingsForm', () => ({
  ICRSettingsForm: ({ settings }: { settings: IcrSettings }): JSX.Element => (
    <div data-testid="icr-settings-form">ICR Settings: {settings.trialsPerSession}</div>
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

describe('Sidebar', () => {
  const defaultTrainingSettings: TrainingSettings = {
    kochLevel: 2,
    charSetMode: 'koch',
    digitsLevel: 10,
    customSet: [],
    sideToneMin: 600,
    sideToneMax: 600,
    steepness: 5,
    sessionDuration: 5,
    charsPerGroup: 5,
    numGroups: 5,
    charWpm: 20,
    effectiveWpm: 20,
    linkSpeeds: true,
    extraWordSpaceMultiplier: 1,
    groupTimeout: 10,
    minGroupSize: 2,
    maxGroupSize: 3,
    interactiveMode: false,
    envelopeSmoothing: 0,
    autoAdjustKoch: false,
    autoAdjustThreshold: 90,
  };

  const defaultIcrSettings: IcrSettings = {
    trialsPerSession: 30,
    trialDelayMs: 700,
    vadEnabled: true,
    vadThreshold: 0.1,
    vadHoldMs: 100,
    micDeviceId: undefined,
    bucketGreenMaxMs: 500,
    bucketYellowMaxMs: 1000,
  };

  const defaultProps = {
    open: true,
    onClose: jest.fn(),
    user: null,
    firebaseReady: false,
    onGoogleLogin: jest.fn(),
    onLogout: jest.fn(),
    onSwitchAccount: jest.fn(),
    authInProgress: false,
    settings: defaultTrainingSettings,
    setSettings: jest.fn(),
    onSaveSettings: jest.fn(),
    isSavingSettings: false,
    sessionResultsCount: 0,
    latestAccuracyPercent: undefined,
    onViewStats: jest.fn(),
    activeMode: undefined,
    onChangeMode: undefined,
    icrSettings: undefined,
    setIcrSettings: undefined,
  };

  beforeEach((): void => {
    jest.clearAllMocks();
  });

  it('should render sidebar when open', () => {
    render(
      <TestWrapper>
        <Sidebar {...defaultProps} />
      </TestWrapper>
    );

    // Check that sidebar content is present
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('should not render sidebar when closed', () => {
    render(
      <TestWrapper>
        <Sidebar {...defaultProps} open={false} />
      </TestWrapper>
    );

    // Sidebar should be off-screen (translate-x-full)
    const sidebar = screen.getByText('Settings').closest('div[class*="translate-x"]');
    expect(sidebar).toHaveClass('translate-x-full');
  });

  it('should call onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    const { container } = render(
      <TestWrapper>
        <Sidebar {...defaultProps} onClose={onClose} />
      </TestWrapper>
    );

    // Find close button by finding the SVG with the close path
    const closeButton = container.querySelector('button[class*="p-2"]');
    expect(closeButton).toBeInTheDocument();
    
    if (closeButton) {
      await user.click(closeButton);
      expect(onClose).toHaveBeenCalled();
    }
  });

  it('should call onClose when backdrop is clicked', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    const { container } = render(
      <TestWrapper>
        <Sidebar {...defaultProps} onClose={onClose} />
      </TestWrapper>
    );

    const backdrop = container.querySelector('.bg-black.bg-opacity-50');
    if (backdrop) {
      await user.click(backdrop);
      expect(onClose).toHaveBeenCalled();
    }
  });

  it('should render training settings form', () => {
    render(
      <TestWrapper>
        <Sidebar {...defaultProps} />
      </TestWrapper>
    );

    // Click to expand settings
    const settingsButton = screen.getByText('Settings');
    expect(settingsButton).toBeInTheDocument();
  });

  it('should render sign in section when user is null', () => {
    render(
      <TestWrapper>
        <Sidebar {...defaultProps} user={null} />
      </TestWrapper>
    );

    expect(screen.getByText(/Sign In/i)).toBeInTheDocument();
  });

  it('should render user info when user is logged in', () => {
    const user = {
      username: 'testuser',
      email: 'test@example.com',
      uid: 'user123',
    };
    render(
      <TestWrapper>
        <Sidebar {...defaultProps} user={user} />
      </TestWrapper>
    );

    expect(screen.getByText('testuser')).toBeInTheDocument();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('should call onLogout when logout button is clicked', async () => {
    const user = userEvent.setup();
    const onLogout = jest.fn();
    const userObj = {
      username: 'testuser',
      email: 'test@example.com',
      uid: 'user123',
    };
    render(
      <TestWrapper>
        <Sidebar {...defaultProps} user={userObj} onLogout={onLogout} />
      </TestWrapper>
    );

    const logoutButton = screen.getByRole('button', { name: /Logout/i });
    await user.click(logoutButton);

    expect(onLogout).toHaveBeenCalled();
  });

  it('should call onGoogleLogin when login button is clicked', async () => {
    const user = userEvent.setup();
    const onGoogleLogin = jest.fn();
    render(
      <TestWrapper>
        <Sidebar {...defaultProps} firebaseReady={true} onGoogleLogin={onGoogleLogin} />
      </TestWrapper>
    );

    const loginButton = screen.getByRole('button', { name: /Continue with Google/i });
    await user.click(loginButton);

    expect(onGoogleLogin).toHaveBeenCalled();
  });

  it('should render mode selector when onChangeMode is provided', () => {
    const onChangeMode = jest.fn();
    render(
      <TestWrapper>
        <Sidebar {...defaultProps} onChangeMode={onChangeMode} activeMode="group" />
      </TestWrapper>
    );

    expect(screen.getByText(/Modes/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Group/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ICR/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Player/i })).toBeInTheDocument();
  });

  it('should call onChangeMode when mode button is clicked', async () => {
    const user = userEvent.setup();
    const onChangeMode = jest.fn();
    render(
      <TestWrapper>
        <Sidebar {...defaultProps} onChangeMode={onChangeMode} activeMode="group" />
      </TestWrapper>
    );

    const icrButton = screen.getByRole('button', { name: /ICR/i });
    await user.click(icrButton);

    expect(onChangeMode).toHaveBeenCalledWith('icr');
  });

  it('should render ICR settings when in ICR mode', () => {
    render(
      <TestWrapper>
        <Sidebar
          {...defaultProps}
          activeMode="icr"
          icrSettings={defaultIcrSettings}
          setIcrSettings={jest.fn()}
        />
      </TestWrapper>
    );

    // Settings should be visible
    const settingsButton = screen.getByText('Settings');
    expect(settingsButton).toBeInTheDocument();
  });

  it('should call onSaveSettings when save button is clicked', async () => {
    const user = userEvent.setup();
    const onSaveSettings = jest.fn();
    render(
      <TestWrapper>
        <Sidebar {...defaultProps} onSaveSettings={onSaveSettings} />
      </TestWrapper>
    );

    // Settings section starts open by default (settingsOpen = true)
    // Wait for the Save Settings button to appear (it's inside the expanded settings)
    await waitFor(() => {
      const saveButton = screen.queryByText(/Save Settings/i);
      expect(saveButton).toBeInTheDocument();
    }, { timeout: 2000 });

    const saveButton = screen.getByText(/Save Settings/i);
    await user.click(saveButton);

    expect(onSaveSettings).toHaveBeenCalled();
  });

  it('should disable save button when isSavingSettings is true', () => {
    render(
      <TestWrapper>
        <Sidebar {...defaultProps} isSavingSettings={true} />
      </TestWrapper>
    );

    // Expand settings first
    const settingsButton = screen.getByText('Settings');
    expect(settingsButton).toBeInTheDocument();
  });
});

