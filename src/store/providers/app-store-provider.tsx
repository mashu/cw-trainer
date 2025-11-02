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
import type { AppUser } from '@/types';

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

  if (!storeRef.current) {
    storeRef.current = createAppStore({
      context: { firebase, user },
      sessionService: servicesRef.current.sessionService,
      trainingSettingsService: servicesRef.current.trainingSettingsService,
      icrSessionService: servicesRef.current.icrSessionService,
    });
  }

  useEffect(() => {
    const store = storeRef.current;
    if (!store) {
      return;
    }

    store.setState({ context: { firebase, user } });

    void store
      .getState()
      .loadTrainingSettings()
      .catch(() => undefined);
    void store
      .getState()
      .loadSessions()
      .catch(() => undefined);
    void store
      .getState()
      .loadIcrSessions()
      .catch(() => undefined);
  }, [firebase, user]);

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
