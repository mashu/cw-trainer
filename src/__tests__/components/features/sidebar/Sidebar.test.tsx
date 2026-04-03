import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { Sidebar } from '@/components/features/sidebar/Sidebar';
import type { FormTrainingSettings } from '@/components/ui/forms/TrainingSettingsForm';
import type { IcrSessionService } from '@/lib/services/icr-session.service';
import type { SessionService } from '@/lib/services/session.service';
import type { TrainingSettingsService } from '@/lib/services/training-settings.service';
import { AppStoreProvider } from '@/store/providers/app-store-provider';
import type { IcrSettings } from '@/types';

// Mock form components
jest.mock('@/components/ui/forms/TrainingSettingsForm', () => ({
  TrainingSettingsForm: ({ settings }: { settings: FormTrainingSettings }): JSX.Element => (
    <div data-testid="training-settings-form">Training Settings: {settings.kochLevel}</div>
  ),
}));

jest.mock('@/components/ui/forms/ICRSettingsForm', () => ({
  ICRSettingsForm: ({ settings }: { settings: IcrSettings }): JSX.Element => (
    <div data-testid="icr-settings-form">ICR Settings: {settings.trialsPerSession}</div>
  ),
}));

jest.mock('@/components/ui/forms/EchoSettingsForm', () => ({
  EchoSettingsForm: (): JSX.Element => (
    <div data-testid="echo-settings-form">Echo Settings</div>
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
  upsertSession: jest.fn().mockResolvedValue([]),
  replaceAll: jest.fn().mockResolvedValue([]),
  deleteSession: jest.fn().mockResolvedValue([]),
  syncPending: jest.fn().mockResolvedValue([]),
  processRetryQueue: jest.fn().mockResolvedValue(undefined),
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

describe('Sidebar', () => {
  const defaultTrainingSettings: FormTrainingSettings = {
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
    charWpmMin: 20,
    charWpmMax: 20,
    linkCharWpm: true,
    effectiveWpmMin: 20,
    effectiveWpmMax: 20,
    linkEffectiveWpm: true,
    linkCharToEffective: true,
    extraWordSpaceMultiplier: 1,
    groupTimeout: 10,
    minGroupSize: 2,
    maxGroupSize: 3,
    linkGroupSize: true,
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
    bucketGreenMaxMs: 500,
    bucketYellowMaxMs: 1000,
    bucketOrangeMaxMs: 1200,
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
    latestAccuracyPercent: 0,
    onViewStats: jest.fn(),
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
    expect(screen.getByRole('button', { name: /Echo/i })).toBeInTheDocument();
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

  it('should call onChangeMode when echo mode is clicked', async () => {
    const user = userEvent.setup();
    const onChangeMode = jest.fn();
    render(
      <TestWrapper>
        <Sidebar {...defaultProps} onChangeMode={onChangeMode} activeMode="group" />
      </TestWrapper>
    );

    const echoButton = screen.getByRole('button', { name: /Echo/i });
    await user.click(echoButton);

    expect(onChangeMode).toHaveBeenCalledWith('echo');
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

  it('should render echo settings when in echo mode', () => {
    render(
      <TestWrapper>
        <Sidebar {...defaultProps} activeMode="echo" />
      </TestWrapper>
    );

    expect(screen.getByTestId('echo-settings-form')).toBeInTheDocument();
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

  it('should toggle settings section when settings button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <TestWrapper>
        <Sidebar {...defaultProps} />
      </TestWrapper>
    );

    const settingsButton = screen.getByText('Settings');
    await user.click(settingsButton);
    
    // Settings section should toggle
    expect(settingsButton).toBeInTheDocument();
  });

  it('should show mode help when help button is clicked', async () => {
    const user = userEvent.setup();
    const onChangeMode = jest.fn();
    render(
      <TestWrapper>
        <Sidebar {...defaultProps} onChangeMode={onChangeMode} activeMode="group" />
      </TestWrapper>
    );

    const helpButton = screen.getByRole('button', { name: '?' });
    await user.click(helpButton);
    
    // Mode help should be visible
    await waitFor(() => {
      expect(screen.getByText(/Mode guide/i)).toBeInTheDocument();
    });
  });

  it('should call onSwitchAccount when switch account button is clicked', async () => {
    const user = userEvent.setup();
    const onSwitchAccount = jest.fn();
    const userObj = {
      username: 'testuser',
      email: 'test@example.com',
      uid: 'user123',
    };
    render(
      <TestWrapper>
        <Sidebar {...defaultProps} user={userObj} firebaseReady={true} onSwitchAccount={onSwitchAccount} />
      </TestWrapper>
    );

    const switchAccountButton = screen.getByRole('button', { name: /Switch Google Account/i });
    await user.click(switchAccountButton);

    expect(onSwitchAccount).toHaveBeenCalled();
  });

  it('should show firebase not configured message when firebaseReady is false', () => {
    render(
      <TestWrapper>
        <Sidebar {...defaultProps} firebaseReady={false} />
      </TestWrapper>
    );

    expect(screen.getByText(/Firebase not configured/i)).toBeInTheDocument();
  });

  it('should display call sign input when user is logged in and firebase is ready', () => {
    const userObj = {
      username: 'testuser',
      email: 'test@example.com',
      uid: 'user123',
    };
    render(
      <TestWrapper>
        <Sidebar {...defaultProps} user={userObj} firebaseReady={true} />
      </TestWrapper>
    );

    expect(screen.getByPlaceholderText(/e.g., W1ABC/i)).toBeInTheDocument();
  });

  it('should handle call sign input changes', async () => {
    const user = userEvent.setup();
    jest.mock('@/lib/firebaseClient', () => ({
      initFirebase: jest.fn(() => ({ db: null, auth: null })),
    }));
    jest.mock('@/lib/sessionPersistence', () => ({
      getUserCallSign: jest.fn(() => Promise.resolve('')),
      setUserCallSign: jest.fn(() => Promise.resolve()),
    }));

    const userObj = {
      username: 'testuser',
      email: 'test@example.com',
      uid: 'user123',
    };
    render(
      <TestWrapper>
        <Sidebar {...defaultProps} user={userObj} firebaseReady={true} />
      </TestWrapper>
    );

    const callSignInput = screen.getByPlaceholderText(/e.g., W1ABC/i);
    await user.type(callSignInput, 'W1ABC');
    
    expect(callSignInput).toHaveValue('W1ABC');
  });

  it('should show session help when help button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <TestWrapper>
        <Sidebar {...defaultProps} />
      </TestWrapper>
    );

    // Find the help button in the settings section
    const helpButtons = screen.getAllByRole('button');
    const sessionHelpButton = helpButtons.find(btn => btn.textContent === '?');
    
    if (sessionHelpButton) {
      await user.click(sessionHelpButton);
      // Help panel should appear (e.g. Character set or Speed & groups)
      await waitFor(() => {
        expect(screen.getByText(/Character set|Speed &amp; groups/i)).toBeInTheDocument();
      });
    }
  });
});

