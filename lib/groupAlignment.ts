/**
 * Group alignment utility for Morse code training.
 * Aligns sent groups with received groups to calculate accurate letter-level statistics,
 * handling insertions, deletions, and substitutions within groups.
 */

export type GroupAlignmentPair = {
  sentChar: string | null; // null = insertion (extra char in received)
  receivedChar: string | null; // null = deletion (missing char)
  match: boolean; // true if sentChar === receivedChar (both non-null)
};

/**
 * Aligns a sent group with a received group using dynamic programming (edit distance).
 * Returns alignment pairs showing how each position aligns.
 * 
 * Example: alignGroup("ABC", "ABD") => [
 *   { sentChar: "A", receivedChar: "A", match: true },
 *   { sentChar: "B", receivedChar: "B", match: true },
 *   { sentChar: "C", receivedChar: "D", match: false }
 * ]
 */
export function alignGroup(sent: string, received: string): GroupAlignmentPair[] {
  const s = sent.toUpperCase();
  const r = received.toUpperCase();
  
  // Handle empty cases
  if (s.length === 0 && r.length === 0) return [];
  if (s.length === 0) {
    return r.split('').map(ch => ({ sentChar: null, receivedChar: ch, match: false }));
  }
  if (r.length === 0) {
    return s.split('').map(ch => ({ sentChar: ch, receivedChar: null, match: false }));
  }

  // Dynamic programming table: dp[i][j] = edit distance between s[0..i-1] and r[0..j-1]
  const m = s.length;
  const n = r.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  // Initialize base cases
  for (let i = 0; i <= m; i++) {
    const row = dp[i];
    if (row) {
      row[0] = i; // cost to delete i chars from sent
    }
  }
  const firstRow = dp[0];
  if (firstRow) {
    for (let j = 0; j <= n; j++) {
      firstRow[j] = j; // cost to insert j chars into received
    }
  }
  
  // Fill DP table
  for (let i = 1; i <= m; i++) {
    const row = dp[i];
    const prevRow = dp[i - 1];
    if (!row || !prevRow) continue;
    for (let j = 1; j <= n; j++) {
      const sentChar = s[i - 1];
      const receivedChar = r[j - 1];
      if (sentChar === undefined || receivedChar === undefined) continue;
      const matchCost = sentChar === receivedChar ? 0 : 1;
      const prevCol = prevRow[j];
      const currCol = row[j - 1];
      const prevDiag = prevRow[j - 1];
      if (typeof prevCol === 'number' && typeof currCol === 'number' && typeof prevDiag === 'number') {
        const col = row[j];
        if (col !== undefined) {
          row[j] = Math.min(
            prevCol + 1,           // deletion
            currCol + 1,           // insertion
            prevDiag + matchCost   // substitution/match
          );
        }
      }
    }
  }
  
  // Backtrack to construct alignment
  const alignment: GroupAlignmentPair[] = [];
  let i = m;
  let j = n;
  
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const row = dp[i];
      const prevRow = dp[i - 1];
      if (!row || !prevRow) break;
      const sentChar = s[i - 1];
      const receivedChar = r[j - 1];
      if (sentChar === undefined || receivedChar === undefined) break;
      const matchCost = sentChar === receivedChar ? 0 : 1;
      const current = row[j];
      if (current === undefined) break;
      const substitution = (prevRow[j - 1] ?? 0) + matchCost;
      const deletion = (prevRow[j] ?? 0) + 1;
      const _insertion = (row[j - 1] ?? 0) + 1;
      
      if (current === substitution) {
        // Match or substitution
        alignment.unshift({
          sentChar,
          receivedChar,
          match: sentChar === receivedChar
        });
        i--;
        j--;
      } else if (current === deletion) {
        // Deletion: sent char not in received
        alignment.unshift({
          sentChar,
          receivedChar: null,
          match: false
        });
        i--;
      } else {
        // Insertion: extra received char
        alignment.unshift({
          sentChar: null,
          receivedChar,
          match: false
        });
        j--;
      }
    } else if (i > 0) {
      // Remaining sent chars (deletions)
      const sentChar = s[i - 1];
      if (sentChar !== undefined) {
        alignment.unshift({
          sentChar,
          receivedChar: null,
          match: false
        });
      }
      i--;
    } else {
      // Remaining received chars (insertions)
      const receivedChar = r[j - 1];
      if (receivedChar !== undefined) {
        alignment.unshift({
          sentChar: null,
          receivedChar,
          match: false
        });
      }
      j--;
    }
  }
  
  return alignment;
}

/**
 * Calculate letter accuracy using group alignment.
 * Only counts letters from the sent groups (not insertions).
 * 
 * @param groups Array of { sent: string, received: string }
 * @returns Record mapping each letter to { correct: number, total: number }
 */
export function calculateGroupLetterAccuracy(
  groups: ReadonlyArray<{ readonly sent: string; readonly received: string }>
): Record<string, { correct: number; total: number }> {
  const letterAccuracy: Record<string, { correct: number; total: number }> = {};
  
  groups.forEach(group => {
    const alignment = alignGroup(group.sent, group.received);
    
    alignment.forEach(pair => {
      // Only count sent letters (ignore insertions)
      if (pair.sentChar !== null) {
        const char = pair.sentChar;
        if (!letterAccuracy[char]) {
          letterAccuracy[char] = { correct: 0, total: 0 };
        }
        letterAccuracy[char].total++;
        // Count as correct if matched
        if (pair.match) {
          letterAccuracy[char].correct++;
        }
      }
    });
  });
  
  return letterAccuracy;
}

/**
 * Create display alignment array for visualization.
 * Shows received characters with match indicators.
 * 
 * @param sent The sent group
 * @param received The received group
 * @returns Array of { ch: string, ok: boolean } for display
 */
export function createGroupDisplayAlignment(
  sent: string,
  received: string
): Array<{ ch: string; ok: boolean }> {
  const alignment = alignGroup(sent, received);
  
  return alignment.map(pair => ({
    ch: pair.receivedChar || '', // Show received char (empty string for deletion)
    ok: pair.match // True if correctly matched
  }));
}

/**
 * Calculate group-level accuracy with alignment.
 * Groups are considered correct only if all sent letters are correctly matched.
 * 
 * @param groups Array of { sent: string, received: string }
 * @returns Accuracy score (0..1) and detailed per-group results
 */
export function calculateGroupAccuracy(
  groups: ReadonlyArray<{ readonly sent: string; readonly received: string }>
): {
  accuracy: number;
  groups: Array<{ sent: string; received: string; correct: boolean; alignment: GroupAlignmentPair[] }>;
} {
  const alignedGroups = groups.map(group => {
    const alignment = alignGroup(group.sent, group.received);
    // Group is correct if all sent letters are matched correctly
    const correct = alignment.every(pair => 
      pair.sentChar === null || pair.match
    );
    
    return {
      sent: group.sent,
      received: group.received,
      correct,
      alignment
    };
  });
  
  const correctCount = alignedGroups.filter(g => g.correct).length;
  const accuracy = groups.length > 0 ? correctCount / groups.length : 0;
  
  return { accuracy, groups: alignedGroups };
}

