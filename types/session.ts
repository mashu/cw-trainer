export interface SessionGroup {
  sent: string;
  received: string;
  correct: boolean;
}

export interface SessionTiming {
  timeToCompleteMs: number;
}

export interface SessionResult {
  date: string;
  timestamp: number;
  startedAt: number;
  finishedAt: number;
  groups: SessionGroup[];
  groupTimings?: SessionTiming[];
  accuracy: number; // 0..1
  letterAccuracy: Record<string, { correct: number; total: number }>;
  // Derived fields for leaderboard and analytics
  alphabetSize?: number; // unique chars in session's alphabet
  avgResponseMs?: number; // average response time across groups (ms)
  score?: number; // computed leaderboard score (immutable once published)
  firestoreId?: string; // optional document id used for reliable deletes
}


