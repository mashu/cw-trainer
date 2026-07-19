import { render, screen } from '@testing-library/react';

import { OperatorRankTile } from '@/components/ui/training/OperatorRankTile';
import { computeOperatorProgress, operatorProgressForXp } from '@/lib/progression';
import type { SessionResult } from '@/types';

const makeSession = ({
  timestamp = 1,
  accuracy = 0.9,
  totalChars = 100,
}: {
  readonly timestamp?: number;
  readonly accuracy?: number;
  readonly totalChars?: number;
} = {}): SessionResult => ({
  date: '2026-01-01',
  timestamp,
  startedAt: timestamp - 60_000,
  finishedAt: timestamp,
  groups: [{ sent: 'KM', received: 'KM', correct: true }],
  groupTimings: [{ timeToCompleteMs: 2000, perCharMs: 1000 }],
  accuracy,
  letterAccuracy: { K: { correct: 4, total: 5 } },
  alphabetSize: 2,
  avgResponseMs: 2000,
  totalChars,
  effectiveAlphabetSize: 2,
  score: 100,
});

describe('OperatorRankTile', () => {
  it('shows the current rank title, XP, and progress toward the next rank', () => {
    // 4 sessions × 234 XP = 936 XP → Apprentice (800+), next Technician (1600).
    const progress = computeOperatorProgress(
      [1, 2, 3, 4].map((timestamp) => makeSession({ timestamp })),
    );
    render(<OperatorRankTile progress={progress} />);

    expect(screen.getByText('Rank')).toBeInTheDocument();
    expect(screen.getByText('Apprentice')).toBeInTheDocument();
    expect(screen.getByText(/936 XP/)).toBeInTheDocument();
    expect(screen.getByText(/to Technician/)).toBeInTheDocument();
    expect(
      screen.getByRole('progressbar', { name: /progress to technician/i }),
    ).toBeInTheDocument();
  });

  it('celebrates the max rank instead of a next-rank target', () => {
    const progress = operatorProgressForXp(10_000_000);
    render(<OperatorRankTile progress={progress} />);

    expect(screen.getByText(/Max rank/)).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: /highest rank achieved/i })).toHaveAttribute(
      'aria-valuenow',
      '100',
    );
  });
});
