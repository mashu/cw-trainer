import React, { useState, useEffect, useRef, useReducer } from 'react';
import ICRTrainer from './ICRTrainer';
import ActivityHeatmap from './ActivityHeatmap';
import ProgressHeader from './ProgressHeader';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import GroupsList from './GroupsList';
import TrainingControls from './TrainingControls';
import StatsView, { SessionResult as StatsSessionResult } from './StatsView';
import { initFirebase, googleSignIn, googleSignOut, getRedirectedUser } from '@/lib/firebaseClient';
import { playMorseCode as externalPlayMorseCode } from '@/lib/morseAudio';
import { trainingReducer as externalTrainingReducer } from '@/lib/trainingMachine';
import { generateGroup as externalGenerateGroup } from '@/lib/trainingUtils';
import { getDailyStats as computeDailyStats, getLetterStats as computeLetterStats } from '@/lib/stats';
import Sidebar from './Sidebar';
import { collection, doc, getDocs, orderBy, query, setDoc, deleteDoc } from 'firebase/firestore';
import { onAuthStateChanged, setPersistence, browserLocalPersistence } from 'firebase/auth';

// Constants and MORSE code moved to lib/morseConstants

interface TrainingSettings {
  kochLevel: number;
  sideTone: number;
  steepness: number;
  sessionDuration: number;
  charsPerGroup: number;
  numGroups: number;
  wpm: number;
  groupTimeout: number; // absolute max time per group (seconds)
  groupDelay: number; // ms to wait before playing next group
  minGroupSize: number;
  maxGroupSize: number;
  interactiveMode: boolean;
  envelopeSmoothing?: number; // 0 (linear) .. 1 (smooth)
  // Auto adjustment of Koch level based on session accuracy
  autoAdjustKoch?: boolean;
  autoAdjustThreshold?: number; // percentage 0..100 (e.g. 90)
}

interface SessionResult {
  date: string;
  timestamp: number;
  startedAt: number;
  finishedAt: number;
  groups: Array<{
    sent: string;
    received: string;
    correct: boolean;
  }>;
  accuracy: number;
  letterAccuracy: Record<string, { correct: number; total: number }>;
}

// Training state machine moved to lib/trainingMachine

interface User {
  email: string;
  username?: string;
}

