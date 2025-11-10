import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { TrainingSettings } from '@/components/ui/forms/TrainingSettingsForm';
import { TextPlayerModal } from '@/components/ui/training/TextPlayerModal';

// Mock morseAudio functions
jest.mock('@/lib/morseAudio', () => ({
  playMorseCodeControlled: jest.fn(() =>
    Promise.resolve({
      durationSec: 5.0,
      stop: jest.fn(),
    }),
  ),
}));

describe('TextPlayerModal', (): void => {
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

  const onClose = jest.fn();

  beforeEach((): void => {
    jest.clearAllMocks();
  });

  it('should not render when closed', (): void => {
    render(<TextPlayerModal open={false} onClose={onClose} settings={defaultSettings} />);

    expect(screen.queryByDisplayValue(/CQ CQ TEST/i)).not.toBeInTheDocument();
  });

  it('should render when open', (): void => {
    render(<TextPlayerModal open={true} onClose={onClose} settings={defaultSettings} />);

    expect(screen.getByDisplayValue(/CQ CQ TEST/i)).toBeInTheDocument();
  });

  it('should call onClose when close button is clicked', async (): Promise<void> => {
    const user = userEvent.setup();
    render(<TextPlayerModal open={true} onClose={onClose} settings={defaultSettings} />);

    const closeButton = screen.getByRole('button', { name: /close|×|✕/i });
    await act(async () => {
      await user.click(closeButton);
    });

    expect(onClose).toHaveBeenCalled();
  });

  it('should render with initial text', (): void => {
    render(
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
    render(<TextPlayerModal open={true} onClose={onClose} settings={defaultSettings} />);

    const textarea = screen.getByDisplayValue(/CQ CQ TEST/i);
    await user.clear(textarea);
    await user.type(textarea, 'NEW TEXT');

    expect(screen.getByDisplayValue('NEW TEXT')).toBeInTheDocument();
  });

  it('should show play button', (): void => {
    render(<TextPlayerModal open={true} onClose={onClose} settings={defaultSettings} />);

    expect(screen.getByRole('button', { name: /Play/i })).toBeInTheDocument();
  });
});

