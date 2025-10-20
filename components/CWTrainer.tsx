import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';

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
    minGroupSize: 3,
    maxGroupSize: 7,
    interactiveMode: false
  });

  const [isTraining, setIsTraining] = useState(false);
  const [currentGroup, setCurrentGroup] = useState(0);
  const [sentGroups, setSentGroups] = useState<string[]>([]);
  const [userInput, setUserInput] = useState<string[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [sessionResults, setSessionResults] = useState<SessionResult[]>([]);
  const [showStats, setShowStats] = useState(false);
  const [showDetailedStats, setShowDetailedStats] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = () => {
    const key = user ? `morse_results_${user.email}` : 'morse_results_local';
    const saved = localStorage.getItem(key);
    if (saved) {
      setSessionResults(JSON.parse(saved));
    }
    
    if (!user) {
      const savedSettings = localStorage.getItem('morse_settings_local');
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
    }
  };

  const saveData = (results: SessionResult[]) => {
    const key = user ? `morse_results_${user.email}` : 'morse_results_local';
    localStorage.setItem(key, JSON.stringify(results));
    
    if (!user) {
      localStorage.setItem('morse_settings_local', JSON.stringify(settings));
    }
  };

  const handleLogin = () => {
    if (email) {
      const newUser: User = { email, username: username || undefined };
      setUser(newUser);
      localStorage.setItem('morse_user', JSON.stringify(newUser));
      setShowAuth(false);
    }
  };

  const handleLogout = () => {
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
    setIsTraining(true);
    setCurrentGroup(0);
    setSentGroups([]);
    setUserInput([]);
    setCurrentInput('');
    
    const groups: string[] = [];
    for (let i = 0; i < settings.numGroups; i++) {
      groups.push(generateGroup());
    }
    setSentGroups(groups);
    
    for (let i = 0; i < groups.length; i++) {
      setCurrentGroup(i);
      const duration = await playMorseCode(groups[i]);
      await new Promise(resolve => setTimeout(resolve, (duration + settings.groupSpacing) * 1000));
      
      if (settings.interactiveMode) {
        await new Promise(resolve => {
          const checkInput = setInterval(() => {
            if (userInput.length > i) {
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
    if (settings.interactiveMode) {
      setUserInput([...userInput, currentInput.toUpperCase()]);
      setCurrentInput('');
    } else {
      const answers = currentInput.split(' ').map(a => a.toUpperCase());
      setUserInput(answers);
      processResults(answers);
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
      groups,
      accuracy,
      letterAccuracy
    };

    const newResults = [...sessionResults, result];
    setSessionResults(newResults);
    saveData(newResults);
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
    const dailyStats = getDailyStats();
    const letterStats = getLetterStats();
    
    const chartData = dailyStats.flatMap(day => 
      day.sessions.map((acc, idx) => ({
        date: `${day.date}-${idx}`,
        accuracy: acc,
        average: day.average
      }))
    );

    return (
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-lg p-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold text-gray-800">Training Statistics</h2>
            <button
              onClick={() => {
                setShowStats(false);
                setShowDetailedStats(false);
              }}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Back to Training
            </button>
          </div>

          <div className="mb-8">
            <h3 className="text-xl font-semibold mb-4">Accuracy Over Time</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="accuracy" stroke="#3b82f6" strokeWidth={0} dot={{ r: 4 }} name="Session" />
                <Line type="monotone" dataKey="average" stroke="#ef4444" strokeWidth={2} dot={false} name="Average" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="mb-4">
            <button
              onClick={() => setShowDetailedStats(!showDetailedStats)}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              {showDetailedStats ? 'Hide' : 'Show'} Per-Letter Statistics
            </button>
          </div>

          {showDetailedStats && (
            <div>
              <h3 className="text-xl font-semibold mb-4">Letter Accuracy</h3>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={letterStats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="letter" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Bar dataKey="accuracy" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800">Morse Code Trainer</h1>
          <div>
            {user ? (
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600">
                  {user.username || user.email}
                </span>
                <button
                  onClick={handleLogout}
                  className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                >
                  Logout
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAuth(!showAuth)}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Login
              </button>
            )}
          </div>
        </div>

        {showAuth && !user && (
          <div className="mb-8 p-4 border border-gray-300 rounded-lg bg-gray-50">
            <h3 className="text-lg font-semibold mb-4">Sign In</h3>
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
            <div className="grid grid-cols-2 gap-4">
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

            <div className="flex gap-4">
              <button
                onClick={startTraining}
                className="flex-1 px-6 py-3 bg-green-500 text-white text-lg font-semibold rounded hover:bg-green-600"
              >
                Start Training
              </button>
              
              {sessionResults.length > 0 && (
                <button
                  onClick={() => setShowStats(true)}
                  className="flex-1 px-6 py-3 bg-purple-500 text-white text-lg font-semibold rounded hover:bg-purple-600"
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {settings.interactiveMode ? 'Current Group Answer:' : 'All Answers (space-separated):'}
              </label>
              <input
                type="text"
                value={currentInput}
                onChange={(e) => setCurrentInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    submitAnswer();
                  }
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded text-lg"
                placeholder={settings.interactiveMode ? "Type answer..." : "Type all answers separated by spaces..."}
              />
            </div>

            {settings.interactiveMode && (
              <button
                onClick={submitAnswer}
                disabled={!currentInput}
                className="w-full px-6 py-3 bg-blue-500 text-white text-lg font-semibold rounded hover:bg-blue-600 disabled:bg-gray-300"
              >
                Submit Answer
              </button>
            )}

            {!settings.interactiveMode && currentGroup === settings.numGroups && (
              <button
                onClick={submitAnswer}
                className="w-full px-6 py-3 bg-green-500 text-white text-lg font-semibold rounded hover:bg-green-600"
              >
                Submit All Answers
              </button>
            )}

            {userInput.length > 0 && (
              <div className="mt-4 p-4 bg-gray-50 rounded">
                <p className="font-semibold mb-2">Submitted Answers:</p>
                <div className="space-y-1">
                  {userInput.map((answer, idx) => (
                    <p key={idx} className="text-sm">
                      Group {idx + 1}: {answer}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CWTrainer;
