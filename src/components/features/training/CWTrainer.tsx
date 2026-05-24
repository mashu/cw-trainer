'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Sidebar } from '@/components/features/sidebar/Sidebar';
import { TrainingRouter } from '@/components/features/training/TrainingRouter';
import type { FormTrainingSettings } from '@/components/ui/forms/TrainingSettingsForm';
import { SyncStatusIndicator } from '@/components/ui/training/SyncStatusIndicator';
import { ToastOverlay } from '@/components/ui/training/ToastOverlay';
import { useAchievementsActions, useAchievementsState } from '@/hooks/useAchievements';
import { useAuth, type AuthUserSummary } from '@/hooks/useAuth';
import { useChaseTrainingSession } from '@/hooks/useChaseTrainingSession';
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

const MODE_ORDER: readonly TrainingMode[] = ['group', 'icr', 'echo', 'chase', 'player'];
const LAST_MODE_STORAGE_KEY = 'cw-trainer:last-mode';

export function CWTrainer(): JSX.Element {
  const {
    firebaseReady,
    firebaseServices,
    authInProgress,
    user: authUser,
    firebaseUser,
    signInWithGoogle,
    signOut,
    switchAccount,
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
    settings,
    trainingSettingsStatus,
    saveTrainingSettings,
    firebaseServices,
    firebaseUserUid: firebaseUser?.uid,
    showToast,
  });

  const training = useTrainingSession({
    settings,
    sessions: sessions ?? [],
    saveSession,
    setTrainingSettingsState,
    showToast,
  });
  const echoTraining = useEchoTrainingSession({
    settings,
    sessions: sessions ?? [],
    saveSession,
    setTrainingSettingsState,
    showToast,
  });
  const chaseTraining = useChaseTrainingSession({
    settings,
    sessions: sessions ?? [],
    saveSession,
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
    if (
      savedMode === 'group' ||
      savedMode === 'icr' ||
      savedMode === 'echo' ||
      savedMode === 'chase' ||
      savedMode === 'player'
    ) {
      setActiveMode(savedMode);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(LAST_MODE_STORAGE_KEY, activeMode);
    document.documentElement.dataset['trainingMode'] = activeMode;
    return (): void => {
      delete document.documentElement.dataset['trainingMode'];
    };
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
      trainingHasActiveSession: training.hasActiveSession,
      trainingCompletingSession: training.isCompletingSession,
      trainingShowResults: training.showResults,
      echoIsTraining: echoTraining.isTraining,
      echoCompletingSession: echoTraining.isCompletingSession,
      echoShowResults: echoTraining.showResults,
      chaseIsTraining: chaseTraining.isTraining,
      chaseShowResults: chaseTraining.status === 'results',
      activeMode,
      groupTab,
    }),
    [
      trainingSessionActive,
      training.isTraining,
      training.hasActiveSession,
      training.isCompletingSession,
      training.showResults,
      echoTraining.isTraining,
      echoTraining.isCompletingSession,
      echoTraining.showResults,
      chaseTraining.isTraining,
      chaseTraining.status,
      activeMode,
      groupTab,
    ],
  );

  useEffect(() => {
    const s = interruptedSessionGuardInputs;
    if (
      !s.trainingSessionActive ||
      s.trainingIsTraining ||
      s.trainingHasActiveSession ||
      s.echoIsTraining ||
      s.chaseIsTraining
    )
      return;
    if (s.trainingCompletingSession || s.echoCompletingSession) return;
    if (s.trainingShowResults || s.echoShowResults || s.chaseShowResults) return;
    if (
      (s.activeMode !== 'group' && s.activeMode !== 'echo' && s.activeMode !== 'chase') ||
      s.groupTab !== 'train'
    )
      return;
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
    try {
      await signOut();
    } catch {
      showToast({ message: 'Failed to sign out.', type: 'error' });
    }
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
    if (training.hasActiveSession) training.stopTraining();
    if (echoTraining.isTraining) echoTraining.stopTraining();
    if (chaseTraining.isTraining) chaseTraining.stopTraining();
  }, [training, echoTraining, chaseTraining]);

  const handleChangeMode = useCallback(
    (m: TrainingMode) => {
      if (training.hasActiveSession && activeMode === 'group') {
        showToast({ message: 'Stop the active session before switching modes.', type: 'info' });
        return;
      }
      if (echoTraining.isTraining && activeMode === 'echo') {
        showToast({
          message: 'Stop the active echo session before switching modes.',
          type: 'info',
        });
        return;
      }
      if (chaseTraining.isTraining && activeMode === 'chase') {
        showToast({ message: 'Stop the active Chase run before switching modes.', type: 'info' });
        return;
      }
      setActiveMode(m);
      if (m !== 'group') setGroupTab('train');
    },
    [training, echoTraining, chaseTraining, activeMode, showToast],
  );

  const handleMoveMode = useCallback(
    (delta: number): void => {
      const currentIndex = MODE_ORDER.indexOf(activeMode);
      const nextMode =
        MODE_ORDER[Math.max(0, Math.min(MODE_ORDER.length - 1, currentIndex + delta))];
      if (nextMode && nextMode !== activeMode) handleChangeMode(nextMode);
    },
    [activeMode, handleChangeMode],
  );

  const formSettings: FormTrainingSettings = useMemo(() => {
    const { customSet, customSequence, ...rest } = settings;
    return {
      ...rest,
      customSet: customSet ? [...customSet] : [],
      ...(customSequence && customSequence.length > 0
        ? { customSequence: [...customSequence] }
        : {}),
    };
  }, [settings]);

  const groupSessions = useMemo(
    () => sessions.filter((s) => (s.mode ?? 'group') === 'group'),
    [sessions],
  );
  const echoSessions = useMemo(() => sessions.filter((s) => s.mode === 'echo'), [sessions]);
  const chaseSessions = useMemo(() => sessions.filter((s) => s.mode === 'chase'), [sessions]);
  const { latestUnlockedAchievements } = useAchievementsState(groupSessions);
  const { clearLatestUnlockedAchievements } = useAchievementsActions();

  const groupHeatmapSessions = useMemo(() => mapSessionsToHeatmap(groupSessions), [groupSessions]);
  const echoHeatmapSessions = useMemo(() => mapSessionsToHeatmap(echoSessions), [echoSessions]);

  const computeLastAccuracy = useCallback((items: readonly SessionResult[]): number => {
    const last = items[items.length - 1];
    return last && Number.isFinite(last.accuracy) ? Math.round(last.accuracy * 100) : 0;
  }, []);

  const lastAccuracyPercent = useMemo(
    () => computeLastAccuracy(groupSessions),
    [computeLastAccuracy, groupSessions],
  );
  const lastEchoAccuracyPercent = useMemo(
    () => computeLastAccuracy(echoSessions),
    [computeLastAccuracy, echoSessions],
  );
  const lastChaseAccuracyPercent = useMemo(
    () => computeLastAccuracy(chaseSessions),
    [computeLastAccuracy, chaseSessions],
  );
  const sharedAudio = useMemo(() => settingsToSharedAudioProps(settings), [settings]);
  const chaseShellActive = activeMode === 'chase';

  return (
    <div
      className={`min-h-screen p-2 sm:p-4 lg:p-6 relative ${
        chaseShellActive
          ? 'bg-[radial-gradient(circle_at_top,rgba(244,63,94,0.22),transparent_34%),linear-gradient(135deg,#020617,#0f172a_48%,#190b12)]'
          : 'bg-gradient-to-br from-indigo-50 via-white to-cyan-50'
      }`}
    >
      <ToastOverlay toast={toast} onDismiss={dismissToast} />

      <Sidebar
        open={sidebarOpen}
        onClose={() => {
          deferredToastShownRef.current = false;
          setSidebarOpen(false);
        }}
        user={authUser}
        firebaseReady={firebaseReady}
        onGoogleLogin={handleLogin}
        onLogout={handleLogout}
        onSwitchAccount={handleSwitchAccount}
        authInProgress={authInProgress}
        settings={formSettings}
        setSettings={(next) => {
          const nextValue = typeof next === 'function' ? next(formSettings) : next;
          const converted = formSettingsToStoreUpdate(nextValue);
          setTrainingSettingsState((prev) => ({ ...prev, ...converted }));
          latestSettingsRef.current = { ...formSettings, ...converted } as TrainingSettings;
          if (
            (training.hasActiveSession || echoTraining.isTraining || chaseTraining.isTraining) &&
            !deferredToastShownRef.current
          ) {
            deferredToastShownRef.current = true;
            showToast({ message: 'Changes will apply after the session ends.', type: 'info' });
          }
        }}
        onSaveSettings={() => void saveSettings({ source: 'manual' })}
        isSavingSettings={isSavingSettings}
        sessionResultsCount={sessions.length}
        latestAccuracyPercent={lastAccuracyPercent}
        onViewStats={() => {
          if (training.hasActiveSession || echoTraining.isTraining || chaseTraining.isTraining) {
            showToast({ message: 'Stop the active session before opening stats.', type: 'info' });
            return;
          }
          setSidebarOpen(false);
          setActiveMode('group');
          setGroupTab('stats');
        }}
        activeMode={activeMode}
        onChangeMode={handleChangeMode}
        icrSettings={icrSettings}
        setIcrSettings={setIcrSettings}
      />

      <div
        className={`mx-auto rounded-3xl p-3 shadow-2xl backdrop-blur-sm sm:p-6 lg:p-8 ${
          chaseShellActive
            ? 'max-w-6xl border border-cyan-300/15 bg-slate-950/72 ring-1 ring-cyan-300/10'
            : 'max-w-4xl border border-white/20 bg-white/80 ring-1 ring-black/5'
        }`}
      >
        <AppHeader onOpenSidebar={() => setSidebarOpen(true)} dark={chaseShellActive} />

        <TrainingRouter
          activeMode={activeMode}
          groupTab={groupTab}
          setGroupTab={setGroupTab}
          setActiveMode={setActiveMode}
          training={training}
          echoTraining={echoTraining}
          chaseTraining={chaseTraining}
          settings={settings}
          formSettings={formSettings}
          groupHeatmapSessions={groupHeatmapSessions}
          echoHeatmapSessions={echoHeatmapSessions}
          groupSessions={groupSessions}
          echoSessions={echoSessions}
          chaseSessions={chaseSessions}
          lastAccuracyPercent={lastAccuracyPercent}
          lastEchoAccuracyPercent={lastEchoAccuracyPercent}
          lastChaseAccuracyPercent={lastChaseAccuracyPercent}
          stopTrainingIfActive={stopTrainingIfActive}
          sharedAudio={sharedAudio}
          icrSettings={icrSettings}
          showToast={showToast}
          handleMoveMode={handleMoveMode}
          latestUnlockedAchievements={latestUnlockedAchievements}
          onClearLatestUnlockedAchievements={clearLatestUnlockedAchievements}
        />
      </div>

      <SyncStatusIndicator
        totalSessions={sessions.length}
        isSyncing={sessionsSyncing}
        onRetry={() => void syncPendingSessions()}
      />
    </div>
  );
}
