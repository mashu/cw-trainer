import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { EchoTrainingView } from '@/components/features/training/EchoTrainingView';

const defaultProps = {
  currentGroup: 0,
  sentGroups: ['AB'],
  currentCharacterIndex: 0,
  currentCharacterState: 'awaiting' as const,
  currentSymbols: '.',
  revealedCharacter: null,
  currentGroupProgress: [
    { revealedCharacter: null, status: 'pending' as const },
    { revealedCharacter: null, status: 'pending' as const },
  ],
  correctCharacters: 2,
  incorrectCharacters: 1,
  onStop: jest.fn(),
};

describe('EchoTrainingView', () => {
  it('renders echo sending UI with score and progress', () => {
    render(<EchoTrainingView {...defaultProps} />);

    expect(screen.getByText(/echo sending/i)).toBeInTheDocument();
    expect(screen.getByText('+1')).toBeInTheDocument();
    expect(screen.getByText(/character 1\/2/i)).toBeInTheDocument();
    expect(screen.getByText(/how it works/i)).toBeInTheDocument();
  });

  it('shows negative sending score in red styling', () => {
    render(
      <EchoTrainingView
        {...defaultProps}
        correctCharacters={1}
        incorrectCharacters={4}
      />,
    );

    const score = screen.getByText('-3');
    expect(score.className).toMatch(/rose/);
  });

  it('calls onStop from the stop button', async () => {
    const user = userEvent.setup();
    const onStop = jest.fn();

    render(<EchoTrainingView {...defaultProps} onStop={onStop} />);

    await user.click(screen.getByRole('button', { name: /stop session/i }));
    expect(onStop).toHaveBeenCalledTimes(1);
  });
});
