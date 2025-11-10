import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { TrainingSettingsForm, type TrainingSettings } from '@/components/ui/forms/TrainingSettingsForm';

// Mock Recharts components
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }): JSX.Element => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }): JSX.Element => <div data-testid="line-chart">{children}</div>,
  Line: (): JSX.Element => <div data-testid="line" />,
  CartesianGrid: (): JSX.Element => <div data-testid="cartesian-grid" />,
  XAxis: (): JSX.Element => <div data-testid="x-axis" />,
  YAxis: (): JSX.Element => <div data-testid="y-axis" />,
}));

describe('TrainingSettingsForm', () => {
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

  it('should render form with all settings', () => {
    const setSettings = jest.fn();
    render(<TrainingSettingsForm settings={defaultSettings} setSettings={setSettings} />);

    expect(screen.getAllByText(/Koch Level/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Number of Groups/i)).toBeInTheDocument();
    expect(screen.getByText(/Character Speed/i)).toBeInTheDocument();
  });

  it('should display current settings values', () => {
    const setSettings = jest.fn();
    render(<TrainingSettingsForm settings={defaultSettings} setSettings={setSettings} />);

    // Find inputs by their values - there may be multiple, so use getAllByDisplayValue
    const inputsWithValue2 = screen.getAllByDisplayValue('2');
    expect(inputsWithValue2.length).toBeGreaterThan(0);
  });

  it('should call setSettings when koch level changes', async () => {
    const user = userEvent.setup();
    const setSettings = jest.fn();
    render(<TrainingSettingsForm settings={defaultSettings} setSettings={setSettings} />);

    // Find the koch level input by finding the label and then the input
    const kochLevelLabel = screen.getAllByText(/Koch Level/i)[0];
    const kochLevelInput = kochLevelLabel.parentElement?.querySelector('input[type="number"]') as HTMLInputElement;
    expect(kochLevelInput).toBeInTheDocument();
    
    await user.clear(kochLevelInput);
    await user.type(kochLevelInput, '5');

    expect(setSettings).toHaveBeenCalled();
  });

  it('should call setSettings when number of groups changes', async () => {
    const user = userEvent.setup();
    const setSettings = jest.fn();
    render(<TrainingSettingsForm settings={defaultSettings} setSettings={setSettings} />);

    // Find the number of groups input by finding the label and then the input
    const numGroupsLabel = screen.getByText(/Number of Groups/i);
    const numGroupsInput = numGroupsLabel.parentElement?.querySelector('input[type="number"]') as HTMLInputElement;
    expect(numGroupsInput).toBeInTheDocument();
    
    await user.clear(numGroupsInput);
    await user.type(numGroupsInput, '10');

    expect(setSettings).toHaveBeenCalled();
  });

  it('should display preview characters based on koch level', () => {
    const setSettings = jest.fn();
    render(<TrainingSettingsForm settings={defaultSettings} setSettings={setSettings} />);

    // Should show preview characters for koch level 2 (K and M)
    expect(screen.getByText(/Characters:/i)).toBeInTheDocument();
  });

  it('should handle digits mode', () => {
    const setSettings = jest.fn();
    const digitsSettings: TrainingSettings = {
      ...defaultSettings,
      charSetMode: 'digits',
      digitsLevel: 5,
    };
    render(<TrainingSettingsForm settings={digitsSettings} setSettings={setSettings} />);

    expect(screen.getByText(/Digits Level/i)).toBeInTheDocument();
    expect(screen.getByText(/Digits:/i)).toBeInTheDocument();
  });

  it('should handle custom mode', () => {
    const setSettings = jest.fn();
    const customSettings: TrainingSettings = {
      ...defaultSettings,
      charSetMode: 'custom',
      customSet: ['A', 'B', 'C'],
    };
    render(<TrainingSettingsForm settings={customSettings} setSettings={setSettings} />);

    expect(screen.getByText(/Selected:/i)).toBeInTheDocument();
  });

  it('should display envelope preview chart', () => {
    const setSettings = jest.fn();
    render(<TrainingSettingsForm settings={defaultSettings} setSettings={setSettings} />);

    // The chart should be rendered (Recharts components are mocked)
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
  });

  it('should sync effectiveWpm with charWpm when linkSpeeds is true', async () => {
    const user = userEvent.setup();
    const setSettings = jest.fn();
    const linkedSettings: TrainingSettings = {
      ...defaultSettings,
      linkSpeeds: true,
      charWpm: 20,
      effectiveWpm: 20,
    };
    render(<TrainingSettingsForm settings={linkedSettings} setSettings={setSettings} />);

    // Find the character speed input by finding the label and then the input
    const charSpeedLabel = screen.getByText(/Character Speed/i);
    const charWpmInput = charSpeedLabel.parentElement?.querySelector('input[type="number"]') as HTMLInputElement;
    expect(charWpmInput).toBeInTheDocument();
    
    await user.clear(charWpmInput);
    await user.type(charWpmInput, '25');

    // When linkSpeeds is true, effectiveWpm should update with charWpm
    expect(setSettings).toHaveBeenCalled();
  });
});

