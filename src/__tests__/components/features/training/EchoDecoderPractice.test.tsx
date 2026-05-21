import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { EchoDecoderPractice } from '@/components/features/training/EchoDecoderPractice';
import { DEFAULT_TRAINING_SETTINGS } from '@/config/training.config';
import { useMorseDecoderPractice } from '@/hooks/useMorseDecoderPractice';

const mockClear = jest.fn();

jest.mock('@/hooks/useMorseDecoderPractice', () => ({
  useMorseDecoderPractice: jest.fn(),
}));

const mockUseMorseDecoderPractice = useMorseDecoderPractice as jest.MockedFunction<
  typeof useMorseDecoderPractice
>;

describe('EchoDecoderPractice', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseMorseDecoderPractice.mockReturnValue({
      segments: [{ id: 'seg-1', display: 'E' }],
      livePattern: '.',
      clear: mockClear,
    });
  });

  it('renders decoded segments and live pattern', () => {
    render(<EchoDecoderPractice settings={DEFAULT_TRAINING_SETTINGS} enabled />);

    expect(screen.getByLabelText(/morse decoder practice/i)).toBeInTheDocument();
    expect(screen.getByText('E')).toBeInTheDocument();
    expect(screen.getByText('·')).toBeInTheDocument();
  });

  it('shows placeholder when empty', () => {
    mockUseMorseDecoderPractice.mockReturnValue({
      segments: [],
      livePattern: '',
      clear: mockClear,
    });

    render(<EchoDecoderPractice settings={DEFAULT_TRAINING_SETTINGS} enabled={false} />);

    expect(screen.getByText(/decoded characters will show up/i)).toBeInTheDocument();
  });

  it('clears practice state from the button', async () => {
    const user = userEvent.setup();
    render(<EchoDecoderPractice settings={DEFAULT_TRAINING_SETTINGS} enabled />);

    await user.click(screen.getByRole('button', { name: /clear/i }));
    expect(mockClear).toHaveBeenCalledTimes(1);
  });
});
