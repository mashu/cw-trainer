import { render, screen } from '@testing-library/react';

import { LegalFooter } from '@/components/ui/layouts/LegalFooter';

describe('LegalFooter', () => {
  it('should render footer with data notice', () => {
    render(<LegalFooter />);

    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.getByText('Data, privacy, and liability')).toBeInTheDocument();
  });

  it('should render privacy information', () => {
    render(<LegalFooter />);

    expect(
      screen.getByText(/Training settings and history are stored in your browser/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/This is an open-source, personal-use project/),
    ).toBeInTheDocument();
    expect(screen.getByText(/If you do not agree with these terms/)).toBeInTheDocument();
  });

  it('should render GitHub link', () => {
    render(<LegalFooter />);

    const githubLink = screen.getByRole('link', { name: /View on GitHub/i });
    expect(githubLink).toBeInTheDocument();
    expect(githubLink).toHaveAttribute('href', 'https://github.com/mashu/cw-trainer');
    expect(githubLink).toHaveAttribute('target', '_blank');
    expect(githubLink).toHaveAttribute('rel', 'noreferrer');
  });

  it('should have correct id for anchor linking', () => {
    render(<LegalFooter />);

    const footer = screen.getByRole('contentinfo');
    expect(footer).toHaveAttribute('id', 'data-notice');
  });
});

