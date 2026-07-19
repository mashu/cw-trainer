import { render, screen } from '@testing-library/react';

import { OperatorRankCard } from '@/components/ui/training/OperatorRankCard';
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

describe('OperatorRankCard', () => {
  it('shows the bottom rank and the path to the next one for new operators', () => {
    render(<OperatorRankCard sessions={[]} />);

    expect(screen.getByRole('heading', { name: 'Listener' })).toBeInTheDocument();
    expect(screen.getByText('Total XP')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: /progress to novice/i })).toHaveAttribute(
      'aria-valuenow',
      '0',
    );
    expect(screen.getByText('300 XP')).toBeInTheDocument();
    expect(screen.getByText('Novice')).toBeInTheDocument();
    expect(screen.getByText('Rank 1 of 12')).toBeInTheDocument();
  });

  it('accumulates XP from sessions and moves up the ladder', () => {
    // Each session: 90 correct × 2 × 1.3 = 234 XP; 4 sessions = 936 XP → Apprentice (800+).
    const sessions = [1, 2, 3, 4].map((timestamp) => makeSession({ timestamp }));
    render(<OperatorRankCard sessions={sessions} />);

    expect(screen.getByRole('heading', { name: 'Apprentice' })).toBeInTheDocument();
    expect(screen.getByText('936')).toBeInTheDocument();
    expect(
      screen.getByRole('progressbar', { name: /progress to technician/i }),
    ).toBeInTheDocument();
  });
});
