import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { EchoSettingsForm } from '@/components/ui/forms/EchoSettingsForm';
import type { FormTrainingSettings } from '@/components/ui/forms/TrainingSettingsForm';
import { DEFAULT_TRAINING_SETTINGS } from '@/config/training.config';

const { customSet, customSequence, ...defaultSettings } = DEFAULT_TRAINING_SETTINGS;
const baseSettings: FormTrainingSettings = {
  ...defaultSettings,
  customSet: [...customSet],
  ...(customSequence !== undefined ? { customSequence: [...customSequence] } : {}),
};

describe('EchoSettingsForm', () => {
  it('renders manual keyer by default', () => {
    render(<EchoSettingsForm settings={baseSettings} setSettings={jest.fn()} />);
    expect(screen.getByText(/echo keyer/i)).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveValue('manual');
  });

  it('updates echoKeyerMode when iambic B is selected', async () => {
    const user = userEvent.setup();
    const setSettings = jest.fn();

    render(<EchoSettingsForm settings={baseSettings} setSettings={setSettings} />);

    await user.selectOptions(screen.getByRole('combobox'), 'iambic-b');

    expect(setSettings).toHaveBeenCalled();
    const updater = setSettings.mock.calls[0]?.[0];
    expect(typeof updater).toBe('function');
    if (typeof updater === 'function') {
      const next = updater(baseSettings);
      expect(next.echoKeyerMode).toBe('iambic-b');
    }
  });
});
