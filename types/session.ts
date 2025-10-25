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
  firestoreId?: string; // optional document id used for reliable deletes
}


