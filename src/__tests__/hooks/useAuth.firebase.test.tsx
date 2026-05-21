const mockUnsubscribe = jest.fn();
const mockOnAuthStateChanged = jest.fn();
const mockSetPersistence = jest.fn().mockResolvedValue(undefined);
const mockGetIdToken = jest.fn().mockResolvedValue('token');

jest.mock('firebase/auth', () => ({
  onAuthStateChanged: (...args: unknown[]) => mockOnAuthStateChanged(...args),
  setPersistence: (...args: unknown[]) => mockSetPersistence(...args),
  browserLocalPersistence: 'local',
}));

const mockGoogleSignIn = jest.fn();
const mockGoogleSignOut = jest.fn();
const mockGetRedirectedUser = jest.fn();
const mockInitFirebase = jest.fn();

jest.mock('@/lib/firebaseClient', () => ({
  initFirebase: () => mockInitFirebase(),
  googleSignIn: (...args: unknown[]) => mockGoogleSignIn(...args),
  googleSignOut: (...args: unknown[]) => mockGoogleSignOut(...args),
  getRedirectedUser: (...args: unknown[]) => mockGetRedirectedUser(...args),
}));

import { renderHook, act, waitFor } from '@testing-library/react';

import { useAuth } from '@/hooks/useAuth';
import type { IcrSessionService } from '@/lib/services/icr-session.service';
import type { SessionService } from '@/lib/services/session.service';
import type { TrainingSettingsService } from '@/lib/services/training-settings.service';
import { AppStoreProvider } from '@/store/providers/app-store-provider';

const mockAuth = {
  currentUser: null as { getIdToken: typeof mockGetIdToken } | null,
};

const mockFirebaseServices = {
  auth: mockAuth,
  db: {},
};

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

const googleUser = {
  uid: 'google-uid',
  email: 'user@example.com',
  displayName: 'CW Op',
  photoURL: 'https://example.com/photo.jpg',
  isAnonymous: false,
  providerData: [{ providerId: 'google.com' }],
};

describe('useAuth with Firebase configured', () => {
  let authCallback: ((user: typeof googleUser | null) => void) | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    authCallback = undefined;
    mockAuth.currentUser = null;

    mockInitFirebase.mockReturnValue(mockFirebaseServices);
    mockGetRedirectedUser.mockResolvedValue(null);
    mockGoogleSignOut.mockResolvedValue(undefined);

    mockOnAuthStateChanged.mockImplementation((_auth, callback) => {
      authCallback = callback as (user: typeof googleUser | null) => void;
      return mockUnsubscribe;
    });

    (mockTrainingSettingsService.getSettings as jest.Mock).mockResolvedValue({});
    (mockSessionService.listSessions as jest.Mock).mockResolvedValue([]);
    (mockIcrSessionService.listSessions as jest.Mock).mockResolvedValue([]);
  });

  it('reports firebase ready and maps Google user', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: TestWrapper });

    await waitFor(() => {
      expect(result.current.firebaseReady).toBe(true);
    });

    act(() => {
      authCallback?.(googleUser);
    });

    await waitFor(() => {
      expect(result.current.firebaseUser).toEqual(googleUser);
    });

    expect(result.current.appUser).toEqual({
      id: 'google-uid',
      email: 'user@example.com',
      displayName: 'CW Op',
      photoUrl: 'https://example.com/photo.jpg',
      provider: 'google',
    });
    expect(result.current.user?.email).toBe('user@example.com');
  });

  it('signInWithGoogle sets user from googleSignIn result', async () => {
    mockGoogleSignIn.mockResolvedValue(googleUser);
    const { result } = renderHook(() => useAuth(), { wrapper: TestWrapper });

    await waitFor(() => expect(result.current.firebaseReady).toBe(true));

    await act(async () => {
      await result.current.signInWithGoogle();
    });

    expect(result.current.firebaseUser).toEqual(googleUser);
    expect(mockGoogleSignIn).toHaveBeenCalled();
  });

  it('debounces transient null auth after a signed-in user', async () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useAuth(), { wrapper: TestWrapper });

    await waitFor(() => expect(result.current.firebaseReady).toBe(true));

    act(() => {
      authCallback?.(googleUser);
    });

    await waitFor(() => expect(result.current.firebaseUser).toEqual(googleUser));

    act(() => {
      authCallback?.(null);
    });

    expect(result.current.firebaseUser).toEqual(googleUser);

    act(() => {
      jest.advanceTimersByTime(2600);
    });

    await waitFor(() => {
      expect(result.current.firebaseUser).toBeNull();
    });

    jest.useRealTimers();
  });

  it('signOut clears user and calls googleSignOut', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: TestWrapper });

    await waitFor(() => expect(result.current.firebaseReady).toBe(true));

    act(() => {
      authCallback?.(googleUser);
    });

    await act(async () => {
      await result.current.signOut();
    });

    expect(mockGoogleSignOut).toHaveBeenCalled();
    expect(result.current.firebaseUser).toBeNull();
  });
});
