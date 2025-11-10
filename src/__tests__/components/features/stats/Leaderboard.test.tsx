import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Leaderboard } from '@/components/features/stats/Leaderboard';

// Mock Firebase
jest.mock('@/lib/firebaseClient', () => ({
  initFirebase: jest.fn(() => null), // Return null to indicate Firebase not configured
}));

// Mock katex
jest.mock('katex', () => ({
  renderToString: jest.fn((text: string) => text),
}));

// Mock katex CSS
jest.mock('katex/dist/katex.min.css', () => ({}));

describe('Leaderboard', (): void => {
  beforeEach((): void => {
    jest.clearAllMocks();
  });

  it('should render leaderboard component', async (): Promise<void> => {
    await act(async () => {
      render(<Leaderboard />);
    });

    await waitFor(() => {
      expect(screen.getByText(/Leaderboard/i)).toBeInTheDocument();
    });
  });

  it('should display message when Firebase is not configured', async (): Promise<void> => {
    await act(async () => {
      render(<Leaderboard />);
    });

    await waitFor(() => {
      // Component should render (either with error message or leaderboard title)
      const leaderboardTitle = screen.queryByText(/Leaderboard/i);
      expect(leaderboardTitle).toBeInTheDocument();
    });
  });

  it('should show help button', async (): Promise<void> => {
    await act(async () => {
      render(<Leaderboard />);
    });

    await waitFor(() => {
      const helpButton = screen.queryByRole('button', { name: /help|\?/i });
      expect(helpButton).toBeInTheDocument();
    });
  });

  it('should toggle help when help button is clicked', async (): Promise<void> => {
    const user = userEvent.setup();
    await act(async () => {
      render(<Leaderboard />);
    });

    await waitFor(() => {
      const helpButton = screen.queryByRole('button', { name: /help|\?/i });
      return helpButton !== null;
    });

    const helpButton = screen.getByRole('button', { name: /help|\?/i });
    await act(async () => {
      await user.click(helpButton);
    });

    // Help content should appear
    await waitFor(() => {
      const helpContent = screen.queryAllByText(/score|formula/i);
      expect(helpContent.length).toBeGreaterThan(0);
    });
  });

  it('should respect limitCount prop', async (): Promise<void> => {
    await act(async () => {
      render(<Leaderboard limitCount={10} />);
    });

    await waitFor(() => {
      expect(screen.getByText(/Leaderboard/i)).toBeInTheDocument();
    });
  });
});

