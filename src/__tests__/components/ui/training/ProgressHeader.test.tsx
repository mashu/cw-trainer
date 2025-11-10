import { render, screen } from '@testing-library/react';

import { ProgressHeader } from '@/components/ui/training/ProgressHeader';

describe('ProgressHeader', () => {
  it('should render current and total groups', () => {
    render(<ProgressHeader currentGroup={2} totalGroups={5} />);

    expect(screen.getByText('Playing Group 3 of 5')).toBeInTheDocument();
  });

  it('should calculate and display correct percentage', () => {
    render(<ProgressHeader currentGroup={0} totalGroups={4} />);

    // Group 1 of 4 = 25%
    expect(screen.getByText('25% Complete')).toBeInTheDocument();
  });

  it('should show 100% when on last group', () => {
    render(<ProgressHeader currentGroup={4} totalGroups={5} />);

    expect(screen.getByText('100% Complete')).toBeInTheDocument();
  });

  it('should handle single group', () => {
    render(<ProgressHeader currentGroup={0} totalGroups={1} />);

    expect(screen.getByText('Playing Group 1 of 1')).toBeInTheDocument();
    expect(screen.getByText('100% Complete')).toBeInTheDocument();
  });

  it('should render progress bar with correct width', () => {
    render(<ProgressHeader currentGroup={1} totalGroups={4} />);

    // Group 2 of 4 = 50%
    const progressBar = document.querySelector('.bg-gradient-to-r.from-blue-500');
    expect(progressBar).toHaveStyle({ width: '50%' });
  });
});

