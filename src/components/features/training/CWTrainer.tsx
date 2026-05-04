'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Sidebar } from '@/components/features/sidebar/Sidebar';
import { TrainingRouter } from '@/components/features/training/TrainingRouter';
import type { FormTrainingSettings } from '@/components/ui/forms/TrainingSettingsForm';
import { SyncStatusIndicator } from '@/components/ui/training/SyncStatusIndicator';
import { ToastOverlay } from '@/components/ui/training/ToastOverlay';
import { useAuth, type AuthUserSummary } from '@/hooks/useAuth';
import { useEchoTrainingSession } from '@/hooks/useEchoTrainingSession';
import { useIcrSettings } from '@/hooks/useIcrSettings';
import { useSessionsActions, useSessionsState } from '@/hooks/useSessions';
import { useSettingsAutoSave } from '@/hooks/useSettingsAutoSave';
import { useToast } from '@/hooks/useToast';
import { useTrainingSession } from '@/hooks/useTrainingSession';
import { useTrainingSettingsActions, useTrainingSettingsState } from '@/hooks/useTrainingSettings';
import { formSettingsToStoreUpdate } from '@/lib/formSettingsToStore';
import { settingsToSharedAudioProps } from '@/lib/settingsToSharedAudioProps';
import { mapSessionsToHeatmap } from '@/lib/utils/mapSessionsToHeatmap';
import { trainingModeFromSearch } from '@/lib/utils/trainingModeFromUrl';
import { useAppStore } from '@/store';
import type { SessionResult, TrainingMode, TrainingSettings } from '@/types';

import { AppHeader } from './AppHeader';

const MODE_ORDER: readonly TrainingMode[] = ['group', 'icr', 'echo', 'player'];
const LAST_MODE_STORAGE_KEY = 'cw-trainer:last-mode';

