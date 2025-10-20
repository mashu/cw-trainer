export interface SessionResultLite {
  date: string;
  timestamp: number;
  accuracy: number; // 0..1
  letterAccuracy: Record<string, { correct: number; total: number }>;
}

export function getDailyStats(sessionResults: SessionResultLite[]) {
  const dailyData: Record<string, number[]> = {};
  sessionResults.forEach(result => {
    if (!dailyData[result.date]) dailyData[result.date] = [];
    dailyData[result.date].push(result.accuracy * 100);
  });
  return Object.keys(dailyData).sort().map(date => ({
    date,
    average: dailyData[date].reduce((a, b) => a + b, 0) / dailyData[date].length,
    sessions: dailyData[date]
  }));
}

export function getLetterStats(sessionResults: SessionResultLite[]) {
  const letterStats: Record<string, { correct: number; total: number }> = {};
  sessionResults.forEach(result => {
    Object.keys(result.letterAccuracy).forEach(letter => {
      if (!letterStats[letter]) letterStats[letter] = { correct: 0, total: 0 };
      letterStats[letter].correct += result.letterAccuracy[letter].correct;
      letterStats[letter].total += result.letterAccuracy[letter].total;
    });
  });
  return Object.keys(letterStats).map(letter => ({
    letter,
    accuracy: (letterStats[letter].correct / letterStats[letter].total) * 100,
    total: letterStats[letter].total
  })).sort((a, b) => a.accuracy - b.accuracy);
}


