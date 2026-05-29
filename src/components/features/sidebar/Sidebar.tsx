'use client';

import React, { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';

import { ChaseSettingsForm } from '@/components/ui/forms/ChaseSettingsForm';
import { EchoSettingsForm } from '@/components/ui/forms/EchoSettingsForm';
import { ICRSettingsForm } from '@/components/ui/forms/ICRSettingsForm';
import { PlayerSettingsForm } from '@/components/ui/forms/PlayerSettingsForm';
import type { FormTrainingSettings } from '@/components/ui/forms/TrainingSettingsForm';
import { TrainingSettingsForm } from '@/components/ui/forms/TrainingSettingsForm';
import { TrainingModeCarousel } from '@/components/ui/navigation/TrainingModeCarousel';
import { useAchievementsActions, useAchievementsState } from '@/hooks/useAchievements';
import type { AuthUserSummary } from '@/hooks/useAuth';
import { useSessionsActions } from '@/hooks/useSessions';
import { initFirebase } from '@/lib/firebaseClient';
import { getUserCallSign, setUserCallSign } from '@/lib/sessionPersistence';
import { tryCopyTextToClipboard, tryNavigatorShare } from '@/lib/utils/share-url';
import { useAppStore } from '@/store';
import type { IcrSettings, TrainingMode } from '@/types';

interface SidebarProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly user: AuthUserSummary | null;
  readonly firebaseReady: boolean;
  readonly onGoogleLogin: () => void;
  readonly onLogout: () => void;
  readonly onSwitchAccount: () => void | Promise<void>;
  readonly authInProgress?: boolean;
  readonly settings: FormTrainingSettings;
  readonly setSettings: Dispatch<SetStateAction<FormTrainingSettings>>;
  readonly onSaveSettings: () => void;
  readonly isSavingSettings?: boolean;
  readonly sessionResultsCount: number;
  readonly latestAccuracyPercent?: number;
  readonly onViewStats: () => void;
  readonly activeMode?: TrainingMode;
  readonly onChangeMode?: (mode: TrainingMode) => void;
  readonly icrSettings?: IcrSettings;
  readonly setIcrSettings?: React.Dispatch<React.SetStateAction<IcrSettings>>;
}

