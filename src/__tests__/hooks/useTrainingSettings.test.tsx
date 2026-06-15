import { renderHook, act, waitFor } from '@testing-library/react';

import { useTrainingSettingsState, useTrainingSettingsActions } from '@/hooks/useTrainingSettings';
import type { IcrSessionService } from '@/lib/services/icr-session.service';
import type { SessionService } from '@/lib/services/session.service';
import type { TrainingSettingsService } from '@/lib/services/training-settings.service';
import { AppStoreProvider } from '@/store/providers/app-store-provider';
import type { TrainingSettings } from '@/types';

// Mock services
const mockTrainingSettingsService: TrainingSettingsService = {
  getSettings: jest.fn(),
  saveSettings: jest.fn(),
  patchSettings: jest.fn(),
  resetSettings: jest.fn(),
} as unknown as TrainingSettingsService;

const mockSessionService = {
  listSessions: jest.fn(),
  upsertSession: jest.fn(),
  replaceAll: jest.fn(),
  deleteSession: jest.fn(),
  syncPending: jest.fn(),
  processRetryQueue: jest.fn(),
} as unknown as SessionService;

const mockIcrSessionService: IcrSessionService = {
  listSessions: jest.fn(),
  saveSession: jest.fn(),
  clearSessions: jest.fn(),
  deleteSession: jest.fn(),
};

const defaultTrainingSettings: TrainingSettings = {
  kochLevel: 2,
  charSetMode: 'koch',
  digitsLevel: 10,
  mixedLettersPercent: 70,
  customSet: [],
  slidingWindowStart: 1,
  slidingWindowEnd: 40,
  sideToneMin: 600,
  sideToneMax: 600,
  volumeMin: 1,
  volumeMax: 1,
  linkVolume: true,
  steepness: 5,
  sessionDuration: 5,
  charsPerGroup: 5,
  numGroups: 5,
  charWpmMin: 20,
  charWpmMax: 20,
  linkCharWpm: true,
  effectiveWpmMin: 20,
  effectiveWpmMax: 20,
  linkEffectiveWpm: true,
  linkCharToEffective: true,
  extraWordSpaceMultiplier: 1,
  groupTimeout: 10,
  minGroupSize: 2,
  maxGroupSize: 3,
  linkGroupSize: true,
  envelopeSmoothing: 0,
  qsbEnabled: false,
  qsbDepth: 0.35,
  qsbRateHz: 0.12,
  qrnEnabled: false,
  qrnLevel: 0.25,
  qrmEnabled: false,
  qrmLevel: 0.2,
  qrmProfile: 'mixed',
  receiverBackgroundGain: 20,
  receiverBackgroundExcitationRate: 62,
  receiverBackgroundResonance: 66,
  receiverBackgroundDecay: 0.984,
  receiverBackgroundOffsetHz: 140,
  receiverBackgroundOffsetModDepthHz: 45,
  receiverBackgroundOffsetModRateHz: 0.32,
  autoAdjustKoch: false,
  autoAdjustThreshold: 90,
  autoAdjustBelowThresholdCount: 1,
  autoAdjustAboveThresholdCount: 1,
  echoAutoAdjustKoch: false,
  echoAutoAdjustThreshold: 90,
  echoAutoAdjustBelowThresholdCount: 1,
  echoAutoAdjustAboveThresholdCount: 1,
  chaseLives: 3,
  chaseAutoLevelEnabled: true,
  chaseGroupsPerLevel: 5,
  chaseStartFallMs: 7200,
  chaseMinFallMs: 1800,
  chaseLevelSpeedupMs: 430,
  chaseGroupSpeedupMs: 28,
  errorWeightStrength: 0,
};

function TestWrapper({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <AppStoreProvider
      user={null}
      sessionService={mockSessionService}
      trainingSettingsService={mockTrainingSettingsService}
      icrSessionService={mockIcrSessionService}
    >
      {children}
    </AppStoreProvider>
  );
}

const createWrapper = (): React.ComponentType<{ children: React.ReactNode }> => TestWrapper;

