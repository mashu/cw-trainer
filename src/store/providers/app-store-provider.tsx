'use client';

import { createContext, useContext, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';

import {
  FirebaseSessionRepository,
  FirebaseTrainingSettingsRepository,
} from '@/lib/db/repositories';
import { IcrSessionService, SessionService, TrainingSettingsService } from '@/lib/services';
import type { IcrSessionService as IcrSessionServiceType } from '@/lib/services/icr-session.service';
import type { SessionService as SessionServiceType } from '@/lib/services/session.service';
import type { TrainingSettingsService as TrainingSettingsServiceType } from '@/lib/services/training-settings.service';
import type { FirebaseServicesLite } from '@/lib/sessionPersistence';
import { getQueuedSessionCount } from '@/lib/sessionQueue';
import type { AppUser } from '@/types';

import { contextEquals } from '../context-utils';
import { createAppStore, type AppStore } from '../create-app-store';
import type { StoreContextValue } from '../types';

interface AppStoreProviderProps {
  readonly children: ReactNode;
  readonly firebase?: FirebaseServicesLite;
  readonly user: AppUser | null;
  readonly sessionService?: SessionServiceType;
  readonly trainingSettingsService?: TrainingSettingsServiceType;
  readonly icrSessionService?: IcrSessionServiceType;
}

type AppStoreApi = StoreApi<AppStore>;

const StoreContext = createContext<AppStoreApi | null>(null);

const buildDefaultServices = (): {
  sessionService: SessionServiceType;
  trainingSettingsService: TrainingSettingsServiceType;
  icrSessionService: IcrSessionServiceType;
} => {
  const sessionRepository = new FirebaseSessionRepository();
  const trainingSettingsRepository = new FirebaseTrainingSettingsRepository();

  return {
    sessionService: new SessionService(sessionRepository),
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
  trainingSettingsService,
  icrSessionService,
}: AppStoreProviderProps): JSX.Element {
  const servicesRef = useRef<{
    sessionService: SessionServiceType;
    trainingSettingsService: TrainingSettingsServiceType;
    icrSessionService: IcrSessionServiceType;
  }>();

  if (!servicesRef.current) {
    const defaults = buildDefaultServices();
    servicesRef.current = {
      sessionService: sessionService ?? defaults.sessionService,
      trainingSettingsService: trainingSettingsService ?? defaults.trainingSettingsService,
      icrSessionService: icrSessionService ?? defaults.icrSessionService,
    };
  }

  if (sessionService && servicesRef.current.sessionService !== sessionService) {
    servicesRef.current.sessionService = sessionService;
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

  if (!storeRef.current) {
    const context: StoreContextValue = {
      user,
      ...(firebase !== undefined ? { firebase } : {}),
    };
    storeRef.current = createAppStore({
      context,
      sessionService: servicesRef.current.sessionService,
      trainingSettingsService: servicesRef.current.trainingSettingsService,
      icrSessionService: servicesRef.current.icrSessionService,
    });
  }

  // Shared function to trigger data loads with debouncing.
  // Skips running loads while a training session is active to avoid store updates
  // that can cause the UI to flip to the front page and leave audio playing.
  const triggerLoads = (): void => {
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
      if (state.trainingSessionActive) {
        // Defer all loads until the session ends. The subscription below will
        // call triggerLoads() when trainingSessionActive goes from true to false.
        console.debug('[app-store-provider] Skipping loads while training session is active');
        loadTimeoutRef.current = null;
        return;
      }
      console.debug('[app-store-provider] Context changed, triggering loads');
      const markSyncCompleted = (): void => {
        if (store.getState().context.user) {
          store.setState({ lastSyncCompletedAt: Date.now() });
        }
      };
      const settingsPromise = state.loadTrainingSettings().then((settings) => {
        console.debug('[app-store-provider] loadTrainingSettings completed:', { kochLevel: settings.kochLevel });
      }).catch((error) => {
        console.error('[app-store-provider] loadTrainingSettings error:', error);
      });
      const sessionsPromise = state.loadSessions().catch(() => undefined);
      void state.loadIcrSessions().catch(() => undefined);
      void Promise.all([settingsPromise, sessionsPromise]).then(() => markSyncCompleted());
    }, 50);
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
    let previousTrainingSessionActive: boolean = store.getState().trainingSessionActive;

    const unsubscribe = store.subscribe((state) => {
      const currentContext = state.context;
      const contextChanged = !contextEquals(previousContext, currentContext);
      if (contextChanged) {
        console.debug('[app-store-provider] Store context changed externally', {
          user: currentContext.user ? { id: currentContext.user.id, email: currentContext.user.email } : null,
          firebase: currentContext.firebase ? { hasDb: !!currentContext.firebase.db, hasAuth: !!currentContext.firebase.auth } : null,
        });
        previousContext = currentContext;
        triggerLoads();
      }

      const currentTrainingSessionActive = state.trainingSessionActive;
      if (previousTrainingSessionActive && !currentTrainingSessionActive) {
        console.debug('[app-store-provider] Training session ended, triggering loads');
        triggerLoads();
      }
      previousTrainingSessionActive = currentTrainingSessionActive;
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
    
    const tryRetryQueue = async (): Promise<void> => {
      const store = storeRef.current;
      const services = servicesRef.current;
      if (!store || !services) return;
      
      const queuedCount = getQueuedSessionCount();
      if (queuedCount === 0) return;
      
      const context = store.getState().context;
      if (!context.firebase?.db || !context.user) {
        // No Firebase or user - can't retry
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
    
    // Initial retry attempt after a short delay
    const initialTimeout = setTimeout(() => {
      void tryRetryQueue();
    }, 5000);
    
    // Periodic retry
    const intervalId = setInterval(() => {
      void tryRetryQueue();
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
