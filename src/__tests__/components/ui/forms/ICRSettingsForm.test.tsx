import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { ICRSettingsForm } from '@/components/ui/forms/ICRSettingsForm';
import type { IcrSettings } from '@/types';

// Mock mediaDevices
const mockGetUserMedia = jest.fn();
const mockEnumerateDevices = jest.fn();

// Mock AudioContext
const mockAudioContext = {
  createMediaStreamSource: jest.fn(() => ({
    connect: jest.fn(),
  })),
  createAnalyser: jest.fn(() => ({
    fftSize: 2048,
    smoothingTimeConstant: 0.8,
    getByteTimeDomainData: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
  })),
  close: jest.fn(),
};

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
  
  // Mock AudioContext
  global.AudioContext = jest.fn(() => mockAudioContext) as unknown as typeof AudioContext;
  global.requestAnimationFrame = jest.fn((cb) => {
    setTimeout(cb, 16);
    return 1;
  }) as unknown as typeof requestAnimationFrame;
  global.cancelAnimationFrame = jest.fn();
  global.performance = {
    now: jest.fn(() => Date.now()),
  } as unknown as Performance;
});

describe('ICRSettingsForm', (): void => {
  const defaultSettings: IcrSettings = {
    trialsPerSession: 30,
    trialDelayMs: 700,
    vadEnabled: true,
    vadThreshold: 0.1,
    vadHoldMs: 100,
    bucketGreenMaxMs: 500,
    bucketYellowMaxMs: 1000,
    bucketOrangeMaxMs: 1200,
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

  it('should call setSettings when trial delay changes', async (): Promise<void> => {
    const user = userEvent.setup();
    const setSettings = jest.fn();
    await act(async () => {
      render(<ICRSettingsForm settings={defaultSettings} setSettings={setSettings} />);
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue('700')).toBeInTheDocument();
    });

    const trialDelayInput = screen.getByDisplayValue('700');
    
    await act(async () => {
      await user.clear(trialDelayInput);
      await user.type(trialDelayInput, '1000');
    });

    expect(setSettings).toHaveBeenCalled();
  });

  it('should have VAD threshold slider', async (): Promise<void> => {
    const setSettings = jest.fn();
    await act(async () => {
      render(<ICRSettingsForm settings={defaultSettings} setSettings={setSettings} />);
    });

    await waitFor(() => {
      expect(screen.getByText(/Threshold:/i)).toBeInTheDocument();
    });

    const thresholdLabel = screen.getAllByText(/Threshold:/i)[0];
    expect(thresholdLabel).toBeDefined();
    const thresholdInput = thresholdLabel!.parentElement?.querySelector('input[type="range"]') as HTMLInputElement;
    
    expect(thresholdInput).toBeInTheDocument();
    expect(thresholdInput.value).toBe('0.1');
  });

  it('should have VAD hold slider', async (): Promise<void> => {
    const setSettings = jest.fn();
    await act(async () => {
      render(<ICRSettingsForm settings={defaultSettings} setSettings={setSettings} />);
    });

    await waitFor(() => {
      expect(screen.getByText(/Hold \(ms\):/i)).toBeInTheDocument();
    });

    const holdLabel = screen.getByText(/Hold \(ms\):/i);
    const holdInput = holdLabel.parentElement?.querySelector('input[type="range"]') as HTMLInputElement;
    
    expect(holdInput).toBeInTheDocument();
    expect(holdInput.value).toBe('100');
  });

  it('should call setSettings when mic device changes', async (): Promise<void> => {
    const user = userEvent.setup();
    const setSettings = jest.fn();
    await act(async () => {
      render(<ICRSettingsForm settings={defaultSettings} setSettings={setSettings} />);
    });

    await waitFor(() => {
      expect(screen.getByText(/Mic & VAD/i)).toBeInTheDocument();
    });

    // Find select by its label text more specifically
    const micLabels = screen.getAllByText(/Microphone/i);
    const micLabel = micLabels.find(label => label.parentElement?.querySelector('select'));
    const micSelect = micLabel?.parentElement?.querySelector('select') as HTMLSelectElement;
    
    if (micSelect) {
      await act(async () => {
        await user.selectOptions(micSelect, 'device1');
      });

      expect(setSettings).toHaveBeenCalled();
    }
  });

  it('should call setSettings when bucket green max changes', async (): Promise<void> => {
    const user = userEvent.setup();
    const setSettings = jest.fn();
    await act(async () => {
      render(<ICRSettingsForm settings={defaultSettings} setSettings={setSettings} />);
    });

    await waitFor(() => {
      expect(screen.getByText(/Performance Buckets/i)).toBeInTheDocument();
    });

    const greenInput = screen.getByLabelText(/Green/i) as HTMLInputElement;
    await act(async () => {
      await user.clear(greenInput);
      await user.type(greenInput, '400');
      greenInput.blur();
    });
    expect(setSettings).toHaveBeenCalled();
  });

  it('should call setSettings when bucket yellow max changes', async (): Promise<void> => {
    const user = userEvent.setup();
    const setSettings = jest.fn();
    await act(async () => {
      render(<ICRSettingsForm settings={defaultSettings} setSettings={setSettings} />);
    });

    await waitFor(() => {
      expect(screen.getByText(/Performance Buckets/i)).toBeInTheDocument();
    });

    const yellowInput = screen.getByLabelText(/Yellow/i) as HTMLInputElement;
    await act(async () => {
      await user.clear(yellowInput);
      await user.type(yellowInput, '1200');
      yellowInput.blur();
    });
    expect(setSettings).toHaveBeenCalled();
  });

  it('should start mic preview when start button is clicked', async (): Promise<void> => {
    const user = userEvent.setup();
    const setSettings = jest.fn();
    await act(async () => {
      render(<ICRSettingsForm settings={defaultSettings} setSettings={setSettings} />);
    });

    await waitFor(() => {
      expect(screen.getByText(/Start Preview/i)).toBeInTheDocument();
    });

    const startButton = screen.getByRole('button', { name: /Start Preview/i });
    
    await act(async () => {
      await user.click(startButton);
    });

    await waitFor(() => {
      expect(mockGetUserMedia).toHaveBeenCalled();
    });
  });

  it('should stop mic preview when stop button is clicked', async (): Promise<void> => {
    const user = userEvent.setup();
    const setSettings = jest.fn();
    const mockTrack = { stop: jest.fn() };
    mockGetUserMedia.mockResolvedValue({
      getTracks: jest.fn(() => [mockTrack]),
    });

    await act(async () => {
      render(<ICRSettingsForm settings={defaultSettings} setSettings={setSettings} />);
    });

    await waitFor(() => {
      expect(screen.getByText(/Start Preview/i)).toBeInTheDocument();
    });

    // Start preview first
    const startButton = screen.getByRole('button', { name: /Start Preview/i });
    await act(async () => {
      await user.click(startButton);
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Stop Preview/i })).toBeInTheDocument();
    });

    // Then stop it
    const stopButton = screen.getByRole('button', { name: /Stop Preview/i });
    await act(async () => {
      await user.click(stopButton);
    });

    expect(mockTrack.stop).toHaveBeenCalled();
  });

  it('should handle mic device enumeration', async (): Promise<void> => {
    const setSettings = jest.fn();
    mockEnumerateDevices.mockResolvedValue([
      {
        deviceId: 'device1',
        kind: 'audioinput',
        label: 'Microphone 1',
        groupId: 'group1',
      },
      {
        deviceId: 'device2',
        kind: 'audioinput',
        label: 'Microphone 2',
        groupId: 'group2',
      },
    ]);

    await act(async () => {
      render(<ICRSettingsForm settings={defaultSettings} setSettings={setSettings} />);
    });

    await waitFor(() => {
      expect(mockEnumerateDevices).toHaveBeenCalled();
    });
  });

  it('should handle mic preview with specific device ID', async (): Promise<void> => {
    const user = userEvent.setup();
    const setSettings = jest.fn();
    const settingsWithDevice: IcrSettings = {
      ...defaultSettings,
      micDeviceId: 'device1',
    };

    await act(async () => {
      render(<ICRSettingsForm settings={settingsWithDevice} setSettings={setSettings} />);
    });

    await waitFor(() => {
      expect(screen.getByText(/Start Preview/i)).toBeInTheDocument();
    });

    const startButton = screen.getByRole('button', { name: /Start Preview/i });
    
    await act(async () => {
      await user.click(startButton);
    });

    await waitFor(() => {
      expect(mockGetUserMedia).toHaveBeenCalledWith(
        expect.objectContaining({
          audio: { deviceId: { ideal: 'device1' } },
        }),
      );
    });
  });

  it('should display mic level and threshold indicators', async (): Promise<void> => {
    const setSettings = jest.fn();
    await act(async () => {
      render(<ICRSettingsForm settings={defaultSettings} setSettings={setSettings} />);
    });

    await waitFor(() => {
      expect(screen.getByText(/ICR Settings/i)).toBeInTheDocument();
    });

    // These elements should be present - use getAllByText for multiple matches
    expect(screen.getAllByText(/Mic Level/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Threshold/i).length).toBeGreaterThan(0);
  });

  it('should display hold to trigger indicator', async (): Promise<void> => {
    const setSettings = jest.fn();
    await act(async () => {
      render(<ICRSettingsForm settings={defaultSettings} setSettings={setSettings} />);
    });

    await waitFor(() => {
      expect(screen.getByText(/ICR Settings/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Hold to trigger/i)).toBeInTheDocument();
  });
});

