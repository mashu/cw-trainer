import React, { useState, useEffect, useRef, useReducer } from 'react';
import ProgressHeader from './ProgressHeader';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
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
  groupTimeout: number; // seconds to wait before auto-advancing
  minGroupSize: number;
  maxGroupSize: number;
  interactiveMode: boolean;
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
    minGroupSize: 2,
    maxGroupSize: 3,
    interactiveMode: false
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

  const firebaseRef = useRef<ReturnType<typeof initFirebase> | null>(null);
  const [firebaseReady, setFirebaseReady] = useState(false);
  const prevUserRef = useRef<User | null>(null);
  const toastTimerRef = useRef<number | undefined>(undefined);

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

  // Persist settings on change (both local and Firestore if available)
  useEffect(() => {
    // Avoid persisting on first render if defaults equal
    const persist = async () => {
      try {
        if (firebaseRef.current && user && (user as any).uid) {
          const db = firebaseRef.current.db;
          await setDoc(doc(db, 'users', (user as any).uid, 'settings', 'default'), settings);
        }
      } catch {}
      try {
        localStorage.setItem('morse_settings_local', JSON.stringify(settings));
      } catch {}
    };
    void persist();
  }, [settings, user]);

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
    // Firestore if available and user has Google auth
    if (firebaseRef.current && user && (user as any).uid) {
      try {
        const db = firebaseRef.current.db;
        // Try to load settings snapshot via sessions collection (store latest settings alongside session if needed)
        // Fallback relies on local storage below
        const sessionsSnap = await getDocs(query(collection(db, 'users', (user as any).uid, 'sessions'), orderBy('timestamp', 'asc')));
        const loaded: SessionResult[] = [];
        sessionsSnap.forEach((d: any) => loaded.push(d.data() as SessionResult));
        setSessionResults(loaded);
        return;
      } catch (e) {
        console.warn('Firestore unavailable or unauthorized, falling back to local storage.', e);
      }
    }

    // Fallback to local storage
    const key = user ? `morse_results_${user.email}` : 'morse_results_local';
    const saved = localStorage.getItem(key);
    if (saved) setSessionResults(JSON.parse(saved));
    if (!user) {
      const savedSettings = localStorage.getItem('morse_settings_local');
      if (savedSettings) {
        const s = JSON.parse(savedSettings);
        setSettings(prev => ({ ...prev, ...s }));
      }
    }
  };

  const saveData = async (results: SessionResult[]) => {
    // Firestore if available and Google user
    if (firebaseRef.current && user && (user as any).uid) {
      try {
        const db = firebaseRef.current.db;
        await Promise.all(results.map(r => setDoc(doc(db, 'users', (user as any).uid, 'sessions', String(r.timestamp)), r)));
        // settings
        await setDoc(doc(db, 'users', (user as any).uid, 'settings', 'default'), settings);
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
      { wpm: settings.wpm, sideTone: settings.sideTone, steepness: settings.steepness },
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
      const duration = await playMorseCode(groups[i], mySession);
      // Wait either for input or until timeout
      if (trainingAbortRef.current || sessionIdRef.current !== mySession) break;
      dispatchMachine({ type: 'WAIT_INPUT' });
      const deadline = Date.now() + Math.max(0, (settings.groupTimeout || 0)) * 1000;
      while (true) {
        if (trainingAbortRef.current || sessionIdRef.current !== mySession) break;
        const answer = (userInput[i] || '').trim();
        if (answer.length > 0) break;
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
    const answers = (userInput.length ? userInput : currentInput.split(' ')).map(a => (a || '').toUpperCase());
    processResults(answers);
  };

  const confirmGroupAnswer = (index: number, overrideValue?: string) => {
    if (!sentGroups.length) return;
    const normalized = (overrideValue ?? userInput[index] ?? '').toUpperCase();
    const nextAnswers = [...userInput];
    nextAnswers[index] = normalized;
    setUserInput(nextAnswers);
    setConfirmedGroups(prev => ({ ...prev, [index]: true }));

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
    const groups = sentGroups.map((sent, idx) => ({
      sent,
      received: answers[idx] || '',
      correct: sent === (answers[idx] || '')
    }));

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
        sessionResultsCount={sessionResults.length}
        latestAccuracyPercent={Math.round((sessionResults[sessionResults.length - 1]?.accuracy || 0) * 100)}
        onViewStats={() => { stopTrainingIfActive(); setSidebarOpen(false); setShowStats(true); }}
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


        {!isTraining ? (
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
        ) : (
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
        )}
      </div>
    </div>
  );
};

export default CWTrainer;
