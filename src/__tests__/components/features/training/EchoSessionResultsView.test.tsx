import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { EchoSessionResultsView } from '@/components/features/training/EchoSessionResultsView';
import type { EchoSessionResultSummary } from '@/hooks/useEchoTrainingSession';

const sampleResult: EchoSessionResultSummary = {
  accuracy: 0.75,
  avgResponseMs: 420,
  score: 80,
  sendingScore: 3,
  correctCharacters: 6,
  incorrectCharacters: 2,
  groups: [
    { sent: 'AB', received: 'AB', correct: true },
    { sent: 'CD', received: 'CX', correct: false },
  ],
};

describe('EchoSessionResultsView', () => {
  it('renders summary KPIs and group rows', () => {
    render(
      <EchoSessionResultsView
        result={sampleResult}
        onTrainAgain={jest.fn()}
        onViewStats={jest.fn()}
        onBack={jest.fn()}
      />,
    );

    expect(screen.getByText(/echo session complete/i)).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('6/8')).toBeInTheDocument();
    expect(screen.getByText('420')).toBeInTheDocument();
    expect(screen.getByText('+3')).toBeInTheDocument();
    expect(screen.getByText(/group 1/i)).toBeInTheDocument();
    expect(screen.getByText(/group 2/i)).toBeInTheDocument();
  });

  it('uses warning styling for mid accuracy', () => {
    render(
      <EchoSessionResultsView
        result={{ ...sampleResult, accuracy: 0.8 }}
        onTrainAgain={jest.fn()}
        onViewStats={jest.fn()}
        onBack={jest.fn()}
      />,
    );

    const accuracyCard = screen.getByText('80%').closest('div');
    expect(accuracyCard?.className).toMatch(/amber/);
  });

  it('invokes action callbacks from footer buttons', async () => {
    const user = userEvent.setup();
    const onTrainAgain = jest.fn();
    const onViewStats = jest.fn();
    const onBack = jest.fn();

    render(
      <EchoSessionResultsView
        result={sampleResult}
        onTrainAgain={onTrainAgain}
        onViewStats={onViewStats}
        onBack={onBack}
      />,
    );

    await user.click(screen.getByRole('button', { name: /train again/i }));
    await user.click(screen.getByRole('button', { name: /view all stats/i }));
    await user.click(screen.getByRole('button', { name: /back to menu/i }));

    expect(onTrainAgain).toHaveBeenCalledTimes(1);
    expect(onViewStats).toHaveBeenCalledTimes(1);
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
