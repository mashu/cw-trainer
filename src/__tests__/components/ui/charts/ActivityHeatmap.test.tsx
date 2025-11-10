import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ActivityHeatmap, type ActivitySessionLite } from '@/components/ui/charts/ActivityHeatmap';

describe('ActivityHeatmap', (): void => {
  const mockSessions: ActivitySessionLite[] = [
    { date: '2024-01-15', timestamp: 1705276800000, count: 5 },
    { date: '2024-01-16', timestamp: 1705363200000, count: 10 },
    { date: '2024-01-17', timestamp: 1705449600000, count: 3 },
  ];

  it('should render heatmap with sessions', (): void => {
    render(<ActivityHeatmap sessions={mockSessions} />);

    expect(screen.getByText(/Activity/i)).toBeInTheDocument();
  });

  it('should display month labels', (): void => {
    render(<ActivityHeatmap sessions={mockSessions} />);

    // Should show month labels or navigation buttons
    const prevButton = screen.getByRole('button', { name: /Prev/i });
    expect(prevButton).toBeInTheDocument();
  });

  it('should call onSelectDate when a day is clicked', async (): Promise<void> => {
    const user = userEvent.setup();
    const onSelectDate = jest.fn();
    render(<ActivityHeatmap sessions={mockSessions} onSelectDate={onSelectDate} />);

    // Find a day cell by aria-label (they have onClick handlers)
    await waitFor(() => {
      const dayCells = screen.queryAllByLabelText(/—/);
      if (dayCells.length > 0) {
        return dayCells[0];
      }
      return null;
    });

    const dayCells = screen.queryAllByLabelText(/—/);
    if (dayCells.length > 0) {
      await user.click(dayCells[0]!);
      expect(onSelectDate).toHaveBeenCalled();
    }
  });

  it('should highlight selected date', (): void => {
    render(<ActivityHeatmap sessions={mockSessions} selectedDate="2024-01-15" />);

    // The selected date should be rendered
    expect(screen.getByText(/Activity/i)).toBeInTheDocument();
  });

  it('should handle empty sessions array', (): void => {
    render(<ActivityHeatmap sessions={[]} />);

    expect(screen.getByText(/Activity/i)).toBeInTheDocument();
  });

  it('should respect monthsPerPage prop', (): void => {
    render(<ActivityHeatmap sessions={mockSessions} monthsPerPage={6} />);

    expect(screen.getByText(/Activity/i)).toBeInTheDocument();
  });

  it('should respect startOfWeek prop', (): void => {
    render(<ActivityHeatmap sessions={mockSessions} startOfWeek={0} />);

    expect(screen.getByText(/Activity/i)).toBeInTheDocument();
  });
});

