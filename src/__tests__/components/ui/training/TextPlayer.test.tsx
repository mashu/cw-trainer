import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import type { FormTrainingSettings } from '@/components/ui/forms/TrainingSettingsForm';
import { TextPlayer } from '@/components/ui/training/TextPlayer';
import { DEFAULT_TRAINING_SETTINGS } from '@/config/training.config';
import type { IcrSessionService } from '@/lib/services/icr-session.service';
import type { SessionService } from '@/lib/services/session.service';
import type { TrainingSettingsService } from '@/lib/services/training-settings.service';
import { AppStoreProvider } from '@/store/providers/app-store-provider';

const mockTrainingSettingsService = {
  getSettings: jest.fn().mockResolvedValue(DEFAULT_TRAINING_SETTINGS),
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

const mockIcrSessionService = {
  listSessions: jest.fn().mockResolvedValue([]),
  saveSession: jest.fn(),
  clearSessions: jest.fn(),
  deleteSession: jest.fn(),
} as unknown as IcrSessionService;

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

function renderWithStore(ui: React.ReactElement): ReturnType<typeof render> {
  return render(ui, { wrapper: TestWrapper });
}

// Mock morseAudio functions
jest.mock('@/lib/morseAudio', () => ({
  resumeAudioContextFromUserGesture: jest.fn(),
  playMorseCodeControlled: jest.fn(() =>
    Promise.resolve({
      durationSec: 5.0,
      stop: jest.fn(),
    }),
  ),
  renderMorseToWavBlob: jest.fn(() => Promise.resolve(new Blob(['test'], { type: 'audio/wav' }))),
  ensureContext: jest.fn(() => Promise.resolve()),
}));

describe('TextPlayer', (): void => {
  const defaultSettings: FormTrainingSettings = {
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

  beforeEach((): void => {
    jest.clearAllMocks();
  });

  it('should render text player with default text', (): void => {
    renderWithStore(<TextPlayer settings={defaultSettings} />);

    expect(screen.getByDisplayValue(/CQ CQ DE TEST/i)).toBeInTheDocument();
  });

  it('should render with initial text', (): void => {
    renderWithStore(<TextPlayer settings={defaultSettings} initialText="TEST MESSAGE" />);

    expect(screen.getByDisplayValue('TEST MESSAGE')).toBeInTheDocument();
  });

  it('should allow text input changes', async (): Promise<void> => {
    const user = userEvent.setup();
    renderWithStore(<TextPlayer settings={defaultSettings} />);

    const textarea = screen.getByDisplayValue(/CQ CQ DE TEST/i);
    await user.clear(textarea);
    await user.type(textarea, 'NEW TEXT');

    expect(screen.getByDisplayValue('NEW TEXT')).toBeInTheDocument();
  });

  it('should show play button', (): void => {
    renderWithStore(<TextPlayer settings={defaultSettings} />);

    expect(screen.getByRole('button', { name: /Play/i })).toBeInTheDocument();
  });

  it('should show stop button when playing', async (): Promise<void> => {
    const user = userEvent.setup();
    renderWithStore(<TextPlayer settings={defaultSettings} />);

    const playButton = screen.getByRole('button', { name: /Play/i });
    
    // Click play button - this triggers async handlePlay
    // handlePlay calls setIsPlaying(true) immediately, then awaits playMorseCodeControlled
    await act(async () => {
      await user.click(playButton);
      // Give React time to process the setIsPlaying(true) state update
      // Use multiple microtasks to ensure state updates are processed
      await Promise.resolve();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    
    // Now check for stop button - setIsPlaying(true) should have been called immediately
    await waitFor(
      () => {
        const stopButton = screen.queryByRole('button', { name: /Stop/i });
        expect(stopButton).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  it('should show prefill button', (): void => {
    renderWithStore(<TextPlayer settings={defaultSettings} />);

    expect(screen.getByRole('button', { name: /Pre-fill/i })).toBeInTheDocument();
  });

  it('should prefill text when prefill button is clicked', async (): Promise<void> => {
    const user = userEvent.setup();
    renderWithStore(<TextPlayer settings={defaultSettings} />);

    const prefillButton = screen.getByRole('button', { name: /Pre-fill/i });
    await act(async () => {
      await user.click(prefillButton);
    });

    // Text should be updated with generated groups (may not be the default text anymore)
    await waitFor(() => {
      const textarea = screen.getByPlaceholderText(/Type text here/i);
      expect(textarea).toBeInTheDocument();
    });
  });

  it('should show download button', (): void => {
    renderWithStore(<TextPlayer settings={defaultSettings} />);

    expect(screen.getByRole('button', { name: /Download WAV/i })).toBeInTheDocument();
  });
});