export function CWTrainer(): JSX.Element {
  const {
    firebaseReady, firebaseServices, authInProgress,
    user: authUser, firebaseUser, signInWithGoogle, signOut, switchAccount,
  } = useAuth();

  const { toast, showToast, dismissToast } = useToast();

  const {
    trainingSettings: settings,
    trainingSettingsSaving: isSavingSettings,
    trainingSettingsStatus,
  } = useTrainingSettingsState();
  const { setTrainingSettingsState, saveTrainingSettings } = useTrainingSettingsActions();
  const { sessions, sessionsSyncing } = useSessionsState();
  const { saveSession, syncPendingSessions } = useSessionsActions();
  const { icrSettings, setIcrSettings } = useIcrSettings();

  const { saveSettings, latestSettingsRef } = useSettingsAutoSave({
    settings, trainingSettingsStatus,
    saveTrainingSettings,
    firebaseServices, firebaseUserUid: firebaseUser?.uid, showToast,
  });

  const training = useTrainingSession({
    settings, sessions: sessions ?? [],
    saveSession,
    setTrainingSettingsState, showToast,
  });
  const echoTraining = useEchoTrainingSession({
    settings, sessions: sessions ?? [],
    saveSession,
    setTrainingSettingsState,
    showToast,
  });

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeMode, setActiveMode] = useState<TrainingMode>('group');
  const [groupTab, setGroupTab] = useState<'train' | 'stats'>('train');
  const deferredToastShownRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const fromUrl = trainingModeFromSearch(window.location.search);
    if (fromUrl) {
      setActiveMode(fromUrl);
      return;
    }
    const savedMode = window.localStorage.getItem(LAST_MODE_STORAGE_KEY);
    if (savedMode === 'group' || savedMode === 'icr' || savedMode === 'echo' || savedMode === 'player') {
      setActiveMode(savedMode);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(LAST_MODE_STORAGE_KEY, activeMode);
  }, [activeMode]);

  const prevUserRef = useRef<AuthUserSummary | null>(null);
  useEffect(() => {
    if (prevUserRef.current === null && authUser) {
      showToast({ message: `Signed in as ${authUser.email || 'user'}`, type: 'success' });
    } else if (prevUserRef.current && !authUser) {
      showToast({ message: 'Signed out', type: 'info' });
    }
    prevUserRef.current = authUser;
  }, [authUser, showToast]);

  const lastSyncCompletedAt = useAppStore((s) => s.lastSyncCompletedAt);
  const prevSyncAtRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (lastSyncCompletedAt === undefined) return;
    if (prevSyncAtRef.current !== undefined && prevSyncAtRef.current !== lastSyncCompletedAt) {
      showToast({ message: 'Synced', type: 'success' });
    }
    prevSyncAtRef.current = lastSyncCompletedAt;
  }, [lastSyncCompletedAt, showToast]);

  const trainingSessionActive = useAppStore((s) => s.trainingSessionActive);
  const resetTrainingSessionLocks = useAppStore((s) => s.resetTrainingSessionLocks);

  /** Snapshot used only for interrupt guard — keeps useEffect deps a fixed-length tuple (avoids React dev/HMR “deps changed size” warnings). */
  const interruptedSessionGuardInputs = useMemo(
    () => ({
      trainingSessionActive,
      trainingIsTraining: training.isTraining,
      trainingCompletingSession: training.isCompletingSession,
      trainingShowResults: training.showResults,
      echoIsTraining: echoTraining.isTraining,
      echoCompletingSession: echoTraining.isCompletingSession,
      echoShowResults: echoTraining.showResults,
      activeMode,
      groupTab,
    }),
    [
      trainingSessionActive,
      training.isTraining,
      training.isCompletingSession,
      training.showResults,
      echoTraining.isTraining,
      echoTraining.isCompletingSession,
      echoTraining.showResults,
      activeMode,
      groupTab,
    ],
  );

  useEffect(() => {
    const s = interruptedSessionGuardInputs;
    if (!s.trainingSessionActive || s.trainingIsTraining || s.echoIsTraining) return;
    if (s.trainingCompletingSession || s.echoCompletingSession) return;
    if (s.trainingShowResults || s.echoShowResults) return;
    if ((s.activeMode !== 'group' && s.activeMode !== 'echo') || s.groupTab !== 'train') return;
    resetTrainingSessionLocks();
    showToast({ message: 'Session was interrupted. Start a new one when ready.', type: 'info' });
  }, [interruptedSessionGuardInputs, resetTrainingSessionLocks, showToast]);

  const handleLogin = useCallback(async (): Promise<void> => {
    if (!firebaseReady || !firebaseServices) {
      showToast({ message: 'Firebase is not configured. Cannot sign in.', type: 'error' });
      return;
    }
    try {
      showToast({ message: 'Redirecting to Google…', type: 'info' });
      await signInWithGoogle();
    } catch {
      showToast({ message: 'Failed to start Google sign-in.', type: 'error' });
    }
  }, [firebaseReady, firebaseServices, showToast, signInWithGoogle]);

  const handleLogout = useCallback(async (): Promise<void> => {
    try { await signOut(); } catch { showToast({ message: 'Failed to sign out.', type: 'error' }); }
  }, [showToast, signOut]);

  const handleSwitchAccount = useCallback(async (): Promise<void> => {
    if (!firebaseReady || !firebaseServices) {
      showToast({ message: 'Firebase is not configured. Cannot switch accounts.', type: 'error' });
      return;
    }
    try {
      showToast({ message: 'Redirecting to Google…', type: 'info' });
      await switchAccount();
    } catch {
      showToast({ message: 'Failed to switch account.', type: 'error' });
    }
  }, [firebaseReady, firebaseServices, showToast, switchAccount]);

  const stopTrainingIfActive = useCallback((): void => {
    if (training.isTraining) training.stopTraining();
    if (echoTraining.isTraining) echoTraining.stopTraining();
  }, [training, echoTraining]);

  const handleChangeMode = useCallback(
    (m: TrainingMode) => {
      if (training.isTraining && activeMode === 'group') {
        training.stopTraining();
        showToast({ message: 'Session stopped.', type: 'info' });
      }
      if (echoTraining.isTraining && activeMode === 'echo') {
        echoTraining.stopTraining();
        showToast({ message: 'Echo session stopped.', type: 'info' });
      }
      setActiveMode(m);
      if (m !== 'group') setGroupTab('train');
    },
    [training, echoTraining, activeMode, showToast],
  );

  const handleMoveMode = useCallback(
    (delta: number): void => {
      const currentIndex = MODE_ORDER.indexOf(activeMode);
      const nextMode = MODE_ORDER[Math.max(0, Math.min(MODE_ORDER.length - 1, currentIndex + delta))];
      if (nextMode && nextMode !== activeMode) handleChangeMode(nextMode);
    },
    [activeMode, handleChangeMode],
  );

  const formSettings: FormTrainingSettings = useMemo(() => {
    const { customSet, customSequence, ...rest } = settings;
    return {
      ...rest,
      customSet: customSet ? [...customSet] : [],
      ...(customSequence && customSequence.length > 0 ? { customSequence: [...customSequence] } : {}),
    };
  }, [settings]);

  const groupSessions = useMemo(() => sessions.filter((s) => (s.mode ?? 'group') === 'group'), [sessions]);
  const echoSessions = useMemo(() => sessions.filter((s) => s.mode === 'echo'), [sessions]);

  const groupHeatmapSessions = useMemo(() => mapSessionsToHeatmap(groupSessions), [groupSessions]);
  const echoHeatmapSessions = useMemo(() => mapSessionsToHeatmap(echoSessions), [echoSessions]);

  const computeLastAccuracy = useCallback(
    (items: readonly SessionResult[]): number => {
      const last = items[items.length - 1];
      return last && Number.isFinite(last.accuracy) ? Math.round(last.accuracy * 100) : 0;
    },
    [],
  );

  const lastAccuracyPercent = useMemo(() => computeLastAccuracy(groupSessions), [computeLastAccuracy, groupSessions]);
  const lastEchoAccuracyPercent = useMemo(() => computeLastAccuracy(echoSessions), [computeLastAccuracy, echoSessions]);
  const sharedAudio = useMemo(() => settingsToSharedAudioProps(settings), [settings]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 p-2 sm:p-4 lg:p-6 relative">
      <ToastOverlay toast={toast} onDismiss={dismissToast} />

      <Sidebar
        open={sidebarOpen}
        onClose={() => { deferredToastShownRef.current = false; setSidebarOpen(false); }}
        user={authUser} firebaseReady={firebaseReady}
        onGoogleLogin={handleLogin} onLogout={handleLogout} onSwitchAccount={handleSwitchAccount}
        authInProgress={authInProgress} settings={formSettings}
        setSettings={(next) => {
          const nextValue = typeof next === 'function' ? next(formSettings) : next;
          const converted = formSettingsToStoreUpdate(nextValue);
          setTrainingSettingsState((prev) => ({ ...prev, ...converted }));
          latestSettingsRef.current = { ...formSettings, ...converted } as TrainingSettings;
          if ((training.isTraining || echoTraining.isTraining) && !deferredToastShownRef.current) {
            deferredToastShownRef.current = true;
            showToast({ message: 'Changes will apply after the session ends.', type: 'info' });
          }
        }}
        onSaveSettings={() => void saveSettings({ source: 'manual' })}
        isSavingSettings={isSavingSettings}
        sessionResultsCount={sessions.length} latestAccuracyPercent={lastAccuracyPercent}
        onViewStats={() => { stopTrainingIfActive(); setSidebarOpen(false); setActiveMode('group'); setGroupTab('stats'); }}
        activeMode={activeMode} onChangeMode={handleChangeMode}
        icrSettings={icrSettings} setIcrSettings={setIcrSettings}
      />

      <div className="max-w-4xl mx-auto bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl ring-1 ring-black/5 p-3 sm:p-6 lg:p-8 border border-white/20">
        <AppHeader onOpenSidebar={() => setSidebarOpen(true)} />

        <TrainingRouter
          activeMode={activeMode} groupTab={groupTab} setGroupTab={setGroupTab} setActiveMode={setActiveMode}
          training={training} echoTraining={echoTraining}
          settings={settings} formSettings={formSettings}
          groupHeatmapSessions={groupHeatmapSessions} echoHeatmapSessions={echoHeatmapSessions}
          groupSessions={groupSessions} echoSessions={echoSessions}
          lastAccuracyPercent={lastAccuracyPercent} lastEchoAccuracyPercent={lastEchoAccuracyPercent}
          stopTrainingIfActive={stopTrainingIfActive}
          sharedAudio={sharedAudio} icrSettings={icrSettings} showToast={showToast}
          handleMoveMode={handleMoveMode}
        />
      </div>

      <SyncStatusIndicator totalSessions={sessions.length} isSyncing={sessionsSyncing} onRetry={() => void syncPendingSessions()} />
    </div>
  );
}