// Helper to wait for AppStoreProvider's initial async loads to complete
// The AppStoreProvider's useEffect calls loadTrainingSettings, loadSessions, and loadIcrSessions
// We need to wait for these to complete to avoid act() warnings
const waitForInitialLoads = async (): Promise<void> => {
  // Wait for the useEffect to run and start the async operations
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });

  // Wait for all the mock service calls to complete
  // Since the mocks are set up in beforeEach to return immediately,
  // we just need to wait for React to process the state updates
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
};

describe('useTrainingSettingsState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock services to return immediately to avoid act warnings
    (mockTrainingSettingsService.getSettings as jest.Mock).mockResolvedValue(
      defaultTrainingSettings,
    );
    (mockSessionService.listSessions as jest.Mock).mockResolvedValue([]);
    (mockIcrSessionService.listSessions as jest.Mock).mockResolvedValue([]);
  });

  it('should return training settings state', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useTrainingSettingsState(), { wrapper });

    // Wait for AppStoreProvider's initial async loads
    await waitForInitialLoads();

    // Wait for initial load to complete
    await waitFor(() => {
      expect(result.current.trainingSettingsStatus).not.toBe('loading');
    });

    expect(result.current).toHaveProperty('trainingSettings');
    expect(result.current).toHaveProperty('trainingSettingsStatus');
    expect(result.current).toHaveProperty('trainingSettingsSaving');
  });

  it('should return default training settings initially', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useTrainingSettingsState(), { wrapper });

    // Wait for AppStoreProvider's initial async loads
    await waitForInitialLoads();

    // Wait for initial load to complete
    await waitFor(() => {
      expect(result.current.trainingSettingsStatus).not.toBe('loading');
    });

    expect(result.current.trainingSettings).toBeDefined();
    expect(result.current.trainingSettingsStatus).toBeDefined();
    expect(result.current.trainingSettingsSaving).toBe(false);
  });
});

