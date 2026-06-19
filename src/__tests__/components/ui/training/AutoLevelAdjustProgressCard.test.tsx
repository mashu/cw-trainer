import { render, screen } from '@testing-library/react';

import { AutoLevelAdjustProgressCard } from '@/components/ui/training/AutoLevelAdjustProgressCard';
import type { AutoLevelAdjustProgressView } from '@/lib/kochAutoAdjust';

const baseProgress: AutoLevelAdjustProgressView = {
  levelLabel: 'Koch level 4',
  currentLevel: 4,
  alternatingMixedLevels: false,
  threshold: 90,
  aboveCount: 2,
  belowCount: 1,
  aboveTarget: 3,
  belowTarget: 2,
  aboveDisabled: false,
  belowDisabled: false,
};

describe('AutoLevelAdjustProgressCard', () => {
  it('renders up/down progress bars and counts', () => {
    render(<AutoLevelAdjustProgressCard progress={baseProgress} />);

    expect(screen.getByLabelText(/automatic level adjustment progress/i)).toBeInTheDocument();
    expect(screen.getByText('2/3')).toBeInTheDocument();
    expect(screen.getByText('1/2')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Up' })).toHaveAttribute('aria-valuenow', '2');
    expect(screen.getByRole('progressbar', { name: 'Down' })).toHaveAttribute('aria-valuenow', '1');
  });

  it('shows profile label and mixed-mode hint when provided', () => {
    const mixed: AutoLevelAdjustProgressView = {
      ...baseProgress,
      alternatingMixedLevels: true,
      nextMixedAxis: 'digits',
    };
    render(<AutoLevelAdjustProgressCard progress={mixed} profileLabel="Echo" />);

    expect(screen.getByText('Echo')).toBeInTheDocument();
    expect(screen.getByText(/next: digit/i)).toBeInTheDocument();
  });

  it('shows reset hint for single-level profiles', () => {
    render(<AutoLevelAdjustProgressCard progress={baseProgress} />);
    expect(screen.getByText(/resets on level change/i)).toBeInTheDocument();
  });
});
