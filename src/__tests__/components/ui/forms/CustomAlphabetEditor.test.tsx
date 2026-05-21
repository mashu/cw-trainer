import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CustomAlphabetEditor } from '@/components/ui/forms/CustomAlphabetEditor';

const letters = ['A', 'B', 'C'];
const digitsAsc = ['0', '1', '2'];
const allChars = [...letters, ...digitsAsc];

describe('CustomAlphabetEditor', () => {
  it('loads preset letter sets from quick actions', async () => {
    const user = userEvent.setup();
    const onCustomSetChange = jest.fn();

    render(
      <CustomAlphabetEditor
        customSet={[]}
        onCustomSetChange={onCustomSetChange}
        allChars={allChars}
        letters={letters}
        digitsAsc={digitsAsc}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Letters' }));
    expect(onCustomSetChange).toHaveBeenCalledWith(letters);

    await user.click(screen.getByRole('button', { name: 'All' }));
    expect(onCustomSetChange).toHaveBeenCalledWith(allChars);
  });

  it('adds a character from the available pool', async () => {
    const user = userEvent.setup();
    const onCustomSetChange = jest.fn();

    render(
      <CustomAlphabetEditor
        customSet={['A']}
        onCustomSetChange={onCustomSetChange}
        allChars={allChars}
        letters={letters}
        digitsAsc={digitsAsc}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'B' }));
    expect(onCustomSetChange).toHaveBeenCalledWith(expect.arrayContaining(['A', 'B']));
  });

  it('shows preview of the current set', () => {
    render(
      <CustomAlphabetEditor
        customSet={['A', 'B']}
        onCustomSetChange={jest.fn()}
        allChars={allChars}
        letters={letters}
        digitsAsc={digitsAsc}
      />,
    );

    expect(screen.getByText(/preview/i)).toBeInTheDocument();
    expect(screen.getByText('A B')).toBeInTheDocument();
  });
});
