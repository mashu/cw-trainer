import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { LegalBanner } from '@/components/ui/layouts/LegalBanner';

const STORAGE_KEY = 'cw_trainer_legal_ack_v1';

describe('LegalBanner', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should render banner when not acknowledged', async () => {
    render(<LegalBanner />);

    await waitFor(() => {
      expect(screen.getByText('Personal-use project with basic data collection')).toBeInTheDocument();
    });
  });

  it('should not render banner when already acknowledged', async () => {
    localStorage.setItem(STORAGE_KEY, '1');

    render(<LegalBanner />);

    await waitFor(() => {
      expect(
        screen.queryByText('Personal-use project with basic data collection'),
      ).not.toBeInTheDocument();
    });
  });

  it('should dismiss banner when I understand is clicked', async () => {
    const user = userEvent.setup();

    render(<LegalBanner />);

    await waitFor(() => {
      expect(screen.getByText('I understand')).toBeInTheDocument();
    });

    const button = screen.getByRole('button', { name: /I understand/i });
    await user.click(button);

    await waitFor(() => {
      expect(
        screen.queryByText('Personal-use project with basic data collection'),
      ).not.toBeInTheDocument();
    });

    expect(localStorage.getItem(STORAGE_KEY)).toBe('1');
  });

  it('should dismiss banner when backdrop is clicked', async () => {
    const user = userEvent.setup();

    render(<LegalBanner />);

    await waitFor(() => {
      expect(screen.getByText('Personal-use project with basic data collection')).toBeInTheDocument();
    });

    // Click on the backdrop (the div with onClick)
    const backdrop = document.querySelector('.absolute.inset-0.bg-black\\/50');
    if (backdrop) {
      await user.click(backdrop as HTMLElement);
    }

    await waitFor(() => {
      expect(
        screen.queryByText('Personal-use project with basic data collection'),
      ).not.toBeInTheDocument();
    });
  });

  it('should render GitHub link', async () => {
    render(<LegalBanner />);

    await waitFor(() => {
      const githubLink = screen.getByRole('link', { name: /GitHub/i });
      expect(githubLink).toBeInTheDocument();
      expect(githubLink).toHaveAttribute('href', 'https://github.com/mashu/cw-trainer');
      expect(githubLink).toHaveAttribute('target', '_blank');
    });
  });

  it('should render Learn more link', async () => {
    render(<LegalBanner />);

    await waitFor(() => {
      const learnMoreLink = screen.getByRole('link', { name: /Learn more/i });
      expect(learnMoreLink).toBeInTheDocument();
      expect(learnMoreLink).toHaveAttribute('href', '#data-notice');
    });
  });

  it('should handle localStorage errors gracefully', async () => {
    // Mock localStorage.getItem to throw
    const originalGetItem = localStorage.getItem;
    localStorage.getItem = jest.fn(() => {
      throw new Error('Storage error');
    });

    render(<LegalBanner />);

    // Should still render (defaults to visible on error)
    await waitFor(() => {
      expect(screen.getByText('Personal-use project with basic data collection')).toBeInTheDocument();
    });

    localStorage.getItem = originalGetItem;
  });
});

