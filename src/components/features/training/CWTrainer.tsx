'use client';

import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react';

import { ICRTrainer } from '@/components/features/icr/ICRTrainer';
import { Sidebar } from '@/components/features/sidebar/Sidebar';
import { GroupTrainingStats } from '@/components/features/stats/GroupTrainingStats';
import { ActivityHeatmap } from '@/components/ui/charts/ActivityHeatmap';
import { GroupsList } from '@/components/ui/training/GroupsList';
import { ProgressHeader } from '@/components/ui/training/ProgressHeader';
import { TextPlayer } from '@/components/ui/training/TextPlayer';
import { TrainingControls } from '@/components/ui/training/TrainingControls';
import { useAuth, type AuthUserSummary } from '@/hooks/useAuth';
import { useIcrSettings } from '@/hooks/useIcrSettings';
import { useSessionsActions, useSessionsState } from '@/hooks/useSessions';
import { useTrainingSettingsActions, useTrainingSettingsState } from '@/hooks/useTrainingSettings';
import {
  AUTO_CONFIRM_DELAY_MS,
  AUTO_SAVE_DELAY_MS,
  MAX_KOCH_LEVEL_GUESS,
  SLEEP_CANCELABLE_STEP_MS,
  TOAST_DURATION_MS,
} from '@/lib/constants';
import { ensureAppError } from '@/lib/errors';
import { calculateGroupLetterAccuracy } from '@/lib/groupAlignment';
import { playMorseCodeControlled } from '@/lib/morseAudio';
import {
  calculateAlphabetSize,
  calculateEffectiveAlphabetSize,
  calculateTotalChars,
  computeAverageResponseMs,
  computeSessionScore,
} from '@/lib/score';
import { trainingReducer as externalTrainingReducer } from '@/lib/trainingMachine';
import { serializeSettings as tsSerialize } from '@/lib/trainingSettings';
import { generateGroup as externalGenerateGroup } from '@/lib/trainingUtils';
import type { SessionResult } from '@/types/session';

