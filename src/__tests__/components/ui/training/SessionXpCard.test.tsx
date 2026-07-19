import { render, screen } from '@testing-library/react';

import { SessionXpCard } from '@/components/ui/training/SessionXpCard';
import type { SessionResult } from '@/types';

const makeSession = ({
  timestamp = 1,
  accuracy = 0.9,
  totalChars = 100,
  effectiveWpm,
}: {
  readonly timestamp?: number;
  readonly accuracy?: number;
  readonly totalChars?: number;
  readonly effectiveWpm?: number;
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
  ...(effectiveWpm !== undefined ? { effectiveWpm } : {}),
});

describe('SessionXpCard', () => {
  it('shows the XP earned with accuracy and speed bonus chips', () => {
    const latest = makeSession({ timestamp: 2, accuracy: 0.9, totalChars: 100, effectiveWpm: 20 });
    render(<SessionXpCard allSessions={[latest]} latestSession={latest} />);

    // 90 correct × 2 × (1.3 + 0.35) = 297
    expect(screen.getByText(/\+297/)).toBeInTheDocument();
    expect(screen.getByText('90 chars copied')).toBeInTheDocument();
    expect(screen.getByText('+30% accuracy')).toBeInTheDocument();
    expect(screen.getByText('+35% speed')).toBeInTheDocument();
    expect(screen.queryByText(/rank up/i)).not.toBeInTheDocument();
  });

  it('celebrates a rank up when the session crosses a threshold', () => {
    // First session: 234 XP (Listener). Second brings the total to 468... need ≥300 for Novice.
    // 234 XP already crosses nothing; the second session crosses 300 → rank up to Novice.
    const first = makeSession({ timestamp: 1 });
    const latest = makeSession({ timestamp: 2 });
    render(<SessionXpCard allSessions={[first, latest]} latestSession={latest} />);

    expect(screen.getByText(/rank up/i)).toBeInTheDocument();
    expect(screen.getByText(/you are now/i)).toBeInTheDocument();
    expect(screen.getByText('Novice')).toBeInTheDocument();
  });

  it('renders nothing for an empty session', () => {
    const latest = makeSession({ timestamp: 1, totalChars: 0 });
    const { container } = render(<SessionXpCard allSessions={[latest]} latestSession={latest} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('counts the finished session even when history has not caught up yet', () => {
    const latest = makeSession({ timestamp: 5, accuracy: 0.9, totalChars: 100 });
    render(<SessionXpCard allSessions={[]} latestSession={latest} />);
    // 234 XP total after inclusion — shown in the footer line.
    expect(screen.getByText(/234 XP total/)).toBeInTheDocument();
  });
});
