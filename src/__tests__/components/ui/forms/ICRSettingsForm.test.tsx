import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { ICRSettingsForm } from '@/components/ui/forms/ICRSettingsForm';
import type { IcrSettings } from '@/types';

// Mock mediaDevices
const mockGetUserMedia = jest.fn();
const mockEnumerateDevices = jest.fn();

beforeAll((): void => {
  Object.defineProperty(navigator, 'mediaDevices', {
    writable: true,
    value: {
      getUserMedia: mockGetUserMedia,
      enumerateDevices: mockEnumerateDevices,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    },
  });
});

describe('ICRSettingsForm', (): void => {
  const defaultSettings: IcrSettings = {
    trialsPerSession: 30,
    trialDelayMs: 700,
    vadEnabled: true,
    vadThreshold: 0.1,
    vadHoldMs: 100,
    micDeviceId: undefined,
    bucketGreenMaxMs: 500,
    bucketYellowMaxMs: 1000,
  };

  beforeEach((): void => {
    jest.clearAllMocks();
    mockGetUserMedia.mockResolvedValue({
      getTracks: jest.fn(() => [
        {
          stop: jest.fn(),
        },
      ]),
    });
    mockEnumerateDevices.mockResolvedValue([
      {
        deviceId: 'device1',
        kind: 'audioinput',
        label: 'Microphone 1',
        groupId: 'group1',
      },
    ]);
  });

  it('should render form with all settings', async (): Promise<void> => {
    const setSettings = jest.fn();
    await act(async () => {
      render(<ICRSettingsForm settings={defaultSettings} setSettings={setSettings} />);
    });

    // Wait for async operations (enumerateDevices) to complete
    await waitFor(() => {
      expect(screen.getByText(/ICR Settings/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Session Settings/i)).toBeInTheDocument();
    expect(screen.getByText(/Mic & VAD/i)).toBeInTheDocument();
  });

  it('should display current settings values', async (): Promise<void> => {
    const setSettings = jest.fn();
    await act(async () => {
      render(<ICRSettingsForm settings={defaultSettings} setSettings={setSettings} />);
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue('30')).toBeInTheDocument();
    });

    expect(screen.getByDisplayValue('700')).toBeInTheDocument();
  });

  it('should call setSettings when trials per session changes', async (): Promise<void> => {
    const user = userEvent.setup();
    const setSettings = jest.fn();
    await act(async () => {
      render(<ICRSettingsForm settings={defaultSettings} setSettings={setSettings} />);
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue('30')).toBeInTheDocument();
    });

    // Find input by its value
    const trialsInput = screen.getByDisplayValue('30');
    
    await act(async () => {
      await user.clear(trialsInput);
      await user.type(trialsInput, '50');
    });

    expect(setSettings).toHaveBeenCalled();
  });

  it('should render VAD threshold slider', async (): Promise<void> => {
    const setSettings = jest.fn();
    await act(async () => {
      render(<ICRSettingsForm settings={defaultSettings} setSettings={setSettings} />);
    });

    await waitFor(() => {
      expect(screen.getByText(/Threshold:/i)).toBeInTheDocument();
    });

    // Find range input for threshold by finding the label text
    const thresholdLabel = screen.getByText(/Threshold:/i);
    const thresholdInput = thresholdLabel.parentElement?.querySelector('input[type="range"]') as HTMLInputElement;
    
    expect(thresholdInput).toBeInTheDocument();
    // Range inputs return string values
    expect(thresholdInput.value).toBe('0.1');
  });

  it('should toggle VAD enabled checkbox', async (): Promise<void> => {
    const user = userEvent.setup();
    const setSettings = jest.fn();
    await act(async () => {
      render(<ICRSettingsForm settings={defaultSettings} setSettings={setSettings} />);
    });

    await waitFor(() => {
      expect(screen.getByText(/VAD Enabled/i)).toBeInTheDocument();
    });

    // Find checkbox by finding the label text and then the checkbox
    const vadLabel = screen.getByText(/VAD Enabled/i);
    const vadCheckbox = vadLabel.parentElement?.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(vadCheckbox).toBeInTheDocument();
    expect(vadCheckbox).toBeChecked();
    
    await act(async () => {
      await user.click(vadCheckbox);
    });

    expect(setSettings).toHaveBeenCalled();
  });

  it('should show mode help when help button is clicked', async (): Promise<void> => {
    const user = userEvent.setup();
    const setSettings = jest.fn();
    await act(async () => {
      render(<ICRSettingsForm settings={defaultSettings} setSettings={setSettings} />);
    });

    await waitFor(() => {
      expect(screen.getByTitle(/What is Mic & VAD/i)).toBeInTheDocument();
    });

    // Find help button by its title attribute
    const helpButton = screen.getByTitle(/What is Mic & VAD/i);
    
    await act(async () => {
      await user.click(helpButton);
    });

    await waitFor(() => {
      // There may be multiple "Mic & VAD" texts, so just check that help content appears
      expect(screen.getByText(/Voice Activity Detection/i)).toBeInTheDocument();
    });
  });

  it('should not start mic preview by default', async (): Promise<void> => {
    const setSettings = jest.fn();
    await act(async () => {
      render(<ICRSettingsForm settings={defaultSettings} setSettings={setSettings} />);
    });

    await waitFor(() => {
      // Wait for initial render to complete
      expect(screen.getByText(/ICR Settings/i)).toBeInTheDocument();
    });

    // Mic preview should not be active initially
    expect(mockGetUserMedia).not.toHaveBeenCalled();
  });
});