export function Sidebar({
  open,
  onClose,
  user,
  firebaseReady,
  onGoogleLogin,
  onLogout,
  onSwitchAccount,
  authInProgress,
  settings,
  setSettings,
  onSaveSettings,
  isSavingSettings,
  sessionResultsCount,
  latestAccuracyPercent,
  onViewStats,
  activeMode,
  onChangeMode,
  icrSettings,
  setIcrSettings,
}: SidebarProps): JSX.Element {
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [showModeHelp, setShowModeHelp] = useState(false);
  const [callSign, setCallSign] = useState<string>('');
  const [callSignSaving, setCallSignSaving] = useState(false);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const callSignDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const { loadSessions } = useSessionsActions();
  const sessions = useAppStore((state) => state.sessions);
  const { achievements, progress } = useAchievementsState(sessions);
  const { publishAchievementProfile } = useAchievementsActions();

  const autoAdjustProfile = activeMode === 'echo' ? 'echo' : 'group';

  // Load call-sign when user is available
  useEffect(() => {
    if (!user?.uid || !firebaseReady) {
      setCallSign('');
      return;
    }
    const loadCallSign = async (): Promise<void> => {
      try {
        const services = initFirebase();
        if (!services) return;
        const firebaseLite = { db: services.db, auth: services.auth };
        // user.uid is guaranteed to be defined here due to the check above
        const loaded = await getUserCallSign(firebaseLite, { uid: user.uid! });
        setCallSign(loaded || '');
      } catch (e) {
        console.warn('Failed to load call-sign', e);
      }
    };
    void loadCallSign();
  }, [user?.uid, firebaseReady]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return (): void => {
      if (callSignDebounceRef.current) {
        clearTimeout(callSignDebounceRef.current);
      }
    };
  }, []);

  const saveCallSign = async (value: string): Promise<void> => {
    if (!user?.uid || !firebaseReady) return;
    setCallSignSaving(true);
    try {
      const services = initFirebase();
      if (!services) return;
      const firebaseLite = { db: services.db, auth: services.auth };
      await setUserCallSign(firebaseLite, { uid: user.uid }, value || null);

      // Reload sessions to trigger leaderboard update with new call-sign
      // This will backfill call-sign to existing leaderboard entries
      try {
        await loadSessions();
      } catch (e) {
        // Ignore errors from session reload - call-sign is already saved
        console.warn('Failed to reload sessions after call-sign update', e);
      }
    } catch (e) {
      console.warn('Failed to save call-sign', e);
      // Revert on error
      try {
        const services = initFirebase();
        if (!services) return;
        const firebaseLite = { db: services.db, auth: services.auth };
        const loaded = await getUserCallSign(firebaseLite, { uid: user.uid });
        setCallSign(loaded || '');
      } catch {}
    } finally {
      setCallSignSaving(false);
    }
  };

  const handleCallSignInputChange = (value: string): void => {
    // Update local state immediately for responsive UI
    setCallSign(value);

    // Clear existing debounce timer
    if (callSignDebounceRef.current) {
      clearTimeout(callSignDebounceRef.current);
    }

    // Debounce save: wait 1 second after user stops typing
    callSignDebounceRef.current = setTimeout(() => {
      void saveCallSign(value);
    }, 1000);
  };

  const handleCallSignKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Clear debounce and save immediately on Enter
      if (callSignDebounceRef.current) {
        clearTimeout(callSignDebounceRef.current);
        callSignDebounceRef.current = null;
      }
      void saveCallSign(callSign);
    }
  };

  const handleShareProfile = async (): Promise<void> => {
    setShareStatus(null);

    let profile;
    try {
      profile = await publishAchievementProfile(sessions);
    } catch (error) {
      console.warn('Failed to publish profile', error);
      setShareStatus('Unable to publish profile. Check your connection and try again.');
      return;
    }

    if (!profile) {
      setShareStatus('Sign in with Firebase enabled to publish a public profile.');
      return;
    }

    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const shareUrl = `${origin}/profile/?u=${profile.publicId}`;
    const sharePayload = {
      title: 'CW-Trainer profile',
      text: `My CW-Trainer trophy case: ${profile.badgeCount} badges, best score ${Math.round(profile.bestScore)}.`,
      url: shareUrl,
    };

    const shareResult = await tryNavigatorShare(sharePayload);
    if (shareResult === 'shared' || shareResult === 'cancelled') {
      return;
    }

    const copied = await tryCopyTextToClipboard(shareUrl);
    if (copied) {
      setShareStatus('Profile link copied to clipboard.');
      return;
    }

    setShareStatus(shareUrl);
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleClickOutside = (event: MouseEvent): void => {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    // Add event listener with a small delay to avoid immediate trigger
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return (): void => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open, onClose]);

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden" onClick={onClose} />
      )}
      <div
        ref={sidebarRef}
        className={`fixed top-0 right-0 h-full w-[28rem] max-w-full bg-white shadow-2xl transform transition-transform duration-300 ease-in-out z-50 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 h-full overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-800">Settings &amp; Account</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {onChangeMode && (
            <div className="mb-6 p-4 bg-slate-50 rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-slate-800">Modes</h4>
                <button
                  type="button"
                  onClick={() => setShowModeHelp((value) => !value)}
                  className={`inline-flex items-center justify-center h-6 px-2 rounded-full text-xs font-semibold border transition-colors ${
                    showModeHelp
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                  title="What are these modes?"
                  aria-expanded={showModeHelp}
                >
                  ?
                </button>
              </div>
              {showModeHelp && (
                <div className="mb-3 text-xs text-slate-700 bg-white border border-slate-200 rounded-lg p-3">
                  <div className="font-semibold text-slate-800 mb-1">Mode guide</div>
                  <ul className="list-disc ml-4 space-y-1">
                    <li>
                      <span className="font-medium">Group</span>: Sends groups of characters at your
                      settings. You type each group and get stats.
                    </li>
                    <li>
                      <span className="font-medium">ICR</span>: Instant Character Recognition drills
                      focusing on single-character speed.
                    </li>
                    <li>
                      <span className="font-medium">Echo</span>: Hear a character, then send it back
                      with <code>[</code> for dot and <code>]</code> for dash.
                    </li>
                    <li>
                      <span className="font-medium">Chase</span>: Copy falling Morse groups before
                      they hit the danger zone. Speed rises and lives are limited.
                    </li>
                    <li>
                      <span className="font-medium">Player</span>: Type any text and play it as
                      Morse, or run listen-only random letters from your current alphabet.
                    </li>
                  </ul>
                </div>
              )}
              {activeMode && (
                <TrainingModeCarousel
                  activeMode={activeMode}
                  onChangeMode={(mode) => {
                    onChangeMode?.(mode);
                  }}
                />
              )}
            </div>
          )}

          <div className="mb-6 border border-slate-200 rounded-xl">
            <button
              className="w-full flex items-center justify-between px-4 py-3 text-left font-semibold text-slate-800"
              onClick={() => setSettingsOpen((value) => !value)}
            >
              <span>Settings</span>
              <span className={`transition-transform ${settingsOpen ? 'rotate-90' : ''}`}>▶</span>
            </button>
            {settingsOpen && (
              <div className="px-4 pb-4">
                <div className="mb-3 rounded-lg border border-indigo-100 bg-indigo-50/70 p-3 text-xs text-indigo-950">
                  <span className="font-semibold">Settings scope:</span> shared Morse settings are
                  always shown first. Mode-specific options appear below them for the selected mode.
                </div>
                {/* Shared settings - always visible (character set, audio, etc.) */}
                <TrainingSettingsForm
                  settings={settings}
                  setSettings={setSettings}
                  onSaveSettings={onSaveSettings}
                  autoAdjustProfile={autoAdjustProfile}
                />

                {/* ICR Settings - only visible when in ICR mode */}
                {activeMode === 'icr' && icrSettings && setIcrSettings && (
                  <ICRSettingsForm settings={icrSettings} setSettings={setIcrSettings} />
                )}
                {activeMode === 'echo' && (
                  <EchoSettingsForm settings={settings} setSettings={setSettings} />
                )}
                {activeMode === 'chase' && (
                  <ChaseSettingsForm
                    settings={settings}
                    setSettings={setSettings}
                    onSaveSettings={onSaveSettings}
                  />
                )}
                {activeMode === 'player' && (
                  <PlayerSettingsForm settings={settings} setSettings={setSettings} />
                )}
                <div className="flex justify-end mt-4">
                  <button
                    onClick={onSaveSettings}
                    disabled={Boolean(isSavingSettings)}
                    className={`px-4 py-2 rounded-lg transition-colors text-sm ${
                      isSavingSettings
                        ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700'
                    }`}
                  >
                    {isSavingSettings ? 'Saving…' : 'Save Settings'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {user ? (
            <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center text-white font-bold">
                  {(user.username || user.email).charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-slate-800">{user.username || 'User'}</p>
                  <p className="text-sm text-slate-600">{user.email}</p>
                </div>
              </div>
              {firebaseReady && (
                <div className="mb-3">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Call Sign (for leaderboard)
                  </label>
                  <input
                    type="text"
                    value={callSign}
                    onChange={(e) => {
                      const value = e.target.value.toUpperCase().replace(/[^A-Z0-9/]/g, '');
                      handleCallSignInputChange(value);
                    }}
                    onKeyDown={handleCallSignKeyDown}
                    placeholder="e.g., W1ABC"
                    maxLength={20}
                    disabled={callSignSaving}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100 disabled:text-slate-500"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    {callSignSaving
                      ? 'Saving...'
                      : 'Optional: Your call sign will appear on the leaderboard instead of your ID. Press Enter to save immediately.'}
                  </p>
                </div>
              )}
              <div className="mb-3 rounded-xl border border-indigo-100 bg-white/80 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
                      Trophy case
                    </p>
                    <p className="mt-1 text-sm text-slate-700">
                      {achievements.length} trophies, {progress.masteredLetterCount}/
                      {progress.totalLetterCount} letters mastered
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {sessionResultsCount} sessions
                      {latestAccuracyPercent !== undefined
                        ? `, latest ${latestAccuracyPercent}%`
                        : ''}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Earn and view trophies locally. Sign in only to sync or share them.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onViewStats}
                    className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                  >
                    View
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => void handleShareProfile()}
                  disabled={!firebaseReady}
                  className="mt-3 w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  Share public profile
                </button>
                {shareStatus && <p className="mt-2 text-xs text-slate-600">{shareStatus}</p>}
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={onLogout}
                  className="w-full px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                >
                  Logout
                </button>
                {firebaseReady && (
                  <button
                    onClick={onSwitchAccount}
                    className="w-full px-4 py-2 bg-white border-2 border-gray-300 text-slate-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Switch Google Account
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-4 text-slate-800">Sign In</h3>
              <p className="text-xs text-slate-600 mb-2">
                Login is only needed to sync settings and history across devices. Without login,
                data stays on this device.
              </p>
              {firebaseReady && (
                <button
                  onClick={onGoogleLogin}
                  disabled={authInProgress}
                  className={`w-full px-4 py-3 mb-3 border-2 rounded-lg transition-colors flex items-center justify-center gap-2 ${
                    authInProgress
                      ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-white border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  {authInProgress ? 'Redirecting…' : 'Continue with Google'}
                </button>
              )}
              {!firebaseReady && (
                <div className="px-4 py-3 mb-3 border-2 border-gray-200 rounded-lg bg-gray-50 text-center">
                  <p className="text-sm text-slate-600">Firebase not configured</p>
                  <p className="text-xs text-slate-500 mt-1">
                    App is running in local-only mode. Data will be saved locally.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
