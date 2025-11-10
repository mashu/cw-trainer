export interface SessionResultLite {
  date: string;
  timestamp: number;
  accuracy: number; // 0..1
  letterAccuracy: Record<string, { correct: number; total: number }>;
}

export function getDailyStats(sessionResults: SessionResultLite[]) {
  const dailyData: Record<string, number[]> = {};
  sessionResults.forEach(result => {
    const date = result.date;
    if (!date) return;
    if (!dailyData[date]) dailyData[date] = [];
    const arr = dailyData[date];
    if (arr) {
      arr.push(result.accuracy * 100);
    }
  });
  return Object.keys(dailyData).sort().map(date => {
    const arr = dailyData[date];
    if (!arr || arr.length === 0) {
      return { date, average: 0, sessions: [] };
    }
    return {
      date,
      average: arr.reduce((a, b) => a + b, 0) / arr.length,
      sessions: arr
    };
  });
}

export function getLetterStats(sessionResults: SessionResultLite[]) {
  const letterStats: Record<string, { correct: number; total: number }> = {};
  sessionResults.forEach(result => {
    Object.keys(result.letterAccuracy).forEach(letter => {
      if (!letterStats[letter]) letterStats[letter] = { correct: 0, total: 0 };
      const acc = result.letterAccuracy[letter];
      const stat = letterStats[letter];
      if (acc && stat) {
        stat.correct += acc.correct;
        stat.total += acc.total;
      }
    });
  });
  return Object.keys(letterStats).map(letter => {
    const stat = letterStats[letter];
    if (!stat || stat.total === 0) {
      return { letter, accuracy: 0, total: 0 };
    }
    return {
      letter,
      accuracy: (stat.correct / stat.total) * 100,
      total: stat.total
    };
  }).sort((a, b) => a.accuracy - b.accuracy);
}

// Daily response time aggregator (average ms across all groups within a day)
export function getDailyResponseTime(
  sessionResults: Array<{
    date: string;
    groupTimings?: Array<{ timeToCompleteMs?: number }>;
  }>
): Array<{ date: string; averageMs: number; samples: number }> {
  const daily: Record<string, number[]> = {};
  sessionResults.forEach((s) => {
    const times = (s.groupTimings || [])
      .map((t) => (typeof t?.timeToCompleteMs === 'number' ? t.timeToCompleteMs : 0))
      .filter((v) => v > 0 && isFinite(v));
    if (!times.length) return;
    const date = s.date;
    if (!date) return;
    if (!daily[date]) daily[date] = [];
    const arr = daily[date];
    if (arr) {
      arr.push(...times);
    }
  });
  return Object.keys(daily)
    .sort()
    .map((date) => {
      const arr = daily[date];
      if (!arr || arr.length === 0) {
        return { date, averageMs: 0, samples: 0 };
      }
      const avg = arr.reduce((a, b) => a + b, 0) / Math.max(1, arr.length);
      return { date, averageMs: Math.round(avg), samples: arr.length };
    });
}


