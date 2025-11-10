import { renderHook, waitFor, act } from '@testing-library/react';

import { useAuth } from '@/hooks/useAuth';
import type { IcrSessionService } from '@/lib/services/icr-session.service';
import type { SessionService } from '@/lib/services/session.service';
import type { TrainingSettingsService } from '@/lib/services/training-settings.service';
import { AppStoreProvider } from '@/store/providers/app-store-provider';

// Mock Firebase client to return null (no Firebase in tests)
jest.mock('@/lib/firebaseClient', () => ({
  initFirebase: jest.fn(() => null),
  googleSignIn: jest.fn(() => Promise.resolve(null)),
  googleSignOut: jest.fn(() => Promise.resolve()),
  getRedirectedUser: jest.fn(() => Promise.resolve(null)),
}));

const mockTrainingSettingsService: TrainingSettingsService = {
  getSettings: jest.fn(),
  saveSettings: jest.fn(),
  patchSettings: jest.fn(),
  resetSettings: jest.fn(),
} as unknown as TrainingSettingsService;

const mockSessionService: SessionService = {
  listSessions: jest.fn(),
  upsertSession: jest.fn(),
  deleteSession: jest.fn(),
  syncPendingSessions: jest.fn(),
};

const mockIcrSessionService: IcrSessionService = {
  listSessions: jest.fn(),
  saveSession: jest.fn(),
  clearSessions: jest.fn(),
  deleteSession: jest.fn(),
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
const waitForInitialLoads = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await act(async () => {
    await Promise.all([
      Promise.resolve(),
      Promise.resolve(),
      Promise.resolve(),
    ]);
  });
};

describe('useAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    // Mock services to return immediately to avoid act warnings
    (mockTrainingSettingsService.getSettings as jest.Mock).mockResolvedValue({});
    (mockSessionService.listSessions as jest.Mock).mockResolvedValue([]);
    (mockIcrSessionService.listSessions as jest.Mock).mockResolvedValue([]);
  });

  it('should initialize with firebase ready state', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAuth(), { wrapper });

    // Wait for AppStoreProvider's initial async loads
    await waitForInitialLoads();

    await waitFor(() => {
      // Firebase is mocked to return null, so firebaseReady should be false
      expect(result.current.firebaseReady).toBe(false);
    });
  });

  it('should return null user initially', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAuth(), { wrapper });

    // Wait for AppStoreProvider's initial async loads
    await waitForInitialLoads();

    // Wait for initial setup to complete
    await waitFor(() => {
      expect(result.current.firebaseReady).toBeDefined();
    });

    expect(result.current.firebaseUser).toBeNull();
    expect(result.current.appUser).toBeNull();
    expect(result.current.user).toBeNull();
    expect(result.current.authInProgress).toBe(false);
  });

  it('should handle sign in with Google', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAuth(), { wrapper });

    // Wait for AppStoreProvider's initial async loads
    await waitForInitialLoads();

    await waitFor(() => {
      expect(result.current.firebaseReady).toBe(false);
    });

    // Should throw error since Firebase is not configured
    await expect(
      act(async () => {
        await result.current.signInWithGoogle();
      }),
    ).rejects.toThrow('Firebase is not configured. Cannot sign in.');
  });

  it('should handle sign out', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAuth(), { wrapper });

    // Wait for AppStoreProvider's initial async loads
    await waitForInitialLoads();

    await waitFor(() => {
      expect(result.current.firebaseReady).toBe(false);
    });

    // Sign out should work even without Firebase
    await act(async () => {
      await result.current.signOut();
    });

    expect(result.current.firebaseUser).toBeNull();
  });

  it('should handle switch account', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAuth(), { wrapper });

    // Wait for AppStoreProvider's initial async loads
    await waitForInitialLoads();

    await waitFor(() => {
      expect(result.current.firebaseReady).toBe(false);
    });

    // Should throw error since Firebase is not configured
    await expect(
      act(async () => {
        await result.current.switchAccount();
      }),
    ).rejects.toThrow('Firebase is not configured. Cannot sign in.');
  });

  // This test is already covered in the "should handle sign in with Google" test

  // Firebase-dependent tests removed - Firebase is mocked to return null in tests

  it('should return null firebase services when not configured', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAuth(), { wrapper });

    // Wait for AppStoreProvider's initial async loads
    await waitForInitialLoads();

    await waitFor(() => {
      expect(result.current.firebaseReady).toBe(false);
    });

    expect(result.current.firebaseServices).toBeNull();
  });
});