describe('useTrainingSettingsActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock services to return immediately to avoid act warnings
    (mockTrainingSettingsService.getSettings as jest.Mock).mockResolvedValue(
      defaultTrainingSettings,
    );
    (mockSessionService.listSessions as jest.Mock).mockResolvedValue([]);
    (mockIcrSessionService.listSessions as jest.Mock).mockResolvedValue([]);
  });

  it('should return all action functions', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useTrainingSettingsActions(), { wrapper });

    // Wait for AppStoreProvider's initial async loads
    await waitForInitialLoads();

    expect(result.current).toHaveProperty('loadTrainingSettings');
    expect(result.current).toHaveProperty('saveTrainingSettings');
    expect(result.current).toHaveProperty('patchTrainingSettings');
    expect(result.current).toHaveProperty('resetTrainingSettings');
    expect(result.current).toHaveProperty('setTrainingSettingsState');
  });

  it('should call loadTrainingSettings', async () => {
    const mockSettings = defaultTrainingSettings;
    (mockTrainingSettingsService.getSettings as jest.Mock).mockResolvedValue(mockSettings);

    const wrapper = createWrapper();
    const { result } = renderHook(() => useTrainingSettingsActions(), { wrapper });

    // Wait for AppStoreProvider's initial async loads
    await waitForInitialLoads();

    await act(async () => {
      await result.current.loadTrainingSettings();
    });

    expect(mockTrainingSettingsService.getSettings).toHaveBeenCalled();
  });

  it('should call saveTrainingSettings', async () => {
    const mockSettings = defaultTrainingSettings;
    (mockTrainingSettingsService.saveSettings as jest.Mock).mockResolvedValue(mockSettings);

    const wrapper = createWrapper();
    const { result } = renderHook(() => useTrainingSettingsActions(), { wrapper });

    // Wait for AppStoreProvider's initial async loads
    await waitForInitialLoads();

    await act(async () => {
      await result.current.saveTrainingSettings({
        kochLevel: 3,
        charSetMode: 'koch',
        digitsLevel: 10,
        mixedLettersPercent: 70,
        customSet: [],
        slidingWindowStart: 1,
        slidingWindowEnd: 40,
        sideToneMin: 600,
        sideToneMax: 600,
        volumeMin: 1,
        volumeMax: 1,
        linkVolume: true,
        steepness: 5,
        sessionDuration: 5,
        charsPerGroup: 5,
        numGroups: 5,
        charWpmMin: 20,
        charWpmMax: 20,
        linkCharWpm: true,
        effectiveWpmMin: 20,
        effectiveWpmMax: 20,
        linkEffectiveWpm: true,
        linkCharToEffective: true,
        echoKeyerMode: 'manual',
        extraWordSpaceMultiplier: 1,
        groupTimeout: 10,
        minGroupSize: 2,
        maxGroupSize: 3,
        linkGroupSize: true,
        envelopeSmoothing: 0,
        qsbEnabled: false,
        qsbDepth: 0.35,
        qsbRateHz: 0.12,
        qrnEnabled: false,
        qrnLevel: 0.25,
        qrmEnabled: false,
        qrmLevel: 0.2,
        qrmProfile: 'mixed',
        receiverBackgroundGain: 20,
        receiverBackgroundExcitationRate: 62,
        receiverBackgroundResonance: 66,
        receiverBackgroundDecay: 0.984,
        receiverBackgroundOffsetHz: 140,
        receiverBackgroundOffsetModDepthHz: 45,
        receiverBackgroundOffsetModRateHz: 0.32,
        autoAdjustKoch: false,
        autoAdjustThreshold: 90,
        autoAdjustBelowThresholdCount: 1,
        autoAdjustAboveThresholdCount: 1,
        echoAutoAdjustKoch: false,
        echoAutoAdjustThreshold: 90,
        echoAutoAdjustBelowThresholdCount: 1,
        echoAutoAdjustAboveThresholdCount: 1,
        errorWeightStrength: 0,
      });
    });

    expect(mockTrainingSettingsService.saveSettings).toHaveBeenCalled();
  });

  it('should call patchTrainingSettings', async () => {
    const mockSettings = defaultTrainingSettings;
    (mockTrainingSettingsService.patchSettings as jest.Mock).mockResolvedValue(mockSettings);

    const wrapper = createWrapper();
    const { result } = renderHook(() => useTrainingSettingsActions(), { wrapper });

    // Wait for AppStoreProvider's initial async loads
    await waitForInitialLoads();

    await act(async () => {
      await result.current.patchTrainingSettings({ kochLevel: 4 });
    });

    expect(mockTrainingSettingsService.patchSettings).toHaveBeenCalled();
  });

  it('should call resetTrainingSettings', async () => {
    const mockSettings = defaultTrainingSettings;
    (mockTrainingSettingsService.resetSettings as jest.Mock).mockResolvedValue(mockSettings);

    const wrapper = createWrapper();
    const { result } = renderHook(() => useTrainingSettingsActions(), { wrapper });

    // Wait for AppStoreProvider's initial async loads
    await waitForInitialLoads();

    await act(async () => {
      await result.current.resetTrainingSettings();
    });

    expect(mockTrainingSettingsService.resetSettings).toHaveBeenCalled();
  });

  it('should call setTrainingSettingsState', async () => {
    const wrapper = createWrapper();
    const { result: actionsResult } = renderHook(() => useTrainingSettingsActions(), { wrapper });

    // Wait for AppStoreProvider's initial async loads
    await waitForInitialLoads();

    const newSettings = { ...defaultTrainingSettings, kochLevel: 5 };

    // Verify the function exists and can be called
    expect(actionsResult.current.setTrainingSettingsState).toBeDefined();
    await act(async () => {
      actionsResult.current.setTrainingSettingsState(newSettings);
    });
  });

  it('should handle function updates in setTrainingSettingsState', async () => {
    const wrapper = createWrapper();
    const { result: actionsResult } = renderHook(() => useTrainingSettingsActions(), { wrapper });

    // Wait for AppStoreProvider's initial async loads
    await waitForInitialLoads();

    // Verify the function can accept a function updater
    expect(actionsResult.current.setTrainingSettingsState).toBeDefined();
    await act(async () => {
      actionsResult.current.setTrainingSettingsState((prev) => ({
        ...prev,
        kochLevel: prev.kochLevel + 1,
      }));
    });
  });
});
