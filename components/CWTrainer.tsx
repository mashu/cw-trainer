import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import GroupItem from './GroupItem';
import StatsView, { SessionResult as StatsSessionResult } from './StatsView';
import { initFirebase, googleSignIn, googleSignOut } from '@/lib/firebaseClient';
import { collection, doc, getDocs, orderBy, query, setDoc, deleteDoc } from 'firebase/firestore';

// Koch Method Sequence
const KOCH_SEQUENCE = ['K', 'M', 'R', 'S', 'U', 'A', 'P', 'T', 'L', 'O', 'W', 'I', 
                        'N', 'J', 'E', 'F', '0', 'Y', 'V', 'G', '5', 'Q', '9', 
                        'Z', 'H', '3', '8', 'B', '?', '4', '2', '7', 'C', '1', 
                        '6', 'D', 'X', '/', '=', '+'];

// Morse Code Map
const MORSE_CODE: Record<string, string> = {
  'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.', 'F': '..-.',
  'G': '--.', 'H': '....', 'I': '..', 'J': '.---', 'K': '-.-', 'L': '.-..',
  'M': '--', 'N': '-.', 'O': '---', 'P': '.--.', 'Q': '--.-', 'R': '.-.',
  'S': '...', 'T': '-', 'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-',
  'Y': '-.--', 'Z': '--..', '0': '-----', '1': '.----', '2': '..---',
  '3': '...--', '4': '....-', '5': '.....', '6': '-....', '7': '--...',
  '8': '---..', '9': '----.', '/': '-..-.', '=': '-...-', '+': '.-.-.',
  '?': '..--..'
};

interface TrainingSettings {
  kochLevel: number;
  sideTone: number;
  steepness: number;
  sessionDuration: number;
  charsPerGroup: number;
  numGroups: number;
  wpm: number;
  groupSpacing: number;
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

interface User {
  email: string;
  username?: string;
}

const CWTrainer: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [showAuth, setShowAuth] = useState(false);
  
