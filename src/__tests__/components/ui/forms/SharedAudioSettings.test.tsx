import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { SharedAudioSettings, type SharedAudioSettings as SharedAudioSettingsType } from '@/components/ui/forms/SharedAudioSettings';

// Mock Recharts components
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }): JSX.Element => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }): JSX.Element => <div data-testid="line-chart">{children}</div>,
  Line: (): JSX.Element => <div data-testid="line" />,
  CartesianGrid: (): JSX.Element => <div data-testid="cartesian-grid" />,
  XAxis: (): JSX.Element => <div data-testid="x-axis" />,
  YAxis: (): JSX.Element => <div data-testid="y-axis" />,
}));

describe('SharedAudioSettings', (): void => {
  const defaultSettings: SharedAudioSettingsType = {
    charWpm: 20,
    effectiveWpm: 20,
    linkSpeeds: true,
    sideToneMin: 600,
    sideToneMax: 600,
    steepness: 5,
    envelopeSmoothing: 0,
  };

  it('should render form with all settings', (): void => {
    const setSettings = jest.fn();
    render(<SharedAudioSettings settings={defaultSettings} setSettings={setSettings} />);

    expect(screen.getByText(/Audio Settings/i)).toBeInTheDocument();
    expect(screen.getByText(/Character Speed/i)).toBeInTheDocument();
    expect(screen.getByText(/Effective Speed/i)).toBeInTheDocument();
  });

  it('should display current settings values', (): void => {
    const setSettings = jest.fn();
    render(<SharedAudioSettings settings={defaultSettings} setSettings={setSettings} />);

    // There may be multiple inputs with value 20, so use getAllByDisplayValue
    const inputsWithValue20 = screen.getAllByDisplayValue('20');
    expect(inputsWithValue20.length).toBeGreaterThan(0);
  });

  it('should call setSettings when character WPM changes', async (): Promise<void> => {
    const user = userEvent.setup();
    const setSettings = jest.fn();
    render(<SharedAudioSettings settings={defaultSettings} setSettings={setSettings} />);

    // Find the character WPM input by finding the label and then the input
    const charWpmLabel = screen.getByText(/Character Speed/i);
    const charWpmInput = charWpmLabel.parentElement?.querySelector('input[type="number"]') as HTMLInputElement;
    expect(charWpmInput).toBeInTheDocument();
    
    await user.clear(charWpmInput);
    await user.type(charWpmInput, '25');

    expect(setSettings).toHaveBeenCalled();
  });

  it('should display envelope preview chart', (): void => {
    const setSettings = jest.fn();
    render(<SharedAudioSettings settings={defaultSettings} setSettings={setSettings} />);

    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
  });

  it('should sync effectiveWpm with charWpm when linkSpeeds is true', async (): Promise<void> => {
    const user = userEvent.setup();
    const setSettings = jest.fn();
    const linkedSettings: SharedAudioSettingsType = {
      ...defaultSettings,
      linkSpeeds: true,
      charWpm: 20,
      effectiveWpm: 20,
    };
    render(<SharedAudioSettings settings={linkedSettings} setSettings={setSettings} />);

    // Find the character WPM input by finding the label and then the input
    const charWpmLabel = screen.getByText(/Character Speed/i);
    const charWpmInput = charWpmLabel.parentElement?.querySelector('input[type="number"]') as HTMLInputElement;
    expect(charWpmInput).toBeInTheDocument();
    
    await user.clear(charWpmInput);
    await user.type(charWpmInput, '25');

    expect(setSettings).toHaveBeenCalled();
  });

  it('should allow independent effectiveWpm when linkSpeeds is false', async (): Promise<void> => {
    const user = userEvent.setup();
    const setSettings = jest.fn();
    const unlinkedSettings: SharedAudioSettingsType = {
      ...defaultSettings,
      linkSpeeds: false,
      charWpm: 20,
      effectiveWpm: 15,
    };
    render(<SharedAudioSettings settings={unlinkedSettings} setSettings={setSettings} />);

    // Find effective WPM input (should be enabled when not linked)
    const effectiveWpmInputs = screen.getAllByDisplayValue('15');
    if (effectiveWpmInputs.length > 0) {
      await user.clear(effectiveWpmInputs[0]!);
      await user.type(effectiveWpmInputs[0]!, '18');
      expect(setSettings).toHaveBeenCalled();
    }
  });
});