const CWTrainer: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [authInProgress, setAuthInProgress] = useState(false);
  
  const [settings, setSettings] = useState<TrainingSettings>({
    kochLevel: 2,
    sideTone: 600,
    steepness: 5,
    sessionDuration: 5,
    charsPerGroup: 5,
    numGroups: 5,
    wpm: 20,
    groupTimeout: 8,
    groupDelay: 1000,
    minGroupSize: 2,
    maxGroupSize: 3,
    interactiveMode: false,
    envelopeSmoothing: 0,
    autoAdjustKoch: false,
    autoAdjustThreshold: 90
  });

  const [isTraining, setIsTraining] = useState(false);
  const [currentGroup, setCurrentGroup] = useState(0);
  const [sentGroups, setSentGroups] = useState<string[]>([]);
  const [userInput, setUserInput] = useState<string[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [sessionResults, setSessionResults] = useState<SessionResult[]>([]);
  const [showStats, setShowStats] = useState(false);
  const [confirmedGroups, setConfirmedGroups] = useState<Record<number, boolean>>({});
  const [showDetailedStats, setShowDetailedStats] = useState(false);
  const [currentFocusedGroup, setCurrentFocusedGroup] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeMode, setActiveMode] = useState<'group' | 'icr'>('group');
  const [icrSettings, setIcrSettings] = useState<{ trialsPerSession: number; trialDelayMs: number; vadEnabled: boolean; vadThreshold: number; vadHoldMs: number; micDeviceId?: string; bucketGreenMaxMs: number; bucketYellowMaxMs: number }>({ trialsPerSession: 30, trialDelayMs: 700, vadEnabled: true, vadThreshold: 0.08, vadHoldMs: 60, bucketGreenMaxMs: 900, bucketYellowMaxMs: 1200 });

  // Load & save ICR settings with localStorage for persistence
  useEffect(() => {
    try {
      const raw = localStorage.getItem('morse_icr_settings');
      if (raw) {
        setIcrSettings(prev => ({ ...prev, ...JSON.parse(raw) }));
      }
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem('morse_icr_settings', JSON.stringify(icrSettings)); } catch {}
  }, [icrSettings]);

  // Simple swipe container to switch modes left/right
  const SwipeContainer: React.FC<{ activeMode: 'group' | 'icr'; onSwipe: (m: 'group' | 'icr') => void; children: React.ReactNode }> = ({ activeMode, onSwipe, children }) => {
    const startXRef = useRef<number | null>(null);
    return (
      <div
        onTouchStart={(e) => { startXRef.current = e.touches[0]?.clientX ?? null; }}
        onTouchEnd={(e) => {
          const endX = e.changedTouches[0]?.clientX ?? null;
          if (startXRef.current != null && endX != null) {
            const dx = endX - startXRef.current;
            if (Math.abs(dx) > 60) {
              if (dx > 0) onSwipe('group'); else onSwipe('icr');
            }
          }
          startXRef.current = null;
        }}
      >{children}</div>
    );
  };

  const ModeTabs: React.FC<{ activeMode: 'group' | 'icr'; onChange: (m: 'group' | 'icr') => void }> = ({ activeMode, onChange }) => (
    <div className="mb-4 flex gap-2">
      <button
        className={`px-3 py-1 rounded-lg text-sm border ${activeMode === 'group' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white hover:bg-gray-50 border-gray-300 text-slate-700'}`}
        onClick={() => onChange('group')}
      >Group</button>
      <button
        className={`px-3 py-1 rounded-lg text-sm border ${activeMode === 'icr' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white hover:bg-gray-50 border-gray-300 text-slate-700'}`}
        onClick={() => onChange('icr')}
      >ICR</button>
    </div>
  );
  const [machine, dispatchMachine] = useReducer(externalTrainingReducer, { status: 'idle', currentGroupIndex: 0, sessionId: 0 });
  
  // Stop training when navigating away from training panel
  const stopTrainingIfActive = () => {
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

  const firebaseRef = useRef<ReturnType<typeof initFirebase> | null>(null);
  const [firebaseReady, setFirebaseReady] = useState(false);
  const prevUserRef = useRef<User | null>(null);
  const toastTimerRef = useRef<number | undefined>(undefined);
  const settingsDebounceTimerRef = useRef<number | undefined>(undefined);
  const lastSavedSettingsRef = useRef<string | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const serializeSettings = (s: TrainingSettings): string => {
    // Stable serialization to compare changes deterministically
    const stable = {
      kochLevel: s.kochLevel,
      sideTone: s.sideTone,
      steepness: s.steepness,
      sessionDuration: s.sessionDuration,
      charsPerGroup: s.charsPerGroup,
      numGroups: s.numGroups,
      wpm: s.wpm,
      groupTimeout: s.groupTimeout,
      groupDelay: s.groupDelay,
      minGroupSize: s.minGroupSize,
      maxGroupSize: s.maxGroupSize,
      interactiveMode: s.interactiveMode,
      envelopeSmoothing: s.envelopeSmoothing ?? 0,
      autoAdjustKoch: !!s.autoAdjustKoch,
      autoAdjustThreshold: typeof s.autoAdjustThreshold === 'number' ? s.autoAdjustThreshold : 90
    };
    return JSON.stringify(stable);
  };

  useEffect(() => {
    firebaseRef.current = initFirebase();
    setFirebaseReady(!!firebaseRef.current);
    let unsubscribe: any;
    (async () => {
      if (firebaseRef.current) {
        // Ensure auth persistence so user stays logged in across reloads
        try { await setPersistence(firebaseRef.current.auth, browserLocalPersistence); } catch {}
        unsubscribe = onAuthStateChanged(firebaseRef.current.auth, (fu: any) => {
          if (fu) {
            const newUser: User & { uid: string } = { email: fu.email || '', username: fu.displayName || undefined, uid: fu.uid };
            setUser(newUser);
            setAuthInProgress(false);
            console.info('[Auth] Logged in as', newUser.email);
          } else {
            console.info('[Auth] No user logged in');
          }
        });
        const redirected = await getRedirectedUser(firebaseRef.current);
        if (redirected) {
          const newUser: User & { uid: string } = { email: redirected.email || '', username: redirected.displayName || undefined, uid: redirected.uid };
          setUser(newUser);
          setAuthInProgress(false);
          console.info('[Auth] Redirect login completed for', newUser.email);
        }
      }
    })();
    return () => { try { unsubscribe?.(); } catch {} };
  }, []);

  useEffect(() => {
    loadData();
  }, [user]);

  useEffect(() => {
    if (prevUserRef.current === null && user) {
      setToast({ message: `Signed in as ${user.email || 'user'}`, type: 'success' });
    } else if (prevUserRef.current && !user) {
      setToast({ message: 'Signed out', type: 'info' });
    }
    prevUserRef.current = user;
  }, [user]);

  useEffect(() => {
    if (toast) {
      try { window.clearTimeout(toastTimerRef.current); } catch {}
      toastTimerRef.current = window.setTimeout(() => setToast(null), 4000) as unknown as number;
    }
    return () => {
      try { window.clearTimeout(toastTimerRef.current); } catch {}
    };
  }, [toast]);

  // Load settings from Firestore if available; fallback to localStorage
  const loadSettings = async () => {
    if (firebaseRef.current && user && (user as any).uid) {
      try {
        const db = firebaseRef.current.db;
        const settingsSnap = await getDocs(collection(db, 'users', (user as any).uid, 'settings'));
        const defaultDoc = settingsSnap.docs.find((d: any) => d.id === 'default');
        if (defaultDoc && defaultDoc.exists()) {
          const data = defaultDoc.data() as Partial<TrainingSettings>;
          setSettings(prev => {
            const next = { ...prev, ...data } as TrainingSettings;
            lastSavedSettingsRef.current = serializeSettings(next);
            try { localStorage.setItem('morse_settings_local', JSON.stringify(next)); } catch {}
            return next;
          });
          return;
        }
      } catch (e) {
        console.warn('Failed to load settings from Firestore, will try local storage', e);
      }
    }
    try {
      const savedSettings = localStorage.getItem('morse_settings_local');
      if (savedSettings) {
        const s = JSON.parse(savedSettings);
        setSettings(prev => {
          const next = { ...prev, ...s } as TrainingSettings;
          lastSavedSettingsRef.current = serializeSettings(next);
          return next;
        });
      }
    } catch {}
  };

  // Removed auto-persist on every change to avoid overwriting and reduce writes

  // preview function removed for now to avoid unused code

  // Keep the currently focused group's input fully visible at the top of the scroll area
  useEffect(() => {
    const target = inputRefs.current[currentFocusedGroup];
    if (target) {
      try {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch {
        // no-op
      }
    }
  }, [currentFocusedGroup]);

  // Stop training when component unmounts or when navigating away
  useEffect(() => {
    return () => {
      if (isTraining) {
        trainingAbortRef.current = true;
        setIsTraining(false);
        dispatchMachine({ type: 'ABORT' });
      }
    };
  }, [isTraining]);

  const loadData = async () => {
    let sessionsLoadedFromCloud = false;
    if (firebaseRef.current && user && (user as any).uid) {
      try {
        const db = firebaseRef.current.db;
        const sessionsSnap = await getDocs(query(collection(db, 'users', (user as any).uid, 'sessions'), orderBy('timestamp', 'asc')));
        const loaded: SessionResult[] = [];
        sessionsSnap.forEach((d: any) => loaded.push(d.data() as SessionResult));
        setSessionResults(loaded);
        sessionsLoadedFromCloud = true;
      } catch (e) {
        console.warn('Firestore unavailable or unauthorized, falling back to local storage.', e);
      }
    }
    if (!sessionsLoadedFromCloud) {
      try {
        const key = user ? `morse_results_${user.email}` : 'morse_results_local';
        const saved = localStorage.getItem(key);
        if (saved) setSessionResults(JSON.parse(saved));
      } catch {}
    }
    await loadSettings();
  };

  const saveData = async (results: SessionResult[]) => {
    // Firestore if available and Google user
    if (firebaseRef.current && user && (user as any).uid) {
      try {
        const db = firebaseRef.current.db;
        await Promise.all(results.map(r => setDoc(doc(db, 'users', (user as any).uid, 'sessions', String(r.timestamp)), r)));
        // aggregated statistics (daily trend + per-letter)
        const daily = computeDailyStats(results as any);
        const letters = computeLetterStats(results as any);
        await Promise.all([
          setDoc(doc(db, 'users', (user as any).uid, 'stats', 'daily'), { items: daily, updatedAt: Date.now() }),
          setDoc(doc(db, 'users', (user as any).uid, 'stats', 'letters'), { items: letters, updatedAt: Date.now() }),
        ]);
        return;
      } catch (e) {
        console.warn('Failed to write to Firestore, saving locally instead.', e);
      }
    }
    const key = user ? `morse_results_${user.email}` : 'morse_results_local';
    localStorage.setItem(key, JSON.stringify(results));
    localStorage.setItem('morse_settings_local', JSON.stringify(settings));
  };

  const saveSettings = async (opts?: { source?: 'auto' | 'manual' }) => {
    // Cancel pending debounce if any (manual save should flush now)
    try { if (settingsDebounceTimerRef.current) { window.clearTimeout(settingsDebounceTimerRef.current); settingsDebounceTimerRef.current = undefined; } } catch {}
    setIsSavingSettings(true);
    try {
      try { localStorage.setItem('morse_settings_local', JSON.stringify(settings)); } catch {}
      if (firebaseRef.current && user && (user as any).uid) {
        try {
          const db = firebaseRef.current.db;
          await setDoc(doc(db, 'users', (user as any).uid, 'settings', 'default'), settings, { merge: true });
          setToast({ message: opts?.source === 'auto' ? 'Settings synced' : 'Settings saved', type: 'success' });
        } catch (e) {
          console.warn('Failed to save settings to Firestore', e);
          setToast({ message: 'Saved locally. Cloud sync failed.', type: 'error' });
        }
      } else {
        setToast({ message: opts?.source === 'auto' ? 'Settings synced locally' : 'Settings saved locally', type: 'info' });
      }
      lastSavedSettingsRef.current = serializeSettings(settings);
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Debounced auto-save of settings changes
  useEffect(() => {
    const serialized = serializeSettings(settings);
    if (serialized === lastSavedSettingsRef.current) return;
    try { if (settingsDebounceTimerRef.current) window.clearTimeout(settingsDebounceTimerRef.current); } catch {}
    settingsDebounceTimerRef.current = window.setTimeout(() => {
      void saveSettings({ source: 'auto' });
    }, 2500) as unknown as number;
    return () => {
      try { if (settingsDebounceTimerRef.current) window.clearTimeout(settingsDebounceTimerRef.current); } catch {}
    };
  }, [settings, user]);

  const handleLogin = async () => {
    if (!firebaseRef.current) return;
    try {
      console.info('[Auth] Starting Google sign-in (redirect)');
      setAuthInProgress(true);
      setToast({ message: 'Redirecting to Google…', type: 'info' });
      await googleSignIn(firebaseRef.current); // redirect flow
      // Redirect will navigate away; completion handled after return
    } catch (e) {
      console.error('[Auth] Google sign-in start failed', e);
      setAuthInProgress(false);
      setToast({ message: 'Failed to start Google sign-in.', type: 'error' });
    }
  };

  const handleGoogleLogin = async () => {
    if (!firebaseRef.current) return;
    try {
      console.info('[Auth] Google sign-in button clicked');
      setAuthInProgress(true);
      setToast({ message: 'Redirecting to Google…', type: 'info' });
      await googleSignIn(firebaseRef.current); // redirect flow
    } catch (e) {
      console.error('[Auth] Google sign-in start failed', e);
      setAuthInProgress(false);
      setToast({ message: 'Failed to start Google sign-in.', type: 'error' });
    }
  };

  const handleLogout = async () => {
    if (firebaseRef.current) {
      try { console.info('[Auth] Signing out'); await googleSignOut(firebaseRef.current); } catch (e) { console.error('[Auth] Sign out error', e); }
    }
    setUser(null);
    localStorage.removeItem('morse_user');
  };

  const generateGroup = (): string => externalGenerateGroup({ kochLevel: settings.kochLevel, minGroupSize: settings.minGroupSize, maxGroupSize: settings.maxGroupSize });

  const playMorseCode = async (text: string, sessionId: number) => {
    if (trainingAbortRef.current || sessionIdRef.current !== sessionId) return 0;
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    const ctx = audioContextRef.current;
    return await externalPlayMorseCode(
      ctx,
      text,
      { wpm: settings.wpm, sideTone: settings.sideTone, steepness: settings.steepness, envelopeSmoothing: settings.envelopeSmoothing ?? 0 },
      () => (trainingAbortRef.current || sessionIdRef.current !== sessionId)
    );
  };

  const sleepCancelable = async (ms: number, sessionId: number) => {
    const stepMs = 50;
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (trainingAbortRef.current || sessionIdRef.current !== sessionId) return;
      const remaining = end - Date.now();
      await new Promise(r => setTimeout(r, Math.min(stepMs, Math.max(0, remaining))));
    }
  };

  const startTraining = async () => {
    // Abort any previous session and start a new session id
    trainingAbortRef.current = false;
    dispatchMachine({ type: 'START' });
    const mySession = sessionIdRef.current + 1;
    sessionIdRef.current = mySession;
    setIsTraining(true);
    setCurrentGroup(0);
    setSentGroups([]);
    setUserInput([]);
    setCurrentInput('');
    setConfirmedGroups({});
    setCurrentFocusedGroup(0);
    startedAtRef.current = Date.now();
    userInputRef.current = [];
    confirmedGroupsRef.current = {};
    
    const groups: string[] = [];
    for (let i = 0; i < settings.numGroups; i++) {
      groups.push(generateGroup());
    }
    setSentGroups(groups);
    dispatchMachine({ type: 'PREPARED' });
    
    for (let i = 0; i < groups.length; i++) {
      if (trainingAbortRef.current || sessionIdRef.current !== mySession) break;
      setCurrentGroup(i);
      dispatchMachine({ type: 'GROUP_START', index: i });
      // Delay before playing the group's audio (does not affect focus/advance)
      const delayMs = Math.max(0, settings.groupDelay ?? 1000);
      if (delayMs > 0) {
        await sleepCancelable(delayMs, mySession);
      }
      const duration = await playMorseCode(groups[i], mySession);
      // Wait either for input or until timeout
      if (trainingAbortRef.current || sessionIdRef.current !== mySession) break;
      dispatchMachine({ type: 'WAIT_INPUT' });
      const deadline = Date.now() + Math.max(0, (settings.groupTimeout || 0)) * 1000;
      while (true) {
        if (trainingAbortRef.current || sessionIdRef.current !== mySession) break;
        const currentValue = (userInputRef.current[i] || '').trim().toUpperCase();
        const isConfirmed = !!confirmedGroupsRef.current[i];
        const targetLen = groups[i].length;
        if (isConfirmed || (targetLen > 0 && currentValue.length === targetLen)) break;
        if (settings.groupTimeout && Date.now() >= deadline) break;
        await sleepCancelable(100, mySession);
      }
      if (!(trainingAbortRef.current || sessionIdRef.current !== mySession)) {
        dispatchMachine({ type: 'INPUT_RECEIVED' });
      }
    }
    setIsTraining(false);
    if (!(trainingAbortRef.current || sessionIdRef.current !== mySession)) {
      dispatchMachine({ type: 'COMPLETE' });
    }
  };

  const submitAnswer = () => {
    // Stop session and process what we have
    trainingAbortRef.current = true;
    setIsTraining(false);
    const latestUserInput = (userInputRef.current?.length ? userInputRef.current : userInput) || [];
    const answers = (latestUserInput.length ? latestUserInput : currentInput.split(' ')).map(a => (a || '').trim().toUpperCase());
    processResults(answers);
  };

  const confirmGroupAnswer = (index: number, overrideValue?: string) => {
    if (!sentGroups.length) return;
    const normalized = (overrideValue ?? userInput[index] ?? '').trim().toUpperCase();
    const nextAnswers = [...userInput];
    nextAnswers[index] = normalized;
    setUserInput(nextAnswers);
    userInputRef.current = nextAnswers;
    const nextConfirmed = { ...confirmedGroupsRef.current, [index]: true };
    setConfirmedGroups(nextConfirmed);
    confirmedGroupsRef.current = nextConfirmed;

    // Focus next input
    const nextIndex = index + 1;
    if (nextIndex < sentGroups.length) {
      setCurrentFocusedGroup(nextIndex);
      // Small delay to ensure the input is rendered
      setTimeout(() => {
        inputRefs.current[nextIndex]?.focus();
      }, 100);
    }

    // If all groups answered, auto-submit
    const allAnswered = nextAnswers.length === sentGroups.length && nextAnswers.every((a, i) => (a && a.length === sentGroups[i].length));
    if (allAnswered) {
      submitAnswer();
    }
  };

  const handleAnswerChange = (index: number, value: string) => {
    const nextAnswers = [...userInput];
    nextAnswers[index] = value;
    setUserInput(nextAnswers);
    userInputRef.current = nextAnswers;
    
    // Auto-advance if current group is fully typed and matches expected length
    // Only auto-advance if we're in interactive mode or if the group has been played
    if (value.length === sentGroups[index]?.length && value.length > 0 && 
        (settings.interactiveMode || index <= currentGroup)) {
      // Small delay to allow user to see their input
      setTimeout(() => {
        confirmGroupAnswer(index, value);
      }, 300);
    }
  };

  const processResults = (answers: string[]) => {
    const groups = sentGroups.map((sent, idx) => {
      const receivedRaw = answers[idx] || '';
      const received = receivedRaw.trim().toUpperCase();
      return {
        sent,
        received,
        correct: sent === received,
      };
    });

    const letterAccuracy: Record<string, { correct: number; total: number }> = {};
    
    groups.forEach(group => {
      for (let i = 0; i < group.sent.length; i++) {
        const char = group.sent[i];
        if (!letterAccuracy[char]) {
          letterAccuracy[char] = { correct: 0, total: 0 };
        }
        letterAccuracy[char].total++;
        if (group.received[i] === char) {
          letterAccuracy[char].correct++;
        }
      }
    });

    const accuracy = groups.filter(g => g.correct).length / groups.length;
    
    const result: SessionResult = {
      date: new Date().toISOString().split('T')[0],
      timestamp: Date.now(),
      startedAt: startedAtRef.current || Date.now(),
      finishedAt: Date.now(),
      groups,
      accuracy,
      letterAccuracy
    };

    const newResults = [...sessionResults, result];
    setSessionResults(newResults);
    void saveData(newResults);

    // Auto adjust Koch level if enabled
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
          // KOCH_SEQUENCE length only known in generator; safeguard with 60 as reasonable default
          const maxLevelGuess = 60;
          const nextLevel = Math.max(1, Math.min((settings.kochLevel || 1) + delta, maxLevelGuess));
          if (nextLevel !== settings.kochLevel) {
            setSettings(prev => ({ ...prev, kochLevel: nextLevel }));
            setToast({ message: `Koch level ${delta > 0 ? 'increased' : 'decreased'} to ${nextLevel} (accuracy ${Math.round(accuracyPct)}%, threshold ${threshold}%)`, type: delta > 0 ? 'success' : 'info' });
          }
        }
      }
    } catch {}
    
    // Always go to stats after session completion
    setShowStats(true);
  };

  const getDailyStats = () => computeDailyStats(sessionResults);

  const deleteSession = async (timestamp: number) => {
    const filtered = sessionResults.filter(r => r.timestamp !== timestamp);
    setSessionResults(filtered);
    if (firebaseRef.current && user && (user as any).uid) {
      try {
        await deleteDoc(doc(firebaseRef.current.db, 'users', (user as any).uid, 'sessions', String(timestamp)));
      } catch (e) {
        console.warn('Failed to delete from Firestore, will update local cache only.', e);
      }
    }
    void saveData(filtered);
  };

  const getLetterStats = () => computeLetterStats(sessionResults);

  if (showStats) {
    // Stop training when viewing stats
    if (isTraining) {
      stopTrainingIfActive();
    }
    return (
      <StatsView
        sessionResults={sessionResults as unknown as StatsSessionResult[]}
        onBack={() => setShowStats(false)}
        onDelete={deleteSession}
        thresholdPercent={Math.max(0, Math.min(100, settings.autoAdjustThreshold ?? 90))}
      />
    );
  }

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
        user={user}
        firebaseReady={firebaseReady}
        onGoogleLogin={handleLogin}
        onLogout={handleLogout}
        onSwitchAccount={async () => {
          // Force account chooser by signing out then starting login again (redirect)
          await handleLogout();
          await handleLogin();
        }}
        settings={settings}
        setSettings={setSettings}
        onSaveSettings={() => { void saveSettings({ source: 'manual' }); }}
        isSavingSettings={isSavingSettings}
        sessionResultsCount={sessionResults.length}
        latestAccuracyPercent={Math.round((sessionResults[sessionResults.length - 1]?.accuracy || 0) * 100)}
        onViewStats={() => { stopTrainingIfActive(); setSidebarOpen(false); setShowStats(true); }}
        icrSettings={icrSettings}
        setIcrSettings={setIcrSettings as any}
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
            <svg className="w-6 h-6 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>


        {/* Mode switcher UI: Group vs ICR within same page (tab + swipe) */}
        <ModeTabs activeMode={activeMode} onChange={setActiveMode} />

        {!isTraining && activeMode === 'group' ? (
          <div className="space-y-8">
            {/* Quick Stats */}
            {sessionResults.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-white border border-emerald-100">
                  <p className="text-xs uppercase tracking-wide text-emerald-700 font-semibold">Last Accuracy</p>
                  <p className="text-3xl font-extrabold text-emerald-800 mt-1">{Math.round(sessionResults[sessionResults.length-1].accuracy * 100)}%</p>
                  <p className="text-xs text-emerald-700/70 mt-1">from your last session</p>
                </div>
                <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50 to-white border border-blue-100">
                  <p className="text-xs uppercase tracking-wide text-blue-700 font-semibold">Sessions</p>
                  <p className="text-3xl font-extrabold text-blue-800 mt-1">{sessionResults.length}</p>
                  <p className="text-xs text-blue-700/70 mt-1">total completed</p>
                </div>
                <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-50 to-white border border-purple-100">
                  <p className="text-xs uppercase tracking-wide text-purple-700 font-semibold">Koch Level</p>
                  <p className="text-3xl font-extrabold text-purple-800 mt-1">{settings.kochLevel}</p>
                  <p className="text-xs text-purple-700/70 mt-1">active characters</p>
                </div>
              </div>
            )}

            {/* Activity Heatmap (last 3 months, navigable) */}
            <ActivityHeatmap
              sessions={sessionResults.map(s => ({ date: s.date, timestamp: s.timestamp }))}
              monthsPerPage={3}
              startOfWeek={1}
            />

            {/* Mini Trend */}
            {sessionResults.length > 1 && (
              <div className="rounded-2xl p-4 border border-slate-200 bg-white/70">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Accuracy Trend</h3>
                <div className="w-full h-[140px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={sessionResults.map((s) => ({ x: new Date(s.timestamp).toLocaleDateString(), y: Math.round(s.accuracy*100) }))}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="x"
                        tick={{ fontSize: 10, fill: '#475569' }}
                        label={{ value: 'Date', position: 'insideBottomRight', offset: -2, fill: '#475569', fontSize: 10 }}
                      />
                      <YAxis
                        domain={[0,100]}
                        tick={{ fontSize: 10, fill: '#475569' }}
                        label={{ value: 'Accuracy (%)', angle: -90, position: 'insideLeft', offset: 10, fill: '#475569', fontSize: 10 }}
                      />
                      <ReferenceLine y={Math.max(0, Math.min(100, settings.autoAdjustThreshold ?? 90))} stroke="#ef4444" strokeDasharray="4 4" />
                      <Tooltip formatter={(v: any) => [`${v}%`, 'Accuracy']} />
                      <Line type="monotone" dataKey="y" stroke="#6366f1" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
            {/* Settings moved into Sidebar collapsible section */}

            <div className="flex justify-center">
              <button
                onClick={startTraining}
                className="px-12 py-4 bg-gradient-to-r from-emerald-500 to-green-600 text-white text-xl font-bold rounded-xl hover:from-emerald-600 hover:to-green-700 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                🚀 Start Training
              </button>
            </div>
          </div>
        ) : isTraining && activeMode === 'group' ? (
          <div className="space-y-6">
            <ProgressHeader currentGroup={currentGroup} totalGroups={settings.numGroups} />

            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
                <label className="block text-sm font-medium text-gray-700">
                  Enter answers per group (auto-advances when complete):
                </label>
                
                {/* Group Navigation for Mobile */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-sm text-gray-600 whitespace-nowrap">Jump to:</span>
                  <select
                    value={currentFocusedGroup}
                    onChange={(e) => {
                      const groupIndex = parseInt(e.target.value);
                      setCurrentFocusedGroup(groupIndex);
                      inputRefs.current[groupIndex]?.focus();
                    }}
                    className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0"
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
                onChange={handleAnswerChange}
                onConfirm={confirmGroupAnswer}
                onFocus={(idx) => setCurrentFocusedGroup(idx)}
                inputRef={(idx, el) => { inputRefs.current[idx] = el; }}
              />
              <p className="text-xs text-slate-500 mt-2">
                💡 Auto-advances when group is complete • Use Enter to confirm • Scroll to review past groups
              </p>
            </div>

            <TrainingControls onSubmit={submitAnswer} onStop={() => { trainingAbortRef.current = true; setIsTraining(false); }} />
          </div>
        ) : activeMode === 'icr' ? (
          <SwipeContainer activeMode={activeMode} onSwipe={setActiveMode}>
            <ICRTrainer sharedAudio={{
              kochLevel: settings.kochLevel,
              wpm: settings.wpm,
              sideTone: settings.sideTone,
              steepness: settings.steepness,
              envelopeSmoothing: settings.envelopeSmoothing,
            }} icrSettings={icrSettings} setIcrSettings={setIcrSettings} />
          </SwipeContainer>
        ) : null}
      </div>
    </div>
  );
};

export default CWTrainer;