// Training state machine moved to lib/trainingMachine

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
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  const {
    trainingSettings: settings,
    trainingSettingsSaving: isSavingSettings,
    trainingSettingsStatus,
  } = useTrainingSettingsState();
  const { setTrainingSettingsState, saveTrainingSettings } = useTrainingSettingsActions();
  const { sessions } = useSessionsState();
  const { saveSession } = useSessionsActions();

  const [isTraining, setIsTraining] = useState(false);
  const [currentGroup, setCurrentGroup] = useState(0);
  const [sentGroups, setSentGroups] = useState<string[]>([]);
  const [userInput, setUserInput] = useState<string[]>([]);
  const [confirmedGroups, setConfirmedGroups] = useState<Record<number, boolean>>({});
  const [currentFocusedGroup, setCurrentFocusedGroup] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeMode, setActiveMode] = useState<'group' | 'icr' | 'player'>('group');
  const [groupTab, setGroupTab] = useState<'train' | 'stats'>('train');
  const { icrSettings, setIcrSettings } = useIcrSettings();

  // Simple swipe container to switch modes left/right
  function SwipeContainer({
    onSwipe,
    children,
  }: {
    onSwipe: (mode: 'group' | 'icr') => void;
    children: React.ReactNode;
  }): JSX.Element {
    const startXRef = useRef<number | null>(null);
    return (
      <div
        onTouchStart={(e) => {
          startXRef.current = e.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          const endX = e.changedTouches[0]?.clientX ?? null;
          if (startXRef.current != null && endX != null) {
            const dx = endX - startXRef.current;
            if (Math.abs(dx) > 60) {
              if (dx > 0) onSwipe('group');
              else onSwipe('icr');
            }
          }
          startXRef.current = null;
        }}
      >
        {children}
      </div>
    );
  }

  const [, dispatchMachine] = useReducer(externalTrainingReducer, {
    status: 'idle',
    currentGroupIndex: 0,
    sessionId: 0,
  });

  // Stop training when navigating away from training panel
  const stopTrainingIfActive = (): void => {
    if (isTraining) {
      trainingAbortRef.current = true;
      setIsTraining(false);
      dispatchMachine({ type: 'STOP' });
    }
  };

  const audioContextRef = useRef<AudioContext | null>(null);
  const trainingAbortRef = useRef<boolean>(false);
  const sessionIdRef = useRef<number>(0);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const startedAtRef = useRef<number | null>(null);
  const userInputRef = useRef<string[]>([]);
  const confirmedGroupsRef = useRef<Record<number, boolean>>({});
  const resultsProcessedRef = useRef<boolean>(false);
  const activeSentGroupsRef = useRef<string[]>([]);
  const groupStartAtRef = useRef<number[]>([]);
  const groupEndAtRef = useRef<number[]>([]);
  const groupAnswerAtRef = useRef<number[]>([]);
  // Event-driven group completion: promise resolvers for each group index
  const groupCompletionResolversRef = useRef<Record<number, ((result: { timedOut: boolean }) => void) | null>>({});

  const prevUserRef = useRef<AuthUserSummary | null>(null);
  // Use number for browser setTimeout return type (NodeJS.Timeout in Node, but we're in browser)
  type TimeoutId = number;
  const toastTimerRef = useRef<TimeoutId | undefined>(undefined);
  const settingsDebounceTimerRef = useRef<TimeoutId | undefined>(undefined);
  const lastSavedSettingsRef = useRef<string | null>(null);
  const hasInitializedSettingsRef = useRef<boolean>(false);
  const confirmTimeoutRef = useRef<Record<number, TimeoutId | undefined>>({});

  const serializeSettings = tsSerialize;
  useEffect(() => {
    if (prevUserRef.current === null && authUser) {
      setToast({ message: `Signed in as ${authUser.email || 'user'}`, type: 'success' });
    } else if (prevUserRef.current && !authUser) {
      setToast({ message: 'Signed out', type: 'info' });
    }
    prevUserRef.current = authUser;
  }, [authUser]);

  useEffect(() => {
    if (toast) {
      try {
        if (toastTimerRef.current) {
          window.clearTimeout(toastTimerRef.current);
        }
      } catch {}
      toastTimerRef.current = window.setTimeout(
        () => setToast(null),
        TOAST_DURATION_MS,
      ) as TimeoutId;
    }
    return (): void => {
      try {
        if (toastTimerRef.current) {
          window.clearTimeout(toastTimerRef.current);
        }
      } catch {}
    };
  }, [toast]);

  useEffect(() => {
    if (!hasInitializedSettingsRef.current && trainingSettingsStatus === 'ready') {
      const { customSet, ...restSettings } = settings;
      const settingsToSerialize: Parameters<typeof serializeSettings>[0] = {
        ...restSettings,
        ...(customSet && customSet.length > 0 ? { customSet: [...customSet] } : {}),
      };
      lastSavedSettingsRef.current = serializeSettings(settingsToSerialize);
      hasInitializedSettingsRef.current = true;
    }
  }, [serializeSettings, settings, trainingSettingsStatus]);

  // Keep the currently focused group centered in the viewport
  useEffect(() => {
    const target = inputRefs.current[currentFocusedGroup];
    if (target) {
      try {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch {
        // no-op
      }
    }
  }, [currentFocusedGroup]);

  // Stop training when component unmounts or when navigating away
  useEffect(() => {
    return (): void => {
      if (isTraining) {
        trainingAbortRef.current = true;
        setIsTraining(false);
        dispatchMachine({ type: 'ABORT' });
      }
      // Clean up all pending confirmation timeouts
      Object.values(confirmTimeoutRef.current).forEach((timeoutId) => {
        if (timeoutId !== undefined) {
          try {
            window.clearTimeout(timeoutId);
          } catch {}
        }
      });
      confirmTimeoutRef.current = {};
      // Clean up group completion resolvers
      groupCompletionResolversRef.current = {};
    };
  }, [isTraining]);

  const saveSettings = useCallback(
    async (opts?: { source?: 'auto' | 'manual' }): Promise<void> => {
      try {
        if (settingsDebounceTimerRef.current) {
          window.clearTimeout(settingsDebounceTimerRef.current);
          settingsDebounceTimerRef.current = undefined;
        }
      } catch {}

      try {
        const { customSet, customSequence, ...restSettings } = settings;
        const settingsToSave: Parameters<typeof saveTrainingSettings>[0] = {
          ...restSettings,
          customSet: customSet && customSet.length > 0 ? [...customSet] : [],
          ...(customSequence && customSequence.length > 0 ? { customSequence: [...customSequence] } : {}),
        };
        const saved = await saveTrainingSettings(settingsToSave);
        const { customSet: savedCustomSet, customSequence: savedCustomSequence, ...restSaved } = saved;
        const savedToSerialize: Parameters<typeof tsSerialize>[0] = {
          ...restSaved,
          ...(savedCustomSet && savedCustomSet.length > 0 ? { customSet: [...savedCustomSet] } : {}),
          ...(savedCustomSequence && savedCustomSequence.length > 0 ? { customSequence: [...savedCustomSequence] } : {}),
        };
        lastSavedSettingsRef.current = tsSerialize(savedToSerialize);

        const hasCloudContext = Boolean(firebaseServices && firebaseUser?.uid);
        const source = opts?.source ?? 'manual';
        const message = hasCloudContext
          ? source === 'auto'
            ? 'Settings synced'
            : 'Settings saved'
          : source === 'auto'
            ? 'Settings synced locally'
            : 'Settings saved locally';
        setToast({ message, type: hasCloudContext ? 'success' : 'info' });
      } catch (error) {
        const appError = ensureAppError(error);
        setToast({ message: appError.message, type: 'error' });
      }
    },
    [firebaseServices, firebaseUser, saveTrainingSettings, setToast, settings],
  );

  // Debounced auto-save of settings changes
  useEffect(() => {
    const { customSet, ...restSettings } = settings;
    const settingsToSerialize: Parameters<typeof serializeSettings>[0] = {
      ...restSettings,
      ...(customSet && customSet.length > 0 ? { customSet: [...customSet] } : {}),
    };
    const serialized = serializeSettings(settingsToSerialize);
    if (serialized === lastSavedSettingsRef.current) return;
    try {
      if (settingsDebounceTimerRef.current) {
        window.clearTimeout(settingsDebounceTimerRef.current);
      }
    } catch {}
    settingsDebounceTimerRef.current = window.setTimeout(() => {
      void saveSettings({ source: 'auto' });
    }, AUTO_SAVE_DELAY_MS) as TimeoutId;
    return (): void => {
      try {
        if (settingsDebounceTimerRef.current) {
          window.clearTimeout(settingsDebounceTimerRef.current);
        }
      } catch {}
    };
  }, [saveSettings, serializeSettings, settings]);

  const handleLogin = useCallback(async (): Promise<void> => {
    if (!firebaseReady || !firebaseServices) {
      setToast({ message: 'Firebase is not configured. Cannot sign in.', type: 'error' });
      return;
    }
    try {
      console.info('[Auth] Starting Google sign-in (redirect)');
      setToast({ message: 'Redirecting to Google…', type: 'info' });
      await signInWithGoogle();
    } catch (error) {
      console.error('[Auth] Google sign-in start failed', error);
      setToast({ message: 'Failed to start Google sign-in.', type: 'error' });
    }
  }, [firebaseReady, firebaseServices, setToast, signInWithGoogle]);

  const handleLogout = useCallback(async (): Promise<void> => {
    try {
      console.info('[Auth] Signing out');
      await signOut();
    } catch (error) {
      console.error('[Auth] Sign out error', error);
      setToast({ message: 'Failed to sign out.', type: 'error' });
    }
  }, [setToast, signOut]);

  const handleSwitchAccount = useCallback(async (): Promise<void> => {
    if (!firebaseReady || !firebaseServices) {
      setToast({ message: 'Firebase is not configured. Cannot switch accounts.', type: 'error' });
      return;
    }

    try {
      setToast({ message: 'Redirecting to Google…', type: 'info' });
      await switchAccount();
    } catch (error) {
      console.error('[Auth] Switch account failed', error);
      setToast({ message: 'Failed to switch account.', type: 'error' });
    }
  }, [firebaseReady, firebaseServices, setToast, switchAccount]);

  const generateGroup = (): string => {
    const { customSet, customSequence, ...restSettings } = settings;
    return externalGenerateGroup({
      kochLevel: restSettings.kochLevel,
      minGroupSize: restSettings.minGroupSize,
      maxGroupSize: restSettings.maxGroupSize,
      ...(restSettings.charSetMode !== undefined ? { charSetMode: restSettings.charSetMode } : {}),
      ...(restSettings.digitsLevel !== undefined ? { digitsLevel: restSettings.digitsLevel } : {}),
      ...(customSet && customSet.length > 0 ? { customSet: [...customSet] } : {}),
      ...(customSequence && customSequence.length > 0 ? { customSequence: [...customSequence] } : {}),
    });
  };

  const pickToneHz = (): number => {
    const min = Math.max(100, settings.sideToneMin);
    const max = Math.max(min, settings.sideToneMax);
    if (min === max) return min;
    return Math.floor(min + Math.random() * (max - min + 1));
  };

  const computeAutoGroupGapMs = (): number => {
    const effWpm = Math.max(1, settings.effectiveWpm || settings.charWpm || 20);
    const dotEffSec = 1.2 / effWpm;
    const wordSpaceSec = 7 * dotEffSec * Math.max(1, settings.extraWordSpaceMultiplier || 1);
    return Math.round(wordSpaceSec * 1000);
  };

  const currentStopRef = useRef<(() => void) | null>(null);

  const playMorseCode = async (text: string, sessionId: number): Promise<number> => {
    if (trainingAbortRef.current || sessionIdRef.current !== sessionId) return 0;
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    const ctx = audioContextRef.current;
    const { durationSec, stop } = await playMorseCodeControlled(
      ctx,
      text,
      {
        charWpm: Math.max(1, settings.charWpm),
        effectiveWpm: Math.max(1, settings.effectiveWpm),
        extraWordSpaceMultiplier: Math.max(1, settings.extraWordSpaceMultiplier ?? 1),
        sideTone: pickToneHz(),
        steepness: settings.steepness,
        envelopeSmoothing: settings.envelopeSmoothing ?? 0,
      },
      () => trainingAbortRef.current || sessionIdRef.current !== sessionId,
    );
    currentStopRef.current = stop;
    return durationSec;
  };

  const sleepCancelable = async (ms: number, sessionId: number): Promise<void> => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (trainingAbortRef.current || sessionIdRef.current !== sessionId) return;
      const remaining = end - Date.now();
      await new Promise((r) =>
        setTimeout(r, Math.min(SLEEP_CANCELABLE_STEP_MS, Math.max(0, remaining))),
      );
    }
  };

  const startTraining = async (): Promise<void> => {
    trainingAbortRef.current = false;
    resultsProcessedRef.current = false;
    activeSentGroupsRef.current = [];
    dispatchMachine({ type: 'START' });
    const mySession = sessionIdRef.current + 1;
    sessionIdRef.current = mySession;
    setIsTraining(true);
    setCurrentGroup(0);
    setSentGroups([]);
    setUserInput([]);
    setConfirmedGroups({});
    setCurrentFocusedGroup(0);
    startedAtRef.current = Date.now();
    userInputRef.current = [];
    confirmedGroupsRef.current = {};
    groupStartAtRef.current = [];
    groupEndAtRef.current = [];
    groupAnswerAtRef.current = [];

    const groups: string[] = [];
    for (let i = 0; i < settings.numGroups; i++) {
      groups.push(generateGroup());
    }
    setSentGroups(groups);
    activeSentGroupsRef.current = groups;
    dispatchMachine({ type: 'PREPARED' });

    for (let i = 0; i < groups.length; i++) {
      if (trainingAbortRef.current || sessionIdRef.current !== mySession) break;
      setCurrentGroup(i);
      setCurrentFocusedGroup(i);
      dispatchMachine({ type: 'GROUP_START', index: i });
      // Focus and center the active group when it starts - use requestAnimationFrame for instant, smooth focusing
      requestAnimationFrame(() => {
        const target = inputRefs.current[i];
        if (target) {
          try {
            target.focus();
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          } catch {
            // no-op
          }
        }
      });
      const delayMs = Math.max(0, computeAutoGroupGapMs());
      if (delayMs > 0) {
        await sleepCancelable(delayMs, mySession);
      }
      const startTs = Date.now();
      groupStartAtRef.current[i] = startTs;
      const group = groups[i];
      if (!group) continue;
      const duration = await playMorseCode(group, mySession);
      const endTs = startTs + Math.max(0, Math.round((duration || 0) * 1000));
      groupEndAtRef.current[i] = endTs;
      if (trainingAbortRef.current || sessionIdRef.current !== mySession) break;
      dispatchMachine({ type: 'WAIT_INPUT' });
      
      // Event-driven approach: wait for either confirmation or timeout (no polling!)
      const waitForGroupCompletion = (): Promise<{ timedOut: boolean }> => {
        return new Promise((resolve) => {
          // Check if already confirmed (user might have confirmed ahead)
          if (confirmedGroupsRef.current[i]) {
            resolve({ timedOut: false });
            return;
          }
          
          // Store resolver for event-driven completion
          let resolver: ((result: { timedOut: boolean }) => void) | null = null;
          
          // Set up timeout if configured (this is the user's groupTimeout setting)
          let timeoutId: TimeoutId | undefined = undefined;
          if (settings.groupTimeout && settings.groupTimeout > 0) {
            const timeoutMs = settings.groupTimeout * 1000;
            timeoutId = window.setTimeout(() => {
              if (!groupAnswerAtRef.current[i]) {
                groupAnswerAtRef.current[i] = Date.now();
              }
              if (resolver) {
                resolver({ timedOut: true });
              }
              delete groupCompletionResolversRef.current[i];
            }, timeoutMs) as TimeoutId;
          }
          
          // Store resolver for immediate resolution when user confirms (event-driven, no polling!)
          resolver = (result: { timedOut: boolean }): void => {
            if (timeoutId !== undefined) {
              try {
                window.clearTimeout(timeoutId);
              } catch {}
            }
            resolve(result);
            delete groupCompletionResolversRef.current[i];
          };
          
          groupCompletionResolversRef.current[i] = resolver;
        });
      };
      
      const result = await waitForGroupCompletion();
      const timedOut = result.timedOut;
      
      // Auto-advance on timeout: confirm the current group and move to next
      if (timedOut && !confirmedGroupsRef.current[i]) {
        // Clear any pending confirmation timeout for this index
        if (confirmTimeoutRef.current[i] !== undefined) {
          try {
            window.clearTimeout(confirmTimeoutRef.current[i]!);
          } catch {}
          delete confirmTimeoutRef.current[i];
        }
        const currentValue = (userInputRef.current[i] || '').trim().toUpperCase();
        const nextAnswers = [...userInputRef.current];
        nextAnswers[i] = currentValue;
        setUserInput(nextAnswers);
        userInputRef.current = nextAnswers;
        const nextConfirmed = { ...confirmedGroupsRef.current, [i]: true };
        setConfirmedGroups(nextConfirmed);
        confirmedGroupsRef.current = nextConfirmed;
        // Advance focus to next group if available - use requestAnimationFrame for instant focusing
        const nextIndex = i + 1;
        if (nextIndex < groups.length) {
          setCurrentFocusedGroup(nextIndex);
          requestAnimationFrame(() => {
            const target = inputRefs.current[nextIndex];
            if (target) {
              try {
                target.focus();
                target.scrollIntoView({ behavior: 'smooth', block: 'center' });
              } catch {
                // no-op
              }
            }
          });
        }
        // Note: If nextIndex === groups.length, we're on the last group and the loop will
        // naturally advance to it, where it will be focused in the normal flow
      }
      try {
        currentStopRef.current?.();
      } catch {}
      currentStopRef.current = null;
      if (!(trainingAbortRef.current || sessionIdRef.current !== mySession)) {
        dispatchMachine({ type: 'INPUT_RECEIVED' });
      }
    }
    setIsTraining(false);
    if (!(trainingAbortRef.current || sessionIdRef.current !== mySession)) {
      dispatchMachine({ type: 'COMPLETE' });
      if (!resultsProcessedRef.current) {
        // Use ref as source of truth for async operations
        const answers = (userInputRef.current.length > 0 ? userInputRef.current : userInput).map(
          (a) => (a || '').trim().toUpperCase(),
        );
        await processResults(answers, groups);
      }
    }
  };

  const submitAnswer = (): void => {
    trainingAbortRef.current = true;
    setIsTraining(false);
    // Use ref as source of truth for async operations
    const answers = (userInputRef.current.length > 0 ? userInputRef.current : userInput).map((a) =>
      (a || '').trim().toUpperCase(),
    );
    void processResults(answers, activeSentGroupsRef.current);
  };

  const confirmGroupAnswer = (index: number, overrideValue?: string): void => {
    if (!sentGroups.length) return;
    const normalized = (overrideValue ?? userInput[index] ?? '').trim().toUpperCase();
    const nextAnswers = [...userInput];
    nextAnswers[index] = normalized;
    setUserInput(nextAnswers);
    userInputRef.current = nextAnswers;
    const nextConfirmed = { ...confirmedGroupsRef.current, [index]: true };
    setConfirmedGroups(nextConfirmed);
    confirmedGroupsRef.current = nextConfirmed;
    if (!groupAnswerAtRef.current[index]) {
      groupAnswerAtRef.current[index] = Date.now();
    }
    
    // Resolve the promise immediately for event-driven completion (no polling delay!)
    const resolver = groupCompletionResolversRef.current[index];
    if (resolver) {
      resolver({ timedOut: false });
      delete groupCompletionResolversRef.current[index];
    }

    const nextIndex = index + 1;
    if (nextIndex < sentGroups.length) {
      setCurrentFocusedGroup(nextIndex);
      requestAnimationFrame(() => {
        const target = inputRefs.current[nextIndex];
        if (target) {
          try {
            target.focus();
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          } catch {
            // no-op
          }
        }
      });
    }

    const allAnswered =
      nextAnswers.length === sentGroups.length &&
      nextAnswers.every((a, i) => {
        const sentGroup = sentGroups[i];
        return a && sentGroup && a.length === sentGroup.length;
      });
    if (allAnswered) {
      submitAnswer();
    }
  };

  const handleAnswerChange = (index: number, value: string): void => {
    const nextAnswers = [...userInput];
    nextAnswers[index] = value;
    setUserInput(nextAnswers);
    userInputRef.current = nextAnswers;

    // Stamp answer time immediately when user finishes typing the group
    if (value.length === sentGroups[index]?.length && value.length > 0) {
      if (!groupAnswerAtRef.current[index]) {
        groupAnswerAtRef.current[index] = Date.now();
      }
      // Note: We don't resolve the wait promise here - it will be resolved when the group is
      // actually confirmed (either manually or via auto-confirm). This ensures the auto-confirm
      // delay still works properly.
    }

    // Clear any pending confirmation timeout for this index
    if (confirmTimeoutRef.current[index] !== undefined) {
      try {
        window.clearTimeout(confirmTimeoutRef.current[index]!);
      } catch {}
      delete confirmTimeoutRef.current[index];
    }

    if (
      value.length === sentGroups[index]?.length &&
      value.length > 0 &&
      (settings.interactiveMode || index <= currentGroup)
    ) {
      confirmTimeoutRef.current[index] = window.setTimeout(() => {
        confirmGroupAnswer(index, value);
        delete confirmTimeoutRef.current[index];
      }, AUTO_CONFIRM_DELAY_MS) as TimeoutId;
    }
  };

  const processResults = async (answers: string[], sentOverride?: string[]): Promise<void> => {
    if (resultsProcessedRef.current) return;
    const sentSource =
      Array.isArray(sentOverride) && sentOverride.length
        ? sentOverride
        : activeSentGroupsRef.current?.length
          ? activeSentGroupsRef.current
          : sentGroups;
    if (!Array.isArray(sentSource) || sentSource.length === 0) {
      return;
    }
    const groups = sentSource.map((sent, idx) => {
      const receivedRaw = answers[idx] || '';
      const received = receivedRaw.trim().toUpperCase();
      return {
        sent,
        received,
        correct: sent === received,
      };
    });

    // Use group alignment for accurate letter-level accuracy calculation
    // This handles insertions, deletions, and substitutions properly
    const letterAccuracy = calculateGroupLetterAccuracy(groups);

    const accuracy = groups.length > 0 ? groups.filter((g) => g.correct).length / groups.length : 0;
    const groupTimings = groups.map((g, idx) => {
      const endAt = groupEndAtRef.current[idx] || 0;
      const rawAnsAt = groupAnswerAtRef.current[idx] || 0;
      const timeoutMs = Math.max(0, settings.groupTimeout || 0) * 1000;
      const fallbackAnsAt = endAt > 0 && timeoutMs > 0 ? endAt + timeoutMs : 0;
      const ansAt = rawAnsAt > 0 ? rawAnsAt : fallbackAnsAt;
      const delta = Math.max(0, ansAt - endAt);
      const perChar = g.sent && g.sent.length > 0 ? Math.round(delta / g.sent.length) : 0;
      return { timeToCompleteMs: Number.isFinite(delta) ? delta : 0, perCharMs: perChar };
    });

    const alphabetSize = calculateAlphabetSize(groups);
    const effectiveAlphabetSize = calculateEffectiveAlphabetSize(groups, {
      applyMillerMadow: true,
    });
    // Use perCharMs if available (preferred metric), otherwise fall back to timeToCompleteMs
    // Note: perCharMs can be 0 (legitimate value when user answers immediately), so use nullish coalescing
    const avgResponseMs = computeAverageResponseMs(
      groupTimings.map((t) => ({
        timeToCompleteMs: typeof t.perCharMs === 'number' ? t.perCharMs : t.timeToCompleteMs,
      })),
    );
    const totalChars = calculateTotalChars(groups);
    const score = computeSessionScore({
      effectiveAlphabetSize,
      alphabetSize,
      accuracy,
      avgResponseMs,
      totalChars,
    });

    const dateStr = new Date().toISOString().split('T')[0];
    if (!dateStr) throw new Error('Failed to generate date string');
    const result: SessionResult = {
      date: dateStr,
      timestamp: Date.now(),
      startedAt: startedAtRef.current || Date.now(),
      finishedAt: Date.now(),
      groups: groups.map(g => ({ ...g })),
      groupTimings: groupTimings.map(t => ({ ...t })),
      accuracy,
      letterAccuracy,
      alphabetSize,
      totalChars,
      effectiveAlphabetSize,
      avgResponseMs,
      score,
    };

    try {
      const sessionToSave: Parameters<typeof saveSession>[0] = {
        ...result,
        groups: result.groups.map(g => ({ sent: g.sent, received: g.received, correct: g.correct })),
        groupTimings: result.groupTimings.map(t => ({ 
          timeToCompleteMs: t.timeToCompleteMs,
          ...(t.perCharMs !== undefined ? { perCharMs: t.perCharMs } : {}),
        })),
      };
      await saveSession(sessionToSave);
    } catch (error) {
      const appError = ensureAppError(error);
      setToast({ message: appError.message, type: 'error' });
    } finally {
      resultsProcessedRef.current = true;
    }

    try {
      if (settings.autoAdjustKoch) {
        const threshold = Math.max(0, Math.min(100, settings.autoAdjustThreshold ?? 90));
        const accuracyPct = (result.accuracy || 0) * 100;
        let delta = 0;
        if (accuracyPct >= threshold) {
          delta = 1;
        } else if (accuracyPct < threshold) {
          delta = -1;
        }
        if (delta !== 0) {
          const nextLevel = Math.max(
            1,
            Math.min((settings.kochLevel || 1) + delta, MAX_KOCH_LEVEL_GUESS),
          );
          if (nextLevel !== settings.kochLevel) {
            setTrainingSettingsState((prev) => ({ ...prev, kochLevel: nextLevel }));
            setToast({
              message: `Koch level ${delta > 0 ? 'increased' : 'decreased'} to ${nextLevel} (accuracy ${Math.round(accuracyPct)}%, threshold ${threshold}%)`,
              type: delta > 0 ? 'success' : 'info',
            });
          }
        }
      }
    } catch {}

    setActiveMode('group');
    setGroupTab('stats');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 p-2 sm:p-4 lg:p-6 relative">
      {toast && (
        <div className="fixed top-4 right-4 z-50">
          <div
            className={`px-4 py-3 rounded-xl shadow-lg border text-sm ${
              toast.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : toast.type === 'error'
                  ? 'bg-rose-50 text-rose-800 border-rose-200'
                  : 'bg-slate-50 text-slate-800 border-slate-200'
            }`}
            onClick={() => setToast(null)}
          >
            {toast.message}
          </div>
        </div>
      )}
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        user={authUser}
        firebaseReady={firebaseReady}
        onGoogleLogin={handleLogin}
        onLogout={handleLogout}
        onSwitchAccount={handleSwitchAccount}
        authInProgress={authInProgress}
        settings={{
          ...settings,
          customSet: settings.customSet ? [...settings.customSet] : [],
        }}
        setSettings={(next) => {
          const currentSettings = {
            ...settings,
            customSet: settings.customSet ? [...settings.customSet] : [],
          };
          const nextValue = typeof next === 'function' ? next(currentSettings) : next;
          const { customSet: nextCustomSet, ...restNext } = nextValue;
          const convertedSettings = {
            ...restNext,
            customSet: nextCustomSet && nextCustomSet.length > 0 ? [...nextCustomSet] : [],
          } as Parameters<typeof setTrainingSettingsState>[0];
          setTrainingSettingsState(convertedSettings);
        }}
        onSaveSettings={() => {
          void saveSettings({ source: 'manual' });
        }}
        isSavingSettings={isSavingSettings}
        sessionResultsCount={sessions.length}
        latestAccuracyPercent={
          sessions.length > 0 ? Math.round((sessions[sessions.length - 1]?.accuracy ?? 0) * 100) : 0
        }
        onViewStats={() => {
          stopTrainingIfActive();
          setSidebarOpen(false);
          setActiveMode('group');
          setGroupTab('stats');
        }}
        activeMode={activeMode}
        onChangeMode={(m) => {
          setActiveMode(m);
          // Don't close sidebar - let user continue configuring settings
          // Keep current tab when switching to group mode
          if (m !== 'group') {
            setGroupTab('train');
          }
        }}
        icrSettings={icrSettings}
        setIcrSettings={setIcrSettings}
      />

      <div className="max-w-4xl mx-auto bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl ring-1 ring-black/5 p-3 sm:p-6 lg:p-8 border border-white/20">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl sm:text-5xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Morse Code Trainer
            </h1>
            <p className="text-slate-600 mt-2">Train Morse. Fast. Focused. Fun.</p>
          </div>

          {/* Menu Button */}
          <button
            onClick={() => {
              stopTrainingIfActive();
              setSidebarOpen(true);
            }}
            className="p-3 bg-gradient-to-r from-slate-100 to-slate-200 hover:from-slate-200 hover:to-slate-300 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            <svg
              className="w-6 h-6 text-slate-700"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        </div>

        {!isTraining && activeMode === 'group' && groupTab === 'train' ? (
          <div className="space-y-8">
            {sessions.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-white border border-emerald-100">
                  <p className="text-xs uppercase tracking-wide text-emerald-700 font-semibold">
                    Last Accuracy
                  </p>
                  <p className="text-3xl font-extrabold text-emerald-800 mt-1">
                    {((): number => {
                      const lastSession = sessions[sessions.length - 1];
                      return lastSession && Number.isFinite(lastSession.accuracy)
                        ? Math.round(lastSession.accuracy * 100)
                        : 0;
                    })()}
                    %
                  </p>
                  <p className="text-xs text-emerald-700/70 mt-1">from your last session</p>
                </div>
                <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50 to-white border border-blue-100">
                  <p className="text-xs uppercase tracking-wide text-blue-700 font-semibold">
                    Sessions
                  </p>
                  <p className="text-3xl font-extrabold text-blue-800 mt-1">{sessions.length}</p>
                  <p className="text-xs text-blue-700/70 mt-1">total completed</p>
                </div>
                <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-50 to-white border border-purple-100">
                  <p className="text-xs uppercase tracking-wide text-purple-700 font-semibold">
                    Koch Level
                  </p>
                  <p className="text-3xl font-extrabold text-purple-800 mt-1">
                    {settings.kochLevel}
                  </p>
                  <p className="text-xs text-purple-700/70 mt-1">active characters</p>
                </div>
              </div>
            )}

            <ActivityHeatmap
              sessions={sessions.map((s) => ({
                date: s.date,
                timestamp: s.timestamp,
                count: Array.isArray(s.groups)
                  ? s.groups.reduce(
                      (acc, g) => acc + (typeof g?.sent === 'string' ? g.sent.length : 0),
                      0,
                    )
                  : 0,
              }))}
              monthsPerPage={3}
              startOfWeek={1}
            />

            {/* Accuracy Trend removed on front page (still available in Stats) */}

            <div className="flex justify-center gap-3 flex-wrap">
              <button
                onClick={startTraining}
                className="px-12 py-4 bg-gradient-to-r from-emerald-500 to-green-600 text-white text-xl font-bold rounded-xl hover:from-emerald-600 hover:to-green-700 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                🚀 Start Training
              </button>
              <button
                onClick={() => {
                  stopTrainingIfActive();
                  setGroupTab('stats');
                }}
                className="px-12 py-4 bg-white text-slate-700 text-xl font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 transition-all duration-200 shadow-sm hover:shadow"
              >
                📊 View Stats
              </button>
            </div>
          </div>
        ) : !isTraining && activeMode === 'group' && groupTab === 'stats' ? (
          <div className="space-y-6">
            <div className="flex justify-end">
              <button
                onClick={() => setGroupTab('train')}
                className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
              >
                Back to Training
              </button>
            </div>
            <GroupTrainingStats
              embedded
              onBack={() => setGroupTab('train')}
              thresholdPercent={Math.max(0, Math.min(100, settings.autoAdjustThreshold ?? 90))}
            />
          </div>
        ) : isTraining && activeMode === 'group' ? (
          <div className="space-y-6">
            <ProgressHeader currentGroup={currentGroup} totalGroups={settings.numGroups} />

            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
                <label className="block text-sm font-medium text-gray-700">
                  Enter answers per group (auto-advances when complete):
                </label>

                {/* Group Navigation for Mobile - disabled during training */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-sm text-gray-600 whitespace-nowrap">Jump to:</span>
                  <select
                    value={currentFocusedGroup}
                    onChange={(e) => {
                      if (!isTraining) {
                        const groupIndex = parseInt(e.target.value);
                        setCurrentFocusedGroup(groupIndex);
                        inputRefs.current[groupIndex]?.focus();
                      }
                    }}
                    disabled={isTraining}
                    className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100"
                  >
                    {sentGroups.map((_, idx) => (
                      <option key={idx} value={idx}>
                        Group {idx + 1}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <GroupsList
                sentGroups={sentGroups}
                userInput={userInput}
                confirmedGroups={confirmedGroups}
                currentFocusedGroup={currentFocusedGroup}
                currentActiveGroup={currentGroup}
                isTraining={isTraining}
                interactiveMode={settings.interactiveMode}
                onChange={handleAnswerChange}
                onConfirm={confirmGroupAnswer}
                onFocus={(idx) => {
                  // Only allow focus changes during training if it's the current active group
                  // This prevents accidental focus changes while session is playing
                  // In interactive mode, allow focus on any group
                  if (!isTraining || settings.interactiveMode || idx === currentGroup) {
                    setCurrentFocusedGroup(idx);
                  }
                }}
                inputRef={(idx, el) => {
                  inputRefs.current[idx] = el;
                }}
              />
              <p className="text-xs text-slate-500 mt-2">
                💡 Auto-advances when group is complete • Use Enter to confirm • Scroll to review
                past groups
              </p>
            </div>

            <TrainingControls
              onSubmit={submitAnswer}
              onStop={() => {
                trainingAbortRef.current = true;
                setIsTraining(false);
              }}
            />
          </div>
        ) : activeMode === 'icr' ? (
          <SwipeContainer onSwipe={setActiveMode}>
            <ICRTrainer
              sharedAudio={{
                kochLevel: settings.kochLevel,
                ...(settings.charSetMode !== undefined ? { charSetMode: settings.charSetMode } : {}),
                ...(settings.digitsLevel !== undefined ? { digitsLevel: settings.digitsLevel } : {}),
                ...(settings.customSet && settings.customSet.length > 0 ? { customSet: [...settings.customSet] } : {}),
                ...(settings.customSequence && settings.customSequence.length > 0 ? { customSequence: [...settings.customSequence] } : {}),
                charWpm: Math.max(1, settings.charWpm),
                effectiveWpm: Math.max(1, settings.effectiveWpm),
                sideToneMin: settings.sideToneMin,
                sideToneMax: settings.sideToneMax,
                steepness: settings.steepness,
                envelopeSmoothing: settings.envelopeSmoothing,
              }}
              icrSettings={icrSettings}
            />
          </SwipeContainer>
        ) : activeMode === 'player' ? (
          <div className="space-y-6">
            <TextPlayer settings={{
              ...settings,
              customSet: settings.customSet ? [...settings.customSet] : [],
            }} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
