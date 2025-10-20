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
      const char = text[i].toUpperCase();
      const morse = MORSE_CODE[char];
      
      if (!morse) continue;

      for (let j = 0; j < morse.length; j++) {
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

  const confirmGroupAnswer = (index: number) => {
    if (!sentGroups.length) return;
    const normalized = (userInput[index] || '').toUpperCase();
    const nextAnswers = [...userInput];
    nextAnswers[index] = normalized;
    setUserInput(nextAnswers);
    setConfirmedGroups(prev => ({ ...prev, [index]: true }));

    // Focus next input
    const nextIndex = index + 1;
    if (nextIndex < sentGroups.length) {
      inputRefs.current[nextIndex]?.focus();
    }

    // If all groups answered, auto-submit
    const allAnswered = nextAnswers.length === sentGroups.length && nextAnswers.every(a => a && a.length > 0);
    if (allAnswered) {
      submitAnswer();
    }
  };

  const handleAnswerChange = (index: number, value: string) => {
    const nextAnswers = [...userInput];
    nextAnswers[index] = value;
    setUserInput(nextAnswers);
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
    return (
      <StatsView
        sessionResults={sessionResults as unknown as StatsSessionResult[]}
        onBack={() => setShowStats(false)}
        onDelete={deleteSession}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-4 sm:p-6">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl ring-1 ring-black/5 p-4 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
          <h1 className="text-2xl sm:text-4xl font-bold text-slate-800">Morse Code Trainer</h1>
          <div className="w-full sm:w-auto">
            {user ? (
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600">
                  {user.username || user.email}
                </span>
                <button
                  onClick={handleLogout}
                  className="px-3 py-1 bg-rose-500 text-white rounded-lg text-sm hover:bg-rose-600"
                >
                  Logout
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAuth(!showAuth)}
                className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Login
              </button>
            )}
          </div>
        </div>

        {showAuth && !user && (
          <div className="mb-8 p-4 border border-gray-300 rounded-lg bg-gray-50">
            <h3 className="text-lg font-semibold mb-4">Sign In</h3>
            {firebaseReady && (
              <button
                onClick={handleLogin}
                className="w-full px-4 py-2 mb-3 bg-white border border-gray-300 rounded hover:bg-gray-50"
              >
                Continue with Google
              </button>
            )}
            <input
              type="email"
              placeholder="Email (required)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded mb-3"
            />
            <input
              type="text"
              placeholder="Username (optional)"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded mb-3"
            />
            <button
              onClick={handleLogin}
              className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              Sign In
            </button>
          </div>
        )}

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

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={startTraining}
                className="flex-1 px-6 py-3 bg-emerald-500 text-white text-lg font-semibold rounded-lg hover:bg-emerald-600"
              >
                Start Training
              </button>
              
              {sessionResults.length > 0 && (
                <button
                  onClick={() => setShowStats(true)}
                  className="flex-1 px-6 py-3 bg-purple-600 text-white text-lg font-semibold rounded-lg hover:bg-purple-700"
                >
                  View Statistics
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="text-center">
              <p className="text-2xl font-semibold mb-2">
                Playing Group {currentGroup + 1} of {settings.numGroups}
              </p>
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div
                  className="bg-blue-500 h-4 rounded-full transition-all duration-300"
                  style={{ width: `${((currentGroup + 1) / settings.numGroups) * 100}%` }}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Enter answers per group (press Enter to confirm each):
              </label>
              <div className="max-h-[420px] overflow-y-auto pr-2">
                <div className="grid grid-cols-1 gap-3">
                  {sentGroups.map((group, idx) => (
                    <GroupItem
                      key={idx}
                      index={idx}
                      groupText={group}
                      value={userInput[idx] || ''}
                      confirmed={!!confirmedGroups[idx]}
                      onChange={(v) => handleAnswerChange(idx, v)}
                      onConfirm={() => confirmGroupAnswer(idx)}
                      inputRef={(el) => { inputRefs.current[idx] = el; }}
                    />
                  ))}
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-2">Tip: Use Enter to confirm and auto-advance. You can scroll to review past groups. Only confirmed groups reveal the correct text.</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={submitAnswer}
                className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white text-lg font-semibold rounded-lg hover:bg-blue-700"
              >
                Submit Results
              </button>
              <button
                onClick={() => { trainingAbortRef.current = true; setIsTraining(false); }}
                className="w-full sm:w-auto px-6 py-3 bg-slate-200 text-slate-800 text-lg font-semibold rounded-lg hover:bg-slate-300"
              >
                Stop Session
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CWTrainer;
