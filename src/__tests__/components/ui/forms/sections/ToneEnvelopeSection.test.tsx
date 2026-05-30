import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { ToneEnvelopeSection } from '@/components/ui/forms/sections/ToneEnvelopeSection';
import type { FormTrainingSettings } from '@/components/ui/forms/TrainingSettingsForm';
import { DEFAULT_TRAINING_SETTINGS } from '@/config/training.config';
import { playMorseCodeControlled } from '@/lib/morseAudio';

jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }): JSX.Element => (
    <div>{children}</div>
  ),
  LineChart: ({ children }: { children: React.ReactNode }): JSX.Element => (
    <div data-testid="envelope-chart">{children}</div>
  ),
  Line: (): JSX.Element => <div />,
  CartesianGrid: (): JSX.Element => <div />,
  XAxis: (): JSX.Element => <div />,
  YAxis: (): JSX.Element => <div />,
}));

jest.mock('@/lib/morseAudio', () => ({
  playMorseCodeControlled: jest.fn(),
}));

const mockPlayMorse = playMorseCodeControlled as jest.MockedFunction<typeof playMorseCodeControlled>;

const { customSet, customSequence, ...defaultSettings } = DEFAULT_TRAINING_SETTINGS;
const baseSettings: FormTrainingSettings = {
  ...defaultSettings,
  customSet: [...customSet],
  ...(customSequence !== undefined ? { customSequence: [...customSequence] } : {}),
};

describe('ToneEnvelopeSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPlayMorse.mockResolvedValue({
      durationSec: 0.1,
      startTime: 0,
      stop: jest.fn(),
    });
    class MockAudioContext {
      public readonly close = jest.fn().mockResolvedValue(undefined);
      public readonly resume = jest.fn().mockResolvedValue(undefined);
    }
    global.AudioContext = MockAudioContext as unknown as typeof AudioContext;
  });

  it('renders tone controls and envelope preview', () => {
    render(<ToneEnvelopeSection settings={baseSettings} setSettings={jest.fn()} />);

    expect(screen.getByText(/tone & envelope/i)).toBeInTheDocument();
    expect(screen.getByTestId('envelope-chart')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /test/i })).toBeInTheDocument();
  });

  it('toggles help panel', async () => {
    const user = userEvent.setup();
    render(<ToneEnvelopeSection settings={baseSettings} setSettings={jest.fn()} />);

    const helpButton = screen.getByRole('button', { name: '?' });
    await user.click(helpButton);
    expect(screen.getByText(/attack\/decay time/i)).toBeInTheDocument();
  });

  it('resets tone envelope defaults', async () => {
    const user = userEvent.setup();
    const setSettings = jest.fn();

    render(
      <ToneEnvelopeSection
        settings={{ ...baseSettings, sideToneMin: 900, steepness: 20 }}
        setSettings={setSettings}
      />,
    );

    await user.click(screen.getByRole('button', { name: /reset/i }));

    expect(setSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        sideToneMin: DEFAULT_TRAINING_SETTINGS.sideToneMin,
        sideToneMax: DEFAULT_TRAINING_SETTINGS.sideToneMax,
        steepness: DEFAULT_TRAINING_SETTINGS.steepness,
        envelopeSmoothing: DEFAULT_TRAINING_SETTINGS.envelopeSmoothing,
      }),
    );
  });

  it('plays test tone on button click', async () => {
    const user = userEvent.setup();
    render(<ToneEnvelopeSection settings={baseSettings} setSettings={jest.fn()} />);

    await user.click(screen.getByRole('button', { name: /test/i }));

    expect(mockPlayMorse).toHaveBeenCalled();
  });
});
