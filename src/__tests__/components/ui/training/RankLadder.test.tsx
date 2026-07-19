import { render, screen, within } from '@testing-library/react';

import { RankLadder } from '@/components/ui/training/RankLadder';
import { OPERATOR_RANKS } from '@/lib/progression';
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

describe('RankLadder', () => {
  it('lists every rank with its XP threshold', () => {
    render(<RankLadder sessions={[]} />);
    OPERATOR_RANKS.forEach((rank) => {
      expect(screen.getAllByText(rank.title).length).toBeGreaterThan(0);
    });
    // Top rank threshold is shown.
    expect(screen.getByText('45,000')).toBeInTheDocument();
  });

  it('marks the current rank with a "You" badge and shows progress to the next', () => {
    // 4 × 234 XP = 936 XP → Apprentice, next Technician.
    const sessions = [1, 2, 3, 4].map((timestamp) => makeSession({ timestamp }));
    render(<RankLadder sessions={sessions} />);

    const current = screen.getByText('Apprentice').closest('li');
    expect(current).not.toBeNull();
    expect(within(current as HTMLElement).getByText('You')).toBeInTheDocument();
    expect(
      screen.getByRole('progressbar', { name: /progress to technician/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/to reach/i)).toBeInTheDocument();
  });

  it('celebrates topping the ladder when max XP is reached', () => {
    const sessions = Array.from({ length: 250 }, (_, i) =>
      makeSession({ timestamp: i + 1, accuracy: 1, totalChars: 200 }),
    );
    render(<RankLadder sessions={sessions} />);
    expect(screen.getByText(/highest rank achieved/i)).toBeInTheDocument();
  });
});
