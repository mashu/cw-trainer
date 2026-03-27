import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TrainingControls } from '@/components/ui/training/TrainingControls';

describe('TrainingControls', () => {
  it('should render submit and stop buttons', () => {
    const onSubmit = jest.fn();
    const onStop = jest.fn();

    render(<TrainingControls onSubmit={onSubmit} onStop={onStop} />);

    expect(screen.getByRole('button', { name: /Submit Results/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Stop Session/i })).toBeInTheDocument();
  });

  it('should call onSubmit when submit button is clicked', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    const onStop = jest.fn();

    render(<TrainingControls onSubmit={onSubmit} onStop={onStop} />);

    const submitButton = screen.getByRole('button', { name: /Submit Results/i });
    await user.click(submitButton);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onStop).not.toHaveBeenCalled();
  });

  it('should call onStop when stop button is clicked', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    const onStop = jest.fn();

    render(<TrainingControls onSubmit={onSubmit} onStop={onStop} />);

    const stopButton = screen.getByRole('button', { name: /Stop Session/i });
    await user.click(stopButton);

    expect(onStop).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

