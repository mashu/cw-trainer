'use client';

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { createContext, useContext, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';

import {
  FirebaseAchievementRepository,
  FirebaseErrorRepository,
  FirebaseSessionRepository,
  FirebaseTrainingSettingsRepository,
} from '@/lib/db/repositories';
import { setRemoteErrorSink } from '@/lib/errors/reporter';
import {
  exportAutoAdjustCounters,
  importAutoAdjustCounters,
  registerAutoAdjustSyncListener,
} from '@/lib/kochAutoAdjust';
import {
  readGroupRuntime,
  writeGroupRuntime,
} from '@/lib/persistence/groupRuntimePersistence';
import {
  AchievementService,
  IcrSessionService,
  SessionService,
  TrainingSettingsService,
} from '@/lib/services';
import type { AchievementService as AchievementServiceType } from '@/lib/services/achievement.service';
import type { IcrSessionService as IcrSessionServiceType } from '@/lib/services/icr-session.service';
import type { SessionService as SessionServiceType } from '@/lib/services/session.service';
import type { TrainingSettingsService as TrainingSettingsServiceType } from '@/lib/services/training-settings.service';
import type { FirebaseServicesLite } from '@/lib/sessionPersistence';
import { getQueuedSessionCount, resetFailedSessions } from '@/lib/sessionQueue';
import type { AppUser } from '@/types';

import { contextEquals } from '../context-utils';
import { createAppStore, type AppStore } from '../create-app-store';
import { selectTrainingSessionActive } from '../selectors';
import type { StoreContextValue } from '../types';

interface AppStoreProviderProps {
  readonly children: ReactNode;
  readonly firebase?: FirebaseServicesLite;
  readonly user: AppUser | null;
  readonly sessionService?: SessionServiceType;
  readonly achievementService?: AchievementServiceType;
  readonly trainingSettingsService?: TrainingSettingsServiceType;
  readonly icrSessionService?: IcrSessionServiceType;
}

type AppStoreApi = StoreApi<AppStore>;

type TriggerLoadsOptions = {
  /**
   * When true, only sessions (and ICR) reload — not training settings.
   * Used when a training session ends: `loadTrainingSettings` can race with
   * in-memory updates (e.g. auto level) that are not persisted yet and would
   * overwrite the store with stale server data.
   */
  readonly skipTrainingSettings?: boolean;
};

const StoreContext = createContext<AppStoreApi | null>(null);

const buildDefaultServices = (): {
  sessionService: SessionServiceType;
  achievementService: AchievementServiceType;
  trainingSettingsService: TrainingSettingsServiceType;
  icrSessionService: IcrSessionServiceType;
} => {
  const sessionRepository = new FirebaseSessionRepository();
  const achievementRepository = new FirebaseAchievementRepository();
  const trainingSettingsRepository = new FirebaseTrainingSettingsRepository();

  return {
    sessionService: new SessionService(sessionRepository),
    achievementService: new AchievementService(achievementRepository),
    trainingSettingsService: new TrainingSettingsService(trainingSettingsRepository),
    icrSessionService: new IcrSessionService(),
  };
};

/**
 * Store context is set from props in the effect below and can also be updated by
 * useAuth via store.setContext(). In the app, props are static (user=null); the
 * live context is driven by useAuth below this provider.
 */
export function AppStoreProvider({
  children,
  firebase,
  user,
  sessionService,
  achievementService,
  trainingSettingsService,
  icrSessionService,
}: AppStoreProviderProps): JSX.Element {
  const servicesRef = useRef<{
    sessionService: SessionServiceType;
    achievementService: AchievementServiceType;
    trainingSettingsService: TrainingSettingsServiceType;
    icrSessionService: IcrSessionServiceType;
  }>();

  if (!servicesRef.current) {
    const defaults = buildDefaultServices();
    servicesRef.current = {
      sessionService: sessionService ?? defaults.sessionService,
      achievementService: achievementService ?? defaults.achievementService,
      trainingSettingsService: trainingSettingsService ?? defaults.trainingSettingsService,
      icrSessionService: icrSessionService ?? defaults.icrSessionService,
    };
  }

  if (sessionService && servicesRef.current.sessionService !== sessionService) {
    servicesRef.current.sessionService = sessionService;
  }

  if (achievementService && servicesRef.current.achievementService !== achievementService) {
    servicesRef.current.achievementService = achievementService;
  }

  if (
    trainingSettingsService &&
    servicesRef.current.trainingSettingsService !== trainingSettingsService
  ) {
    servicesRef.current.trainingSettingsService = trainingSettingsService;
  }

  if (icrSessionService && servicesRef.current.icrSessionService !== icrSessionService) {
    servicesRef.current.icrSessionService = icrSessionService;
  }

  const storeRef = useRef<AppStoreApi>();
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tryRetryQueuedSessionsRef = useRef<(() => Promise<void>) | null>(null);

  if (!storeRef.current) {
    const context: StoreContextValue = {
      user,
      ...(firebase !== undefined ? { firebase } : {}),
    };
    storeRef.current = createAppStore({
      context,
      sessionService: servicesRef.current.sessionService,
      achievementService: servicesRef.current.achievementService,
      trainingSettingsService: servicesRef.current.trainingSettingsService,
      icrSessionService: servicesRef.current.icrSessionService,
    });
  }

  // Shared function to trigger data loads with debouncing.
  // Skips running loads while a training session is active to avoid store updates
  // that can cause the UI to flip to the front page and leave audio playing.
  const triggerLoads = (options?: TriggerLoadsOptions): void => {
    const store = storeRef.current;
    if (!store) {
      return;
    }

    // Debounce to batch rapid changes from both props and external context updates
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
    }
    loadTimeoutRef.current = setTimeout(() => {
      const state = store.getState();
      if (selectTrainingSessionActive(state)) {
        // Defer all loads until the session ends. The subscription below will
        // call triggerLoads() when trainingSessionActive goes from true to false.
        console.debug('[app-store-provider] Skipping loads while training session is active');
        loadTimeoutRef.current = null;
        return;
      }
      const skipTrainingSettings = options?.skipTrainingSettings ?? false;
      console.debug('[app-store-provider] Context changed, triggering loads', {
        skipTrainingSettings,
      });
      const markSyncCompleted = (): void => {
        if (store.getState().context.user) {
          store.setState({ lastSyncCompletedAt: Date.now() });
        }
      };
      const settingsPromise = skipTrainingSettings
        ? Promise.resolve()
        : state
            .loadTrainingSettings()
            .then((settings) => {
              console.debug('[app-store-provider] loadTrainingSettings completed:', {
                kochLevel: settings.kochLevel,
              });
            })
            .catch((error) => {
              console.error('[app-store-provider] loadTrainingSettings error:', error);
            });
      const sessionsPromise = state.loadSessions().catch(() => undefined);
      const achievementsPromise = state.loadAchievements().catch(() => undefined);
      void state.loadIcrSessions().catch(() => undefined);
      void Promise.all([settingsPromise, sessionsPromise, achievementsPromise]).then(() =>
        markSyncCompleted(),
      );
    }, 50);
  };

  tryRetryQueuedSessionsRef.current = async (): Promise<void> => {
    const store = storeRef.current;
    const services = servicesRef.current;
    if (!store || !services) return;

    const queuedCount = getQueuedSessionCount();
    if (queuedCount === 0) return;

    const state = store.getState();
    if (selectTrainingSessionActive(state)) {
      console.debug('[app-store-provider] Skipping retry queue while training session is active');
      return;
    }

    const context = store.getState().context;
    if (!context.firebase?.db || !context.user) {
      return;
    }

    console.debug('[app-store-provider] Retrying queued sessions:', queuedCount);
    try {
      await services.sessionService.processRetryQueue({
        firebase: context.firebase,
        user: context.user,
      });
    } catch (error) {
      console.warn('[app-store-provider] Retry queue processing failed:', error);
    }
  };

  // Update context when props change and trigger loads
  useEffect(() => {
    const store = storeRef.current;
    if (!store) {
      return;
    }

    console.debug('[app-store-provider] Props changed, updating context', {
      user: user ? { id: user.id, email: user.email } : null,
      firebase: firebase ? { hasDb: !!firebase.db, hasAuth: !!firebase.auth } : null,
    });

    const context: StoreContextValue = {
      user,
      ...(firebase !== undefined ? { firebase } : {}),
    };
    store.setState({ context });

    // Always trigger loads on props change so initial load runs (local-only users and tests).
    // When useAuth also sets context, the 50ms debounce in triggerLoads batches the two.
    triggerLoads();
  }, [firebase, user]);

  // Watch store context changes from external sources (like useAuth calling setContext).
  // useAuth debounces transient user=null (e.g. Firebase connectivity loss) so we don't
  // trigger loads and UI churn during brief disconnects in long-running sessions.
  // Also run loads when a training session ends (trainingSessionActive true -> false)
  // so we sync after the user finishes a session.
  useEffect(() => {
    const store = storeRef.current;
    if (!store) {
      return;
    }

    let previousContext: StoreContextValue = store.getState().context;
    let previousTrainingBlocked: boolean = selectTrainingSessionActive(store.getState());

    const unsubscribe = store.subscribe((state) => {
      const currentContext = state.context;
      const contextChanged = !contextEquals(previousContext, currentContext);
      if (contextChanged) {
        console.debug('[app-store-provider] Store context changed externally', {
          user: currentContext.user ? { id: currentContext.user.id, email: currentContext.user.email } : null,
          firebase: currentContext.firebase ? { hasDb: !!currentContext.firebase.db, hasAuth: !!currentContext.firebase.auth } : null,
        });
        const wasSignedIn = previousContext.user != null;
        const isSignedIn = currentContext.user != null;
        previousContext = currentContext;
        if (wasSignedIn && !isSignedIn) {
          store.getState().cancelAncillaryTrainingRuntimes();
        }
        triggerLoads();
      }

      const currentTrainingBlocked = selectTrainingSessionActive(state);
      if (previousTrainingBlocked && !currentTrainingBlocked) {
        console.debug('[app-store-provider] Training session ended; deferring background sync');
        void tryRetryQueuedSessionsRef.current?.();
      }
      previousTrainingBlocked = currentTrainingBlocked;
    });

    return (): void => {
      unsubscribe();
    };
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return (): void => {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
      }
      storeRef.current?.getState().cancelAncillaryTrainingRuntimes();
    };
  }, []);

  // Mirror auto-level-adjust counters to Firestore. They live in localStorage
  // for synchronous access, but without a cloud copy the "N of M sessions"
  // progress silently resets on every new device while sessions themselves sync.
  useEffect(() => {
    if (!firebase?.db || !user?.id) {
      registerAutoAdjustSyncListener(null);
      return;
    }
    const db = firebase.db;
    const uid = user.id;
    let disposed = false;
    let writeTimer: ReturnType<typeof setTimeout> | null = null;

    const docRef = (): unknown => doc(db, 'users', uid, 'meta', 'autoAdjust');

    // Hydrate: cloud fills local gaps (local always wins).
    void (async (): Promise<void> => {
      try {
        const snap = await getDoc(docRef() as never);
        if (disposed || !snap.exists()) return;
        const data = snap.data() as { counters?: Record<string, { above: number; below: number }> };
        if (data?.counters && typeof data.counters === 'object') {
          importAutoAdjustCounters(data.counters);
        }
      } catch (error) {
        console.debug('[app-store-provider] Auto-adjust counter hydration failed', error);
      }
    })();

    registerAutoAdjustSyncListener((counters) => {
      if (writeTimer) clearTimeout(writeTimer);
      writeTimer = setTimeout(() => {
        setDoc(docRef() as never, { counters, updatedAt: Date.now() }).catch((error: unknown) => {
          console.debug('[app-store-provider] Auto-adjust counter sync failed', error);
        });
      }, 2000);
    });

    // Push the current snapshot once so pre-existing local progress reaches the cloud.
    const initial = exportAutoAdjustCounters();
    if (Object.keys(initial).length > 0) {
      setDoc(docRef() as never, { counters: initial, updatedAt: Date.now() }, { merge: true }).catch(
        (error: unknown) => {
          console.debug('[app-store-provider] Initial auto-adjust counter sync failed', error);
        },
      );
    }

    return (): void => {
      disposed = true;
      if (writeTimer) clearTimeout(writeTimer);
      registerAutoAdjustSyncListener(null);
    };
  }, [firebase, user]);

  // Persist the group training runtime to sessionStorage so an in-progress session
  // survives a hard reload. On mount we restore any persisted snapshot (coerced to a
  // non-playing state by the machine, since audio cannot resume across a reload), then
  // write through every subsequent runtime change. Runs client-only (post-mount).
  useEffect(() => {
    const store = storeRef.current;
    if (!store) {
      return;
    }
    store.getState().restoreGroupTrainingRuntime(readGroupRuntime());
    let previousRuntime = store.getState().groupTrainingRuntime;
    const unsubscribe = store.subscribe((state) => {
      if (state.groupTrainingRuntime !== previousRuntime) {
        previousRuntime = state.groupTrainingRuntime;
        writeGroupRuntime(previousRuntime);
      }
    });
    return (): void => {
      unsubscribe();
    };
  }, []);

  // Best-effort remote error delivery. Respects Firebase-optional: the sink
  // writes only when Firestore is configured AND a user is signed in; otherwise
  // errors stay local (ring buffer + console). Reads context at call time so it
  // tracks sign-in/out without re-subscribing.
  useEffect(() => {
    const store = storeRef.current;
    if (!store) {
      return;
    }
    const repository = new FirebaseErrorRepository();
    setRemoteErrorSink((report) => {
      const context = store.getState().context;
      if (!context.firebase?.db || !context.user) {
        return;
      }
      void repository.record({ firebase: context.firebase, user: context.user }, report);
    });
    return (): void => {
      setRemoteErrorSink(null);
    };
  }, []);

  // When user returns to tab after long idle: sync in background (use local data until Firebase
  // is available; no loading state or UI disruption). useAuth refreshes the token on visibility.
  const visibleSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const VISIBLE_DEBOUNCE_MS = 600;

    const onVisibilityChange = (): void => {
      if (typeof document === 'undefined' || document.visibilityState !== 'visible') {
        if (visibleSyncTimeoutRef.current) {
          clearTimeout(visibleSyncTimeoutRef.current);
          visibleSyncTimeoutRef.current = null;
        }
        return;
      }
      const store = storeRef.current;
      if (!store) return;
      const state = store.getState();
      // Only run background sync when user has logged in; local-only users don't need Firebase polling
      if (!state.context.user) return;
      if (state.trainingSettingsStatus !== 'ready' && state.sessionsStatus !== 'ready') return;
      if (visibleSyncTimeoutRef.current) return;
      visibleSyncTimeoutRef.current = setTimeout(() => {
        visibleSyncTimeoutRef.current = null;
        triggerLoads();
      }, VISIBLE_DEBOUNCE_MS);
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return (): void => {
      if (visibleSyncTimeoutRef.current) {
        clearTimeout(visibleSyncTimeoutRef.current);
        visibleSyncTimeoutRef.current = null;
      }
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  // Periodic retry of queued sessions
  useEffect(() => {
    const RETRY_INTERVAL_MS = 30000; // Check every 30 seconds

    // Sessions that exhausted their retry budget stay parked until attempts are
    // reset; a fresh app load is the promised retry point, so reset them here.
    resetFailedSessions();

    // Initial retry attempt after a short delay
    const initialTimeout = setTimeout(() => {
      void tryRetryQueuedSessionsRef.current?.();
    }, 5000);

    // Periodic retry
    const intervalId = setInterval(() => {
      void tryRetryQueuedSessionsRef.current?.();
    }, RETRY_INTERVAL_MS);
    
    return (): void => {
      clearTimeout(initialTimeout);
      clearInterval(intervalId);
    };
  }, []);

  return <StoreContext.Provider value={storeRef.current}>{children}</StoreContext.Provider>;
}

export const useAppStore = <TSelected,>(
  selector: (state: AppStore) => TSelected,
  equalityFn?: (left: TSelected, right: TSelected) => boolean,
): TSelected => {
  const store = useContext(StoreContext);
  if (!store) {
    throw new Error('useAppStore must be used within an AppStoreProvider.');
  }

  return useStore(store, selector, equalityFn);
};

export const useAppStoreContext = (): StoreContextValue => useAppStore((state) => state.context);
