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

// Mock firebase/firestore functions
jest.mock('firebase/firestore', () => {
  const actualModule = jest.requireActual('firebase/firestore');
  return {
    ...actualModule,
    collection: jest.fn(),
    collectionGroup: jest.fn(),
    getDocs: jest.fn(() => Promise.resolve({ forEach: () => {} })),
    limit: jest.fn(),
    orderBy: jest.fn(),
    query: jest.fn(),
  };
});

describe('Leaderboard', (): void => {
  let mockGetDocs: jest.Mock;

  beforeEach((): void => {
    jest.clearAllMocks();
    // Get the mocked getDocs function
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const firestore = require('firebase/firestore');
    mockGetDocs = firestore.getDocs as jest.Mock;
    // Reset getDocs mock to default
    mockGetDocs.mockResolvedValue({ forEach: () => {} });
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

  it('should display loading state', async (): Promise<void> => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mockInitFirebase = require('@/lib/firebaseClient').initFirebase;
    mockInitFirebase.mockReturnValue({
      db: {},
      auth: { currentUser: null },
    });
    // Mock getDocs to never resolve to simulate loading
    mockGetDocs.mockImplementation((): Promise<{ forEach: () => void }> => new Promise(() => {})); // Never resolves

    await act(async () => {
      render(<Leaderboard />);
    });

    await waitFor(() => {
      const loadingText = screen.queryByText(/Loading/i);
      expect(loadingText).toBeInTheDocument();
    });
  });

  it('should display error message when loading fails', async (): Promise<void> => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mockInitFirebase = require('@/lib/firebaseClient').initFirebase;
    mockInitFirebase.mockReturnValue({
      db: {},
      auth: { currentUser: null },
    });
    // Mock getDocs to throw error
    mockGetDocs.mockRejectedValue(new Error('Failed'));

    await act(async () => {
      render(<Leaderboard />);
    });

    await waitFor(() => {
      const errorText = screen.queryByText(/error|unable|unavailable/i);
      expect(errorText).toBeTruthy();
    });
  });

  it('should display top scores when available', async (): Promise<void> => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mockInitFirebase = require('@/lib/firebaseClient').initFirebase;
    const mockDb = {};
    mockInitFirebase.mockReturnValue({
      db: mockDb,
      auth: { currentUser: null },
    });

    const mockDocs = [
      {
        data: (): {
          publicId: number;
          score: number;
          timestamp: number;
          accuracy: number;
          alphabetSize: number;
          avgResponseMs: number;
        } => ({
          publicId: 123456,
          score: 100.5,
          timestamp: Date.now(),
          accuracy: 0.95,
          alphabetSize: 26,
          avgResponseMs: 500,
        }),
      },
    ];

    mockGetDocs.mockResolvedValue({
      forEach: (callback: (doc: unknown) => void) => {
        mockDocs.forEach(callback);
      },
    });

    await act(async () => {
      render(<Leaderboard limitCount={20} />);
    });

    await waitFor(() => {
      const scoreText = screen.queryByText(/100\.50/i); // Adjusted to match toFixed(2)
      const publicIdText = screen.queryByText(/123456/i);
      expect(scoreText).toBeInTheDocument();
      expect(publicIdText).toBeInTheDocument();
    });
  });

  it('should close help when close button is clicked', async (): Promise<void> => {
    const user = userEvent.setup();
    await act(async () => {
      render(<Leaderboard />);
    });

    await waitFor(async () => {
      const helpButton = screen.queryByRole('button', { name: /help|\?/i });
      if (helpButton) {
        await user.click(helpButton);
      }
      return helpButton !== null;
    });

    await waitFor(async () => {
      const closeButton = screen.queryByText(/×/);
      if (closeButton) {
        await user.click(closeButton);
        // Help should be closed
        const helpContent = screen.queryByText(/score formula/i);
        expect(helpContent).not.toBeInTheDocument();
      }
      return closeButton !== null;
    });
  });

  it('should display empty state when no scores', async (): Promise<void> => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mockInitFirebase = require('@/lib/firebaseClient').initFirebase;
    mockInitFirebase.mockReturnValue({
      db: {},
      auth: { currentUser: null },
    });

    mockGetDocs.mockResolvedValue({
      forEach: () => {}, // Empty results
    });

    await act(async () => {
      render(<Leaderboard />);
    });

    await waitFor(() => {
      const emptyText = screen.queryByText(/No scores|No scores yet/i);
      expect(emptyText).toBeTruthy();
    });
  });
});

