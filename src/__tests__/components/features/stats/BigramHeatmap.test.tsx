import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  BigramHeatmapView,
  START_TOKEN,
  type BigramCell,
} from '@/components/features/stats/BigramHeatmap';

function buildMatrix(
  letters: readonly string[],
  overrides?: Readonly<Record<string, Partial<BigramCell>>>,
): BigramCell[][] {
  return letters.map((row) =>
    letters.map((col) => {
      const key = `${row}|${col}`;
      const custom = overrides?.[key];
      return {
        row,
        col,
        rate: custom?.rate ?? 0,
        total: custom?.total ?? 0,
        wrong: custom?.wrong ?? 0,
      };
    }),
  );
}

describe('BigramHeatmapView', () => {
  beforeEach(() => {
    Element.prototype.getBoundingClientRect = jest.fn(
      (): DOMRect =>
        ({
          x: 100,
          y: 200,
          width: 28,
          height: 28,
          top: 200,
          left: 100,
          right: 128,
          bottom: 228,
          toJSON: (): Record<string, never> => ({}),
        }) as DOMRect,
    );
  });

  it('shows empty state when there are no letters', () => {
    render(
      <BigramHeatmapView
        letters={[]}
        matrix={[]}
        maxRate={0}
        unigramStats={[]}
        rangeLabel="(last 7 days)"
      />,
    );

    expect(screen.getByText(/No data yet/i)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('renders heatmap title, range label, and column headers', () => {
    const letters = [START_TOKEN, 'A', 'B'] as const;
    const matrix = buildMatrix(letters, {
      [`${START_TOKEN}|A`]: { rate: 0.5, total: 4, wrong: 2 },
    });

    render(
      <BigramHeatmapView
        letters={letters}
        matrix={matrix}
        maxRate={0.5}
        unigramStats={[]}
        rangeLabel="(all time)"
      />,
    );

    expect(screen.getByText(/Bigram Error Heatmap/i)).toBeInTheDocument();
    expect(screen.getByText('(all time)')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'A' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'B' })).toBeInTheDocument();
  });

  it('opens detail panel on cell click and closes via dismiss control', async () => {
    const user = userEvent.setup();
    const letters = [START_TOKEN, 'A'] as const;
    const matrix = buildMatrix(letters, {
      [`${START_TOKEN}|A`]: { rate: 0.25, total: 8, wrong: 2 },
    });

    render(
      <BigramHeatmapView
        letters={letters}
        matrix={matrix}
        maxRate={0.25}
        unigramStats={[]}
        rangeLabel=""
      />,
    );

    const table = screen.getByRole('table');
    const heatmapCount = within(table).getByText('8', { selector: 'span' });
    await user.click(heatmapCount.closest('td')!);

    expect(screen.getByRole('button', { name: /close details/i })).toBeInTheDocument();
    const detailPanel = screen
      .getByRole('button', { name: /close details/i })
      .closest('div.mt-4') as HTMLElement;
    expect(within(detailPanel).getByText(/Total Occurrences/i)).toBeInTheDocument();
    expect(within(detailPanel).getByText('8')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /close details/i }));
    expect(screen.queryByRole('button', { name: /close details/i })).not.toBeInTheDocument();
  });

  it('shows hover tooltip in a portal for cells with data', async () => {
    const user = userEvent.setup();
    const letters = ['A', 'B'] as const;
    const matrix = buildMatrix(letters, {
      'A|B': { rate: 0.5, total: 6, wrong: 3 },
    });

    render(
      <BigramHeatmapView
        letters={letters}
        matrix={matrix}
        maxRate={0.5}
        unigramStats={[]}
        rangeLabel=""
      />,
    );

    const table = screen.getByRole('table');
    const dataCell = within(table).getByText('6');
    await user.hover(dataCell.closest('td')!);

    expect(document.body).toHaveTextContent(/Total Occurrences/i);
    expect(document.body).toHaveTextContent(/Error Rate/i);
  });

  it('caps displayed counts at 99+', () => {
    const letters = ['A'] as const;
    const matrix = buildMatrix(letters, {
      'A|A': { rate: 0.1, total: 120, wrong: 12 },
    });

    render(
      <BigramHeatmapView
        letters={letters}
        matrix={matrix}
        maxRate={0.1}
        unigramStats={[]}
        rangeLabel=""
      />,
    );

    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('renders per-character strip and unigram hover tooltip', async () => {
    const user = userEvent.setup();
    const letters = ['A'] as const;
    const matrix = buildMatrix(letters, { 'A|A': { rate: 0, total: 1, wrong: 0 } });

    render(
      <BigramHeatmapView
        letters={letters}
        matrix={matrix}
        maxRate={0}
        unigramStats={[{ letter: 'A', total: 10, wrong: 2, rate: 0.2 }]}
        rangeLabel=""
      />,
    );

    expect(screen.getByText(/Per-Character Error Rate/i)).toBeInTheDocument();
    const strip = screen.getByText(/Per-Character Error Rate/i).closest('div')!.parentElement!;
    const letterTile = within(strip).getByText('A', { selector: 'span.font-medium' });
    await user.hover(letterTile.closest('div')!);

    expect(document.body).toHaveTextContent(/Per-character error rate/i);
  });

  it('shows no-data message when an empty cell is selected', async () => {
    const user = userEvent.setup();
    const letters = ['A', 'B'] as const;
    const matrix = buildMatrix(letters);

    render(
      <BigramHeatmapView
        letters={letters}
        matrix={matrix}
        maxRate={0}
        unigramStats={[]}
        rangeLabel=""
      />,
    );

    const table = screen.getByRole('table');
    const emptyCells = within(table).getAllByRole('cell').filter((cell) => cell.textContent === '');
    const firstEmpty = emptyCells[0];
    expect(firstEmpty).toBeDefined();
    await user.click(firstEmpty!);

    expect(screen.getByText(/no occurrences for this letter pair/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /close details/i })).toBeInTheDocument();
  });
});
