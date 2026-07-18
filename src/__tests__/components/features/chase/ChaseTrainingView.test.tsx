import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { ChaseTrainingView } from '@/components/features/chase/ChaseTrainingView';
import type { ChaseNote, ChaseRecentLetter } from '@/hooks/useChaseTrainingSession';

const now = Date.now();

const makeNote = (overrides: Partial<ChaseNote> = {}): ChaseNote => ({
  id: 1,
  char: 'K',
  laneIndex: 4,
  toneHz: 500,
  spawnedAt: now - 1000,
  hitAt: now + 1000,
  windowEndAt: now + 3000,
  status: 'incoming',
  ...overrides,
});

const baseProps = {
  notes: [] as readonly ChaseNote[],
  recentLetters: [] as readonly ChaseRecentLetter[],
  wpm: 16,
  wpmMin: 10,
  wpmMax: 25,
  calm: false,
  level: 2,
  score: 1200,
  combo: 3,
  bestCombo: 7,
  levelProgress: 0.4,
  lettersHeard: 8,
  correctCount: 6,
  wrongCount: 1,
  missedCount: 1,
  onKeystroke: jest.fn(),
  onStop: jest.fn(),
};

describe('ChaseTrainingView', () => {
  it('renders the HUD with score, combo, live copy rate, and pace', () => {
    render(<ChaseTrainingView {...baseProps} />);

    expect(screen.getByText('1200')).toBeInTheDocument();
    expect(screen.getByText(/×3/)).toBeInTheDocument();
    expect(screen.getByText(/best ×7/)).toBeInTheDocument();
    // 6 of 8 resolved letters copied = 75%
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('16')).toBeInTheDocument();
    expect(screen.getByText('Finish')).toBeInTheDocument();
  });

  it('renders tone lane labels across the 300-800 Hz band', () => {
    render(<ChaseTrainingView {...baseProps} />);

    expect(screen.getByText('300 Hz')).toBeInTheDocument();
    expect(screen.getByText('550 Hz')).toBeInTheDocument();
    expect(screen.getByText('800 Hz')).toBeInTheDocument();
  });

  it('hides the letter on unresolved notes and reveals it once resolved', () => {
    render(
      <ChaseTrainingView
        {...baseProps}
        notes={[
          makeNote({ id: 1, char: 'K', status: 'heard' }),
          makeNote({ id: 2, char: 'M', status: 'correct', resolvedAt: now }),
          makeNote({ id: 3, char: 'R', status: 'missed', resolvedAt: now }),
        ]}
      />,
    );

    expect(screen.getByTestId('chase-note-1')).toHaveTextContent('♪');
    expect(screen.getByTestId('chase-note-2')).toHaveTextContent('M');
    expect(screen.getByTestId('chase-note-3')).toHaveTextContent('R');
  });

  it('shows the wrong typed character under a wrong note', () => {
    render(
      <ChaseTrainingView
        {...baseProps}
        notes={[makeNote({ id: 5, char: 'U', status: 'wrong', typedChar: 'V', resolvedAt: now })]}
      />,
    );

    const note = screen.getByTestId('chase-note-5');
    expect(note).toHaveTextContent('U');
    expect(note).toHaveTextContent('V');
  });

  it('renders the recent-letter ticker with outcomes', () => {
    render(
      <ChaseTrainingView
        {...baseProps}
        recentLetters={[
          { id: 1, char: 'K', outcome: 'correct' },
          { id: 2, char: 'M', outcome: 'missed' },
        ]}
      />,
    );

    const ticker = screen.getByTestId('chase-ticker');
    expect(ticker).toHaveTextContent('K');
    expect(ticker).toHaveTextContent('M');
  });

  it('shows the breather indicator during calm phases', () => {
    render(<ChaseTrainingView {...baseProps} calm />);

    expect(screen.getByText(/Breather/i)).toBeInTheDocument();
    expect(screen.getByText(/cruising/i)).toBeInTheDocument();
  });

  it('forwards typed characters as keystrokes', () => {
    const onKeystroke = jest.fn();
    render(<ChaseTrainingView {...baseProps} onKeystroke={onKeystroke} />);

    fireEvent.change(screen.getByPlaceholderText('TYPE WHAT YOU HEAR'), {
      target: { value: 'ab' },
    });

    expect(onKeystroke).toHaveBeenCalledTimes(2);
    expect(onKeystroke).toHaveBeenNthCalledWith(1, 'a');
    expect(onKeystroke).toHaveBeenNthCalledWith(2, 'b');
  });

  it('calls onStop when Finish is pressed', () => {
    const onStop = jest.fn();
    render(<ChaseTrainingView {...baseProps} onStop={onStop} />);

    fireEvent.click(screen.getByText('Finish'));
    expect(onStop).toHaveBeenCalled();
  });
});
