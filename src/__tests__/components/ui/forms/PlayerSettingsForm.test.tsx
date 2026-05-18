import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { useState } from 'react';

import { PlayerSettingsForm } from '@/components/ui/forms/PlayerSettingsForm';
import type { FormTrainingSettings } from '@/components/ui/forms/TrainingSettingsForm';
import { DEFAULT_TRAINING_SETTINGS } from '@/config/training.config';

function mockSpeechSynthesis(): void {
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: {
      cancel: jest.fn(),
      getVoices: jest.fn(() => [
        {
          default: true,
          lang: 'en-US',
          localService: true,
          name: 'Test Actor',
          voiceURI: 'test-actor',
        },
      ]),
      pause: jest.fn(),
      paused: false,
      pending: false,
      resume: jest.fn(),
      speak: jest.fn(),
      speaking: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    } as unknown as SpeechSynthesis,
  });
}

function PlayerSettingsHarness(): JSX.Element {
  const { customSet, customSequence, ...defaultSettings } = DEFAULT_TRAINING_SETTINGS;
  const initialSettings: FormTrainingSettings = {
    ...defaultSettings,
    customSet: [...customSet],
    ...(customSequence ? { customSequence: [...customSequence] } : {}),
  };
  const [settings, setSettings] = useState<FormTrainingSettings>(initialSettings);

  return <PlayerSettingsForm settings={settings} setSettings={setSettings} />;
}

describe('PlayerSettingsForm', (): void => {
  beforeEach((): void => {
    jest.clearAllMocks();
    mockSpeechSynthesis();
  });

  it('should render learning-by-listening controls', async (): Promise<void> => {
    render(<PlayerSettingsHarness />);

    expect(screen.getByText(/Player Listening Practice/i)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Random letters from current alphabet/i }))
      .toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Speak letter after Morse/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Morse repeats before speech/i)).toHaveValue(1);
    expect(screen.getByLabelText(/Delay after each letter/i)).toHaveValue(2);

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /Speech actor/i })).toHaveTextContent(
        'Test Actor (en-US)',
      );
    });
  });

  it('should update repeat count and random mode', async (): Promise<void> => {
    const user = userEvent.setup();
    render(<PlayerSettingsHarness />);

    await user.click(screen.getByRole('checkbox', { name: /Random letters from current alphabet/i }));
    await user.click(screen.getByLabelText(/Morse repeats before speech/i));
    await user.keyboard('{Control>}a{/Control}3');

    expect(screen.getByRole('checkbox', { name: /Random letters from current alphabet/i }))
      .toBeChecked();
    expect(screen.getByLabelText(/Morse repeats before speech/i)).toHaveValue(3);
  });
});
