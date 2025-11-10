'use client';

import React, { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';

import type { TrainingSettings } from '@/components/ui/forms/TrainingSettingsForm';
import { TrainingSettingsForm } from '@/components/ui/forms/TrainingSettingsForm';
import { ICRSettingsForm } from '@/components/ui/forms/ICRSettingsForm';
import type { AuthUserSummary } from '@/hooks/useAuth';
import type { IcrSettings } from '@/types';

interface SidebarProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly user: AuthUserSummary | null;
  readonly firebaseReady: boolean;
  readonly onGoogleLogin: () => void;
  readonly onLogout: () => void;
  readonly onSwitchAccount: () => void | Promise<void>;
  readonly authInProgress?: boolean;
  readonly settings: TrainingSettings;
  readonly setSettings: Dispatch<SetStateAction<TrainingSettings>>;
  readonly onSaveSettings: () => void;
  readonly isSavingSettings?: boolean;
  readonly sessionResultsCount: number;
  readonly latestAccuracyPercent?: number;
  readonly onViewStats: () => void;
  readonly activeMode?: 'group' | 'icr' | 'player';
  readonly onChangeMode?: (mode: 'group' | 'icr' | 'player') => void;
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
  activeMode,
  onChangeMode,
  icrSettings,
  setIcrSettings,
}: SidebarProps): JSX.Element {
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [showModeHelp, setShowModeHelp] = useState(false);

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden" onClick={onClose} />
      )}
      <div
        className={`fixed top-0 right-0 h-full w-96 max-w-full bg-white shadow-2xl transform transition-transform duration-300 ease-in-out z-50 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
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
                      <span className="font-medium">Player</span>: Type any text and play it as
                      Morse using your tone and speed.
                    </li>
                  </ul>
                </div>
              )}
              <div className="grid grid-cols-3 gap-2">
                <button
                  className={`px-3 py-2 rounded-lg text-sm border ${
                    activeMode === 'group'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white hover:bg-gray-50 border-gray-300 text-slate-700'
                  }`}
                  onClick={() => {
                    onChangeMode?.('group');
                    // Don't close sidebar - let user continue configuring settings
                  }}
                >
                  Group
                </button>
                <button
                  className={`px-3 py-2 rounded-lg text-sm border ${
                    activeMode === 'icr'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white hover:bg-gray-50 border-gray-300 text-slate-700'
                  }`}
                  onClick={() => {
                    onChangeMode?.('icr');
                    // Don't close sidebar - let user continue configuring settings
                  }}
                >
                  ICR
                </button>
                <button
                  className={`px-3 py-2 rounded-lg text-sm border ${
                    activeMode === 'player'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white hover:bg-gray-50 border-gray-300 text-slate-700'
                  }`}
                  onClick={() => {
                    onChangeMode?.('player');
                    // Don't close sidebar - let user continue configuring settings
                  }}
                >
                  Player
                </button>
              </div>
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
                {/* Shared settings - always visible (character set, audio, etc.) */}
                <TrainingSettingsForm settings={settings} setSettings={setSettings} />
                
                {/* ICR Settings - only visible when in ICR mode */}
                {activeMode === 'icr' && icrSettings && setIcrSettings && (
                  <ICRSettingsForm settings={icrSettings} setSettings={setIcrSettings} />
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
