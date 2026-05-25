import { render, screen } from '@testing-library/react';
import React from 'react';

import { ChaseTrainingView } from '@/components/features/chase/ChaseTrainingView';

const baseProps = {
  target: {
    id: 1,
    group: 'KMURE',
    lanePercent: 50,
    level: 2,
    spawnedAt: 1000,
    deadlineAt: 7000,
    fallMs: 6000,
  },
  lastResolvedTarget: null,
  userInput: '',
  lives: 5,
  level: 2,
  score: 1200,
  streak: 3,
  bestStreak: 4,
  levelProgress: 0.4,
  groupsCompleted: 8,
  onChange: jest.fn(),
  onSubmit: jest.fn(),
  onStop: jest.fn(),
};

describe('ChaseTrainingView', () => {
  it('shows auto-fire copy and high-threat styling for longer groups', () => {
    render(<ChaseTrainingView {...baseProps} />);

    expect(screen.getByPlaceholderText('COPY 5')).toBeInTheDocument();
    expect(screen.getByText(/Auto-fires as soon as 5 characters are typed/i)).toBeInTheDocument();
    expect(screen.getByText(/High threat/i)).toBeInTheDocument();
  });

  it('shows a miss warning for missed targets', () => {
    render(
      <ChaseTrainingView
        {...baseProps}
        target={null}
        lastResolvedTarget={{
          sent: 'KMU',
          received: '',
          outcome: 'missed',
          scoreDelta: 0,
        }}
      />,
    );

    expect(screen.getByText(/Missed target/i)).toBeInTheDocument();
    expect(screen.getByText(/Missed group/i)).toBeInTheDocument();
    expect(screen.getByText('Answer')).toBeInTheDocument();
    expect(screen.getByText('Typed')).toBeInTheDocument();
    expect(screen.getAllByText('_').length).toBe(3);
  });

  it('shows the true answer and typed answer for wrong targets', () => {
    render(
      <ChaseTrainingView
        {...baseProps}
        target={null}
        lastResolvedTarget={{
          sent: 'KMU',
          received: 'KMM',
          outcome: 'wrong',
          scoreDelta: 0,
        }}
      />,
    );

    expect(screen.getByText(/Wrong group/i)).toBeInTheDocument();
    expect(screen.getByText('Answer')).toBeInTheDocument();
    expect(screen.getByText('Typed')).toBeInTheDocument();
    expect(screen.getAllByText('K').length).toBeGreaterThan(1);
    expect(screen.getAllByText('M').length).toBeGreaterThan(1);
  });
});
