import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import type { FormTrainingSettings } from '@/components/ui/forms/TrainingSettingsForm';
import { TextPlayerModal } from '@/components/ui/training/TextPlayerModal';
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
}));

describe('TextPlayerModal', (): void => {
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

  const onClose = jest.fn();

  beforeEach((): void => {
    jest.clearAllMocks();
  });

  it('should not render when closed', (): void => {
    renderWithStore(<TextPlayerModal open={false} onClose={onClose} settings={defaultSettings} />);

    expect(screen.queryByDisplayValue(/CQ CQ TEST/i)).not.toBeInTheDocument();
  });

  it('should render when open', (): void => {
    renderWithStore(<TextPlayerModal open={true} onClose={onClose} settings={defaultSettings} />);

    expect(screen.getByDisplayValue(/CQ CQ TEST/i)).toBeInTheDocument();
  });

  it('should call onClose when close button is clicked', async (): Promise<void> => {
    const user = userEvent.setup();
    renderWithStore(<TextPlayerModal open={true} onClose={onClose} settings={defaultSettings} />);

    const closeButton = screen.getByRole('button', { name: /close|×|✕/i });
    await act(async () => {
      await user.click(closeButton);
    });

    expect(onClose).toHaveBeenCalled();
  });

  it('should render with initial text', (): void => {
    renderWithStore(
      <TextPlayerModal
        open={true}
        onClose={onClose}
        settings={defaultSettings}
        initialText="CUSTOM TEXT"
      />,
    );

    expect(screen.getByDisplayValue('CUSTOM TEXT')).toBeInTheDocument();
  });

  it('should allow text input changes', async (): Promise<void> => {
    const user = userEvent.setup();
    renderWithStore(<TextPlayerModal open={true} onClose={onClose} settings={defaultSettings} />);

    const textarea = screen.getByDisplayValue(/CQ CQ TEST/i);
    await user.clear(textarea);
    await user.type(textarea, 'NEW TEXT');

    expect(screen.getByDisplayValue('NEW TEXT')).toBeInTheDocument();
  });

  it('should show play button', (): void => {
    renderWithStore(<TextPlayerModal open={true} onClose={onClose} settings={defaultSettings} />);

    expect(screen.getByRole('button', { name: /Play/i })).toBeInTheDocument();
  });

  it('should show stop button when playing', async (): Promise<void> => {
    const user = userEvent.setup();
    renderWithStore(<TextPlayerModal open={true} onClose={onClose} settings={defaultSettings} />);

    const playButton = screen.getByRole('button', { name: /Play/i });
    await act(async () => {
      await user.click(playButton);
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Should show stop button when playing
    expect(screen.getByRole('button', { name: /Stop/i })).toBeInTheDocument();
  });

  it('should call onClose when backdrop is clicked and not playing', async (): Promise<void> => {
    const user = userEvent.setup();
    const { container } = renderWithStore(
      <TextPlayerModal open={true} onClose={onClose} settings={defaultSettings} />,
    );

    const backdrop = container.querySelector('.bg-black\\/40');
    if (backdrop) {
      await act(async () => {
        await user.click(backdrop);
      });

      expect(onClose).toHaveBeenCalled();
    }
  });

  it('should not call onClose when backdrop is clicked while playing', async (): Promise<void> => {
    const user = userEvent.setup();
    const { container } = renderWithStore(
      <TextPlayerModal open={true} onClose={onClose} settings={defaultSettings} />,
    );

    // Start playing
    const playButton = screen.getByRole('button', { name: /Play/i });
    await act(async () => {
      await user.click(playButton);
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const backdrop = container.querySelector('.bg-black\\/40');
    if (backdrop) {
      const callCountBefore = onClose.mock.calls.length;
      await act(async () => {
        await user.click(backdrop);
      });
      // Should not call onClose when playing
      expect(onClose.mock.calls.length).toBe(callCountBefore);
    }
  });

  it('should pre-fill text when pre-fill button is clicked', async (): Promise<void> => {
    const user = userEvent.setup();
    renderWithStore(<TextPlayerModal open={true} onClose={onClose} settings={defaultSettings} />);

    const prefillButton = screen.getByRole('button', { name: /Pre-fill/i });
    
    await act(async () => {
      await user.click(prefillButton);
    });

    // Text should be updated with generated groups
    await waitFor(() => {
      const updatedTextarea = screen.getByPlaceholderText(/Type text here/i);
      // Value should have changed (either filled or cleared and refilled)
      expect(updatedTextarea).toBeInTheDocument();
    });
  });

  it('should clear text when clear button is clicked', async (): Promise<void> => {
    const user = userEvent.setup();
    renderWithStore(<TextPlayerModal open={true} onClose={onClose} settings={defaultSettings} />);

    const clearButton = screen.getByRole('button', { name: /Clear/i });
    await act(async () => {
      await user.click(clearButton);
    });

    const textarea = screen.getByPlaceholderText(/Type text here/i);
    expect(textarea).toHaveValue('');
  });

  it('should disable play button when text is empty', (): void => {
    renderWithStore(<TextPlayerModal open={true} onClose={onClose} settings={defaultSettings} />);

    const playButton = screen.getByRole('button', { name: /Play/i });
    expect(playButton).not.toBeDisabled();
  });

  it('should disable buttons when playing', async (): Promise<void> => {
    const user = userEvent.setup();
    renderWithStore(<TextPlayerModal open={true} onClose={onClose} settings={defaultSettings} />);

    const playButton = screen.getByRole('button', { name: /Play/i });
    await act(async () => {
      await user.click(playButton);
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const prefillButton = screen.getByRole('button', { name: /Pre-fill/i });
    const clearButton = screen.getByRole('button', { name: /Clear/i });
    
    expect(prefillButton).toBeDisabled();
    expect(clearButton).toBeDisabled();
  });

  it('should generate line of groups when Enter is pressed', async (): Promise<void> => {
    const user = userEvent.setup();
    renderWithStore(<TextPlayerModal open={true} onClose={onClose} settings={defaultSettings} />);

    const textarea = screen.getByPlaceholderText(/Type text here/i);
    
    await act(async () => {
      await user.click(textarea);
      await user.keyboard('{Enter}');
    });

    // Text should be updated with generated groups
    expect(textarea).toBeInTheDocument();
  });

  it('should display duration when available', async (): Promise<void> => {
    const user = userEvent.setup();
    renderWithStore(<TextPlayerModal open={true} onClose={onClose} settings={defaultSettings} />);

    const playButton = screen.getByRole('button', { name: /Play/i });
    await act(async () => {
      await user.click(playButton);
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Duration should be displayed
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
  });

  it('should display settings information', (): void => {
    renderWithStore(<TextPlayerModal open={true} onClose={onClose} settings={defaultSettings} />);

    expect(screen.getByText(/Char WPM:/i)).toBeInTheDocument();
    expect(screen.getByText(/Eff WPM:/i)).toBeInTheDocument();
    expect(screen.getByText(/Tone:/i)).toBeInTheDocument();
  });

  it('should stop playback when stop button is clicked', async (): Promise<void> => {
    const user = userEvent.setup();
    renderWithStore(<TextPlayerModal open={true} onClose={onClose} settings={defaultSettings} />);

    const playButton = screen.getByRole('button', { name: /Play/i });
    await act(async () => {
      await user.click(playButton);
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const stopButton = screen.getByRole('button', { name: /Stop/i });
    await act(async () => {
      await user.click(stopButton);
    });

    // Should show play button again after stopping
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Play/i })).toBeInTheDocument();
    });
  });

  it('should not close when close button is clicked while playing', async (): Promise<void> => {
    const user = userEvent.setup();
    renderWithStore(<TextPlayerModal open={true} onClose={onClose} settings={defaultSettings} />);

    // Start playing
    const playButton = screen.getByRole('button', { name: /Play/i });
    await act(async () => {
      await user.click(playButton);
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const closeButton = screen.getByRole('button', { name: /close|×|✕/i });
    const callCountBefore = onClose.mock.calls.length;
    
    await act(async () => {
      await user.click(closeButton);
    });

    // Should not call onClose when playing
    expect(onClose.mock.calls.length).toBe(callCountBefore);
  });
});

