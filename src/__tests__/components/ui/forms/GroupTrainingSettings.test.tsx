import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { GroupTrainingSettings, type GroupTrainingSettings as GroupTrainingSettingsType } from '@/components/ui/forms/GroupTrainingSettings';

describe('GroupTrainingSettings', (): void => {
  const defaultSettings: GroupTrainingSettingsType = {
    sessionDuration: 5,
    charsPerGroup: 5,
    numGroups: 5,
    groupTimeout: 10,
    minGroupSize: 2,
    maxGroupSize: 3,
    interactiveMode: false,
    extraWordSpaceMultiplier: 1,
    autoAdjustKoch: false,
    autoAdjustThreshold: 90,
  };

  it('should render form with all settings', (): void => {
    const setSettings = jest.fn();
    render(<GroupTrainingSettings settings={defaultSettings} setSettings={setSettings} />);

    expect(screen.getByText(/Group Training Settings/i)).toBeInTheDocument();
    expect(screen.getByText(/Session Duration/i)).toBeInTheDocument();
    expect(screen.getByText(/Characters per Group/i)).toBeInTheDocument();
  });

  it('should display current settings values', (): void => {
    const setSettings = jest.fn();
    render(<GroupTrainingSettings settings={defaultSettings} setSettings={setSettings} />);

    // There may be multiple inputs with value 5, so use getAllByDisplayValue
    const inputsWithValue5 = screen.getAllByDisplayValue('5');
    expect(inputsWithValue5.length).toBeGreaterThan(0);
  });

  it('should call setSettings when session duration changes', async (): Promise<void> => {
    const user = userEvent.setup();
    const setSettings = jest.fn();
    render(<GroupTrainingSettings settings={defaultSettings} setSettings={setSettings} />);

    const sessionDurationLabel = screen.getByText(/Session Duration/i);
    const sessionDurationInput = sessionDurationLabel.parentElement?.querySelector('input[type="number"]') as HTMLInputElement;
    expect(sessionDurationInput).toBeInTheDocument();
    
    await user.clear(sessionDurationInput);
    await user.type(sessionDurationInput, '10');

    expect(setSettings).toHaveBeenCalled();
  });

  it('should call setSettings when chars per group changes', async (): Promise<void> => {
    const user = userEvent.setup();
    const setSettings = jest.fn();
    render(<GroupTrainingSettings settings={defaultSettings} setSettings={setSettings} />);

    const charsPerGroupLabel = screen.getByText(/Characters per Group/i);
    const charsPerGroupInput = charsPerGroupLabel.parentElement?.querySelector('input[type="number"]') as HTMLInputElement;
    expect(charsPerGroupInput).toBeInTheDocument();
    
    await user.clear(charsPerGroupInput);
    await user.type(charsPerGroupInput, '7');

    expect(setSettings).toHaveBeenCalled();
  });

  it('should toggle interactive mode checkbox', async (): Promise<void> => {
    const user = userEvent.setup();
    const setSettings = jest.fn();
    render(<GroupTrainingSettings settings={defaultSettings} setSettings={setSettings} />);

    const interactiveModeLabel = screen.getByText(/Interactive Mode/i);
    const interactiveModeCheckbox = interactiveModeLabel.parentElement?.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(interactiveModeCheckbox).toBeInTheDocument();
    expect(interactiveModeCheckbox).not.toBeChecked();
    
    await user.click(interactiveModeCheckbox);

    expect(setSettings).toHaveBeenCalled();
  });
});

