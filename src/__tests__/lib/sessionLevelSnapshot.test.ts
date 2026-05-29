import {
  formatSessionLevelLabel,
  sessionLevelSnapshotFromSettings,
} from '@/lib/sessionLevelSnapshot';
import type { SessionResult } from '@/types';

const baseSession = (overrides: Partial<SessionResult> = {}): SessionResult => ({
  date: '2025-01-01',
  timestamp: 1,
  startedAt: 1,
  finishedAt: 2,
  groups: [{ sent: 'A1', received: 'A1', correct: true }],
  groupTimings: [{ timeToCompleteMs: 100 }],
  accuracy: 1,
  letterAccuracy: {},
  alphabetSize: 5,
  avgResponseMs: 100,
  totalChars: 2,
  effectiveAlphabetSize: 2,
  score: 10,
  ...overrides,
});

describe('sessionLevelSnapshotFromSettings', () => {
  it('includes digits level for mixed mode', () => {
    expect(
      sessionLevelSnapshotFromSettings({
        kochLevel: 2,
        charSetMode: 'mixed',
        digitsLevel: 2,
      }),
    ).toEqual({
      kochLevel: 2,
      charSetMode: 'mixed',
      digitsLevel: 2,
    });
  });
});

describe('formatSessionLevelLabel', () => {
  it('shows alphabet / digits for mixed snapshot', () => {
    expect(
      formatSessionLevelLabel(
        baseSession({
          kochLevel: 2,
          digitsLevel: 2,
          charSetMode: 'mixed',
          alphabetSize: 5,
        }),
      ),
    ).toBe('2 / 2');
  });

  it('does not infer a single level from alphabetSize for legacy mixed sessions', () => {
    expect(
      formatSessionLevelLabel(
        baseSession({
          alphabetSize: 5,
          groups: [{ sent: 'KM1', received: 'KM1', correct: true }],
        }),
      ),
    ).toBeNull();
  });

  it('falls back to alphabetSize - 1 for legacy Koch-only sessions', () => {
    expect(
      formatSessionLevelLabel(
        baseSession({
          alphabetSize: 4,
          groups: [{ sent: 'KMR', received: 'KMR', correct: true }],
        }),
      ),
    ).toBe('3');
  });
});
