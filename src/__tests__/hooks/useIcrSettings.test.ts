import { renderHook, act } from '@testing-library/react';

import { DEFAULT_ICR_SETTINGS } from '@/config/training.config';
import { useIcrSettings } from '@/hooks/useIcrSettings';
import type { IcrSettings } from '@/types';

const STORAGE_KEY = 'morse_icr_settings';

describe('useIcrSettings', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  it('should initialize with default settings when localStorage is empty', () => {
    const { result } = renderHook(() => useIcrSettings(STORAGE_KEY));

    expect(result.current.icrSettings).toEqual(DEFAULT_ICR_SETTINGS);
  });

  it('should load settings from localStorage on mount', () => {
    const savedSettings: IcrSettings = {
      ...DEFAULT_ICR_SETTINGS,
      trialsPerSession: 50,
      trialDelayMs: 1000,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedSettings));

    const { result } = renderHook(() => useIcrSettings(STORAGE_KEY));

    expect(result.current.icrSettings).toEqual(savedSettings);
  });

  it('should persist settings to localStorage when updated', () => {
    const { result } = renderHook(() => useIcrSettings(STORAGE_KEY));

    act(() => {
      result.current.setIcrSettings({
        ...DEFAULT_ICR_SETTINGS,
        trialsPerSession: 40,
      });
    });

    const stored = localStorage.getItem(STORAGE_KEY);
    expect(stored).toBeTruthy();
    if (stored) {
      const parsed = JSON.parse(stored);
      expect(parsed.trialsPerSession).toBe(40);
    }
  });

  it('should normalize invalid values from localStorage', () => {
    const invalidSettings = {
      trialsPerSession: -5, // Should be clamped to min 1
      trialDelayMs: 15000, // Should be clamped to max 10000
      vadThreshold: 2, // Should be clamped to max 1
      bucketYellowMaxMs: 50, // Should be adjusted if less than bucketGreenMaxMs
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(invalidSettings));

    const { result } = renderHook(() => useIcrSettings(STORAGE_KEY));

    expect(result.current.icrSettings.trialsPerSession).toBeGreaterThanOrEqual(1);
    expect(result.current.icrSettings.trialDelayMs).toBeLessThanOrEqual(10000);
    expect(result.current.icrSettings.vadThreshold).toBeLessThanOrEqual(1);
    expect(result.current.icrSettings.bucketYellowMaxMs).toBeGreaterThanOrEqual(
      result.current.icrSettings.bucketGreenMaxMs,
    );
  });

  it('should handle function updates in setIcrSettings', () => {
    const { result } = renderHook(() => useIcrSettings(STORAGE_KEY));

    act(() => {
      result.current.setIcrSettings((prev) => ({
        ...prev,
        trialsPerSession: prev.trialsPerSession + 10,
      }));
    });

    expect(result.current.icrSettings.trialsPerSession).toBe(
      DEFAULT_ICR_SETTINGS.trialsPerSession + 10,
    );
  });

  it('should update settings with updateIcrSettings', () => {
    const { result } = renderHook(() => useIcrSettings(STORAGE_KEY));

    act(() => {
      result.current.updateIcrSettings({
        trialsPerSession: 25,
        vadEnabled: false,
      });
    });

    expect(result.current.icrSettings.trialsPerSession).toBe(25);
    expect(result.current.icrSettings.vadEnabled).toBe(false);
    expect(result.current.icrSettings.trialDelayMs).toBe(DEFAULT_ICR_SETTINGS.trialDelayMs);
  });

  it('should reset settings to defaults', () => {
    const { result } = renderHook(() => useIcrSettings(STORAGE_KEY));

    act(() => {
      result.current.setIcrSettings({
        ...DEFAULT_ICR_SETTINGS,
        trialsPerSession: 100,
      });
    });

    expect(result.current.icrSettings.trialsPerSession).toBe(100);

    act(() => {
      result.current.resetIcrSettings();
    });

    expect(result.current.icrSettings).toEqual(DEFAULT_ICR_SETTINGS);
  });

  it('should handle localStorage errors gracefully', () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

    // Mock localStorage.getItem to throw
    const originalGetItem = localStorage.getItem;
    localStorage.getItem = jest.fn(() => {
      throw new Error('Storage error');
    });

    const { result } = renderHook(() => useIcrSettings(STORAGE_KEY));

    // Should still initialize with defaults
    expect(result.current.icrSettings).toEqual(DEFAULT_ICR_SETTINGS);

    localStorage.getItem = originalGetItem;
    consoleSpy.mockRestore();
  });

  it('should handle different storage keys', () => {
    const customKey = 'custom_icr_settings';
    const customSettings: IcrSettings = {
      ...DEFAULT_ICR_SETTINGS,
      trialsPerSession: 60,
    };

    localStorage.setItem(customKey, JSON.stringify(customSettings));

    const { result } = renderHook(() => useIcrSettings(customKey));

    expect(result.current.icrSettings.trialsPerSession).toBe(60);
  });

  it('should ensure vadHoldMs is at least 20', () => {
    const invalidSettings = {
      ...DEFAULT_ICR_SETTINGS,
      vadHoldMs: 10, // Less than minimum
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(invalidSettings));

    const { result } = renderHook(() => useIcrSettings(STORAGE_KEY));

    expect(result.current.icrSettings.vadHoldMs).toBeGreaterThanOrEqual(20);
  });

  it('should preserve micDeviceId when provided', () => {
    const settingsWithMic: IcrSettings = {
      ...DEFAULT_ICR_SETTINGS,
      micDeviceId: 'device-123',
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(settingsWithMic));

    const { result } = renderHook(() => useIcrSettings(STORAGE_KEY));

    expect(result.current.icrSettings.micDeviceId).toBe('device-123');
  });
});

