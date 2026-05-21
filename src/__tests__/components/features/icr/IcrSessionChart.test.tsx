import { render, screen } from '@testing-library/react';
import React from 'react';

import { IcrSessionChart } from '@/components/features/icr/IcrSessionChart';
import { DEFAULT_ICR_SETTINGS } from '@/config/training.config';

jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }): JSX.Element => (
    <div>{children}</div>
  ),
  ComposedChart: ({ children }: { children: React.ReactNode }): JSX.Element => (
    <div data-testid="composed-chart">{children}</div>
  ),
  ScatterChart: ({ children }: { children: React.ReactNode }): JSX.Element => (
    <div data-testid="scatter-chart">{children}</div>
  ),
  Bar: ({
    onClick,
    children,
  }: {
    onClick?: (payload: unknown) => void;
    children?: React.ReactNode;
  }): JSX.Element => (
    <div
      data-testid="icr-bar"
      onClick={() => onClick?.({ letter: 'K', payload: { letter: 'K', acc: 0.85 } })}
    >
      {children}
    </div>
  ),
  Scatter: (): JSX.Element => <div data-testid="icr-scatter" />,
  Line: (): JSX.Element => <div />,
  XAxis: (): JSX.Element => <div />,
  YAxis: (): JSX.Element => <div />,
  CartesianGrid: (): JSX.Element => <div />,
  Tooltip: (): JSX.Element => <div />,
  Legend: (): JSX.Element => <div />,
  Cell: (): JSX.Element => <div />,
}));

const bars = [
  { letter: 'K', index: 0, adjAvg: 350, avg: 360, acc: 0.9, total: 10 },
] as const;

describe('IcrSessionChart', () => {
  it('renders bar and scatter charts', () => {
    render(
      <IcrSessionChart
        bars={[...bars]}
        dotsCorrectCat={[{ letter: 'K', reaction: 300 }]}
        dotsWrongCat={[]}
        icrSettings={DEFAULT_ICR_SETTINGS}
      />,
    );

    expect(screen.getByTestId('composed-chart')).toBeInTheDocument();
    expect(screen.getByTestId('scatter-chart')).toBeInTheDocument();
  });

  it('shows click hint and forwards letter clicks when handler provided', () => {
    const onLetterClick = jest.fn();

    render(
      <IcrSessionChart
        bars={[...bars]}
        dotsCorrectCat={[]}
        dotsWrongCat={[]}
        icrSettings={DEFAULT_ICR_SETTINGS}
        onLetterClick={onLetterClick}
      />,
    );

    expect(screen.getByText(/click a bar or dot/i)).toBeInTheDocument();
    screen.getByTestId('icr-bar').click();
    expect(onLetterClick).toHaveBeenCalledWith('K');
  });
});