  const [settings, setSettings] = useState<TrainingSettings>({
    kochLevel: 2,
    sideTone: 600,
    steepness: 5,
    sessionDuration: 5,
    charsPerGroup: 5,
    numGroups: 20,
    wpm: 20,
    groupSpacing: 2,
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
  
  // Stop training when navigating away from training panel
  const stopTrainingIfActive = () => {
    if (isTraining) {
      trainingAbortRef.current = true;
      setIsTraining(false);
    }
  };
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const trainingAbortRef = useRef<boolean>(false);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const startedAtRef = useRef<number | null>(null);

  const firebaseRef = useRef<ReturnType<typeof initFirebase> | null>(null);
  const [firebaseReady, setFirebaseReady] = useState(false);

  useEffect(() => {
    firebaseRef.current = initFirebase();
    setFirebaseReady(!!firebaseRef.current);
    loadData();
  }, [user]);

  // Stop training when component unmounts or when navigating away
  useEffect(() => {
    return () => {
      if (isTraining) {
        trainingAbortRef.current = true;
        setIsTraining(false);
      }
    };
  }, [isTraining]);

  const loadData = async () => {
    // Firestore if available and user has Google auth
    if (firebaseRef.current && user && (user as any).uid) {
      const db = firebaseRef.current.db;
      const sessionsSnap = await getDocs(query(collection(db, 'users', (user as any).uid, 'sessions'), orderBy('timestamp', 'asc')));
      const loaded: SessionResult[] = [];
      sessionsSnap.forEach((d: any) => loaded.push(d.data() as SessionResult));
      setSessionResults(loaded);
      return;
    }

    // Fallback to local storage
    const key = user ? `morse_results_${user.email}` : 'morse_results_local';
    const saved = localStorage.getItem(key);
    if (saved) setSessionResults(JSON.parse(saved));
    if (!user) {
      const savedSettings = localStorage.getItem('morse_settings_local');
      if (savedSettings) setSettings(JSON.parse(savedSettings));
    }
  };

  const saveData = async (results: SessionResult[]) => {
    // Firestore if available and Google user
    if (firebaseRef.current && user && (user as any).uid) {
      const db = firebaseRef.current.db;
      await Promise.all(results.map(r => setDoc(doc(db, 'users', (user as any).uid, 'sessions', String(r.timestamp)), r)));
      // settings
      await setDoc(doc(db, 'users', (user as any).uid, 'settings', 'default'), settings);
    } else {
      const key = user ? `morse_results_${user.email}` : 'morse_results_local';
      localStorage.setItem(key, JSON.stringify(results));
      if (!user) localStorage.setItem('morse_settings_local', JSON.stringify(settings));
    }
  };

  const handleLogin = async () => {
    // Prefer Google if Firebase available
    if (firebaseRef.current) {
      try {
        const fu = await googleSignIn(firebaseRef.current);
        const newUser: User & { uid: string } = { email: fu.email || '', username: fu.displayName || undefined, uid: fu.uid };
        setUser(newUser);
        setShowAuth(false);
        await loadData();
        return;
      } catch {
        // fall back to manual email
      }
    }
    if (email) {
      const newUser: User = { email, username: username || undefined };
      setUser(newUser);
      localStorage.setItem('morse_user', JSON.stringify(newUser));
      setShowAuth(false);
    }
  };

  const handleLogout = async () => {
    if (firebaseRef.current) {
      try { await googleSignOut(firebaseRef.current); } catch {}
    }
    setUser(null);
    localStorage.removeItem('morse_user');
  };

  const generateGroup = (): string => {
    const availableChars = KOCH_SEQUENCE.slice(0, settings.kochLevel);
    const groupSize = Math.floor(Math.random() * 
      (settings.maxGroupSize - settings.minGroupSize + 1)) + settings.minGroupSize;
    
    let group = '';
    for (let i = 0; i < groupSize; i++) {
      group += availableChars[Math.floor(Math.random() * availableChars.length)];
    }
    return group;
  };

  const playMorseCode = async (text: string) => {
    // Only play sound if training is still active
    if (trainingAbortRef.current) {
      return 0;
    }
    
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    
    const ctx = audioContextRef.current;
    const dotDuration = 1.2 / settings.wpm;
    const dashDuration = dotDuration * 3;
    const symbolSpace = dotDuration;
    const charSpace = dotDuration * 3;
    const riseTime = settings.steepness / 1000;
    
    let currentTime = ctx.currentTime;

    for (let i = 0; i < text.length; i++) {
      // Check if training was stopped during playback
      if (trainingAbortRef.current) {
        return 0;
      }
      
      const char = text[i].toUpperCase();
      const morse = MORSE_CODE[char];
      
      if (!morse) continue;

      for (let j = 0; j < morse.length; j++) {
        // Check if training was stopped during symbol playback
        if (trainingAbortRef.current) {
          return 0;
        }
        
        const symbol = morse[j];
        const duration = symbol === '.' ? dotDuration : dashDuration;
        
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.value = settings.sideTone;
        
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        gainNode.gain.setValueAtTime(0, currentTime);
        gainNode.gain.linearRampToValueAtTime(0.3, currentTime + riseTime);
        gainNode.gain.setValueAtTime(0.3, currentTime + duration - riseTime);
        gainNode.gain.linearRampToValueAtTime(0, currentTime + duration);
        
        oscillator.start(currentTime);
        oscillator.stop(currentTime + duration);
        
        currentTime += duration + symbolSpace;
      }
      
      currentTime += charSpace - symbolSpace;
    }
    
    return currentTime - ctx.currentTime;
  };

  const startTraining = async () => {
    trainingAbortRef.current = false;
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
    
    for (let i = 0; i < groups.length; i++) {
      if (trainingAbortRef.current) break;
      setCurrentGroup(i);
      const duration = await playMorseCode(groups[i]);
      await new Promise(resolve => setTimeout(resolve, (duration + settings.groupSpacing) * 1000));
      if (trainingAbortRef.current) break;
      if (settings.interactiveMode) {
        await new Promise(resolve => {
          const checkInput = setInterval(() => {
            if (trainingAbortRef.current) {
              clearInterval(checkInput);
              resolve(null);
              return;
            }
            if ((userInput[i] && userInput[i].length > 0)) {
              clearInterval(checkInput);
              resolve(null);
            }
          }, 100);
        });
      }
    }
    setIsTraining(false);
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

  const getDailyStats = () => {
    const dailyData: Record<string, number[]> = {};
    
    sessionResults.forEach(result => {
      if (!dailyData[result.date]) {
        dailyData[result.date] = [];
      }
      dailyData[result.date].push(result.accuracy * 100);
    });

    return Object.keys(dailyData).sort().map(date => ({
      date,
      average: dailyData[date].reduce((a, b) => a + b, 0) / dailyData[date].length,
      sessions: dailyData[date]
    }));
  };

  const deleteSession = async (timestamp: number) => {
    const filtered = sessionResults.filter(r => r.timestamp !== timestamp);
    setSessionResults(filtered);
    if (firebaseRef.current && user && (user as any).uid) {
      await deleteDoc(doc(firebaseRef.current.db, 'users', (user as any).uid, 'sessions', String(timestamp)));
    }
    void saveData(filtered);
  };

  const getLetterStats = () => {
    const letterStats: Record<string, { correct: number; total: number }> = {};
    
    sessionResults.forEach(result => {
      Object.keys(result.letterAccuracy).forEach(letter => {
        if (!letterStats[letter]) {
          letterStats[letter] = { correct: 0, total: 0 };
        }
        letterStats[letter].correct += result.letterAccuracy[letter].correct;
        letterStats[letter].total += result.letterAccuracy[letter].total;
      });
    });

    return Object.keys(letterStats).map(letter => ({
      letter,
      accuracy: (letterStats[letter].correct / letterStats[letter].total) * 100,
      total: letterStats[letter].total
    })).sort((a, b) => a.accuracy - b.accuracy);
  };

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
      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <div className={`fixed top-0 right-0 h-full w-80 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out z-50 ${
        sidebarOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-800">Settings & Account</h2>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* User Info */}
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
              <button
                onClick={handleLogout}
                className="w-full px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                Logout
              </button>
            </div>
          ) : (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-4 text-slate-800">Sign In</h3>
              {firebaseReady && (
                <button
                  onClick={handleLogin}
                  className="w-full px-4 py-3 mb-3 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </button>
              )}
              <div className="space-y-3">
                <input
                  type="email"
                  placeholder="Email (required)"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Username (optional)"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleLogin}
                  className="w-full px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all"
                >
                  Sign In
                </button>
              </div>
            </div>
          )}
          
          {/* Session Stats */}
          {sessionResults.length > 0 && (
            <div className="p-4 bg-slate-50 rounded-xl">
              <h4 className="font-semibold text-slate-800 mb-2">Quick Stats</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Total Sessions:</span>
                  <span className="font-medium">{sessionResults.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Latest Accuracy:</span>
                  <span className="font-medium">{Math.round(sessionResults[sessionResults.length - 1]?.accuracy * 100)}%</span>
                </div>
                <button
                  onClick={() => {
                    stopTrainingIfActive();
                    setSidebarOpen(false);
                    setShowStats(true);
                  }}
                  className="w-full mt-3 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
                >
                  View Full Statistics
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="max-w-4xl mx-auto bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl ring-1 ring-black/5 p-3 sm:p-6 lg:p-8 border border-white/20">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl sm:text-5xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Morse Code Trainer
            </h1>
            <p className="text-slate-600 mt-2">Master the art of Morse code communication</p>
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
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Koch Level (1-{KOCH_SEQUENCE.length})
                </label>
                <input
                  type="number"
                  min="1"
                  max={KOCH_SEQUENCE.length}
                  value={settings.kochLevel}
                  onChange={(e) => setSettings({...settings, kochLevel: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Characters: {KOCH_SEQUENCE.slice(0, settings.kochLevel).join(' ')}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Side Tone (Hz)
                </label>
                <input
                  type="number"
                  value={settings.sideTone}
                  onChange={(e) => setSettings({...settings, sideTone: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Steepness (ms)
                </label>
                <input
                  type="number"
                  value={settings.steepness}
                  onChange={(e) => setSettings({...settings, steepness: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Speed (WPM)
                </label>
                <input
                  type="number"
                  value={settings.wpm}
                  onChange={(e) => setSettings({...settings, wpm: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Number of Groups
                </label>
                <input
                  type="number"
                  value={settings.numGroups}
                  onChange={(e) => setSettings({...settings, numGroups: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Group Spacing (seconds)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={settings.groupSpacing}
                  onChange={(e) => setSettings({...settings, groupSpacing: parseFloat(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Min Group Size
                </label>
                <input
                  type="number"
                  value={settings.minGroupSize}
                  onChange={(e) => setSettings({...settings, minGroupSize: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Group Size
                </label>
                <input
                  type="number"
                  value={settings.maxGroupSize}
                  onChange={(e) => setSettings({...settings, maxGroupSize: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.interactiveMode}
                onChange={(e) => setSettings({...settings, interactiveMode: e.target.checked})}
                className="w-4 h-4"
              />
              <label className="text-sm font-medium text-gray-700">
                Interactive Mode (submit after each group)
              </label>
            </div>

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
            <div className="text-center bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100">
              <p className="text-2xl font-bold text-slate-800 mb-4">
                Playing Group {currentGroup + 1} of {settings.numGroups}
              </p>
              <div className="w-full bg-slate-200 rounded-full h-6 shadow-inner">
                <div
                  className="bg-gradient-to-r from-blue-500 to-indigo-500 h-6 rounded-full transition-all duration-500 shadow-lg"
                  style={{ width: `${((currentGroup + 1) / settings.numGroups) * 100}%` }}
                />
              </div>
              <p className="text-sm text-slate-600 mt-3">
                {Math.round(((currentGroup + 1) / settings.numGroups) * 100)}% Complete
              </p>
            </div>

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
              
              <div className="max-h-[50vh] sm:max-h-[60vh] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                <div className="space-y-2 sm:space-y-3 px-1 py-1">
                  {sentGroups.map((group, idx) => (
                    <GroupItem
                      key={idx}
                      index={idx}
                      groupText={group}
                      value={userInput[idx] || ''}
                      confirmed={!!confirmedGroups[idx]}
                      isFocused={currentFocusedGroup === idx}
                      onChange={(v) => handleAnswerChange(idx, v)}
                      onConfirm={() => confirmGroupAnswer(idx)}
                      onFocus={() => setCurrentFocusedGroup(idx)}
                      inputRef={(el) => { inputRefs.current[idx] = el; }}
                    />
                  ))}
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                💡 Auto-advances when group is complete • Use Enter to confirm • Scroll to review past groups
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={submitAnswer}
                className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-lg font-bold rounded-xl hover:from-blue-700 hover:to-indigo-700 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                ✅ Submit Results
              </button>
              <button
                onClick={() => { trainingAbortRef.current = true; setIsTraining(false); }}
                className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-slate-200 to-slate-300 text-slate-800 text-lg font-bold rounded-xl hover:from-slate-300 hover:to-slate-400 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                ⏹️ Stop Session
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CWTrainer;
