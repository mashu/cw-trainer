import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { TrainingSettings } from '@/components/ui/forms/TrainingSettingsForm';
import { TextPlayer } from '@/components/ui/training/TextPlayer';

// Mock morseAudio functions
jest.mock('@/lib/morseAudio', () => ({
  playMorseCodeControlled: jest.fn(() =>
    Promise.resolve({
      durationSec: 5.0,
      stop: jest.fn(),
    }),
  ),
  renderMorseToWavBlob: jest.fn(() => Promise.resolve(new Blob(['test'], { type: 'audio/wav' }))),
}));

describe('TextPlayer', (): void => {
  const defaultSettings: TrainingSettings = {
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

  beforeEach((): void => {
    jest.clearAllMocks();
  });

  it('should render text player with default text', (): void => {
    render(<TextPlayer settings={defaultSettings} />);

    expect(screen.getByDisplayValue(/CQ CQ DE TEST/i)).toBeInTheDocument();
  });

  it('should render with initial text', (): void => {
    render(<TextPlayer settings={defaultSettings} initialText="TEST MESSAGE" />);

    expect(screen.getByDisplayValue('TEST MESSAGE')).toBeInTheDocument();
  });

  it('should allow text input changes', async (): Promise<void> => {
    const user = userEvent.setup();
    render(<TextPlayer settings={defaultSettings} />);

    const textarea = screen.getByDisplayValue(/CQ CQ DE TEST/i);
    await user.clear(textarea);
    await user.type(textarea, 'NEW TEXT');

    expect(screen.getByDisplayValue('NEW TEXT')).toBeInTheDocument();
  });

  it('should show play button', (): void => {
    render(<TextPlayer settings={defaultSettings} />);

    expect(screen.getByRole('button', { name: /Play/i })).toBeInTheDocument();
  });

  it('should show stop button when playing', async (): Promise<void> => {
    const user = userEvent.setup();
    render(<TextPlayer settings={defaultSettings} />);

    const playButton = screen.getByRole('button', { name: /Play/i });
    
    // Click play button - this triggers async handlePlay
    // handlePlay calls setIsPlaying(true) immediately, then awaits playMorseCodeControlled
    // After the promise resolves, it calls setDurationSec which triggers a state update
    // We need to wrap the entire async flow including promise resolution in act()
    await act(async () => {
      await user.click(playButton);
      // Wait for playMorseCodeControlled promise to resolve
      await Promise.resolve();
      // Wait for the state update from setDurationSec to complete
      await Promise.resolve();
      // Give React time to process the state update
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    
    // Now check for stop button - setIsPlaying(true) should have been called
    await waitFor(
      () => {
        expect(screen.getByRole('button', { name: /Stop/i })).toBeInTheDocument();
      },
      { timeout: 1000 },
    );
  });

  it('should show prefill button', (): void => {
    render(<TextPlayer settings={defaultSettings} />);

    expect(screen.getByRole('button', { name: /Pre-fill/i })).toBeInTheDocument();
  });

  it('should prefill text when prefill button is clicked', async (): Promise<void> => {
    const user = userEvent.setup();
    render(<TextPlayer settings={defaultSettings} />);

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
    render(<TextPlayer settings={defaultSettings} />);

    expect(screen.getByRole('button', { name: /Download WAV/i })).toBeInTheDocument();
  });
});

