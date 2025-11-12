import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { SequenceEditorModal } from '@/components/ui/forms/SequenceEditorModal';
import { SEQUENCE_PRESETS } from '@/lib/sequencePresets';

describe('SequenceEditorModal', () => {
  const defaultSequence = ['K', 'M', 'R'];
  const mockOnChange = jest.fn();
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should not render when open is false', () => {
    render(
      <SequenceEditorModal
        open={false}
        onClose={mockOnClose}
        sequence={defaultSequence}
        onChange={mockOnChange}
      />
    );

    expect(screen.queryByText(/Edit Character Sequence/i)).not.toBeInTheDocument();
  });

  it('should render when open is true', () => {
    render(
      <SequenceEditorModal
        open={true}
        onClose={mockOnClose}
        sequence={defaultSequence}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText(/Edit Character Sequence/i)).toBeInTheDocument();
  });

  it('should display sequence characters', () => {
    render(
      <SequenceEditorModal
        open={true}
        onClose={mockOnClose}
        sequence={defaultSequence}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText('K')).toBeInTheDocument();
    expect(screen.getByText('M')).toBeInTheDocument();
    expect(screen.getByText('R')).toBeInTheDocument();
  });

  it('should display sequence count correctly', () => {
    render(
      <SequenceEditorModal
        open={true}
        onClose={mockOnClose}
        sequence={defaultSequence}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText(/Character Sequence \(3 characters\)/i)).toBeInTheDocument();
  });

  it('should show preview section', () => {
    render(
      <SequenceEditorModal
        open={true}
        onClose={mockOnClose}
        sequence={defaultSequence}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText(/Preview:/i)).toBeInTheDocument();
    expect(screen.getByText('K M R')).toBeInTheDocument();
  });

  it('should show empty state when sequence is empty', () => {
    render(
      <SequenceEditorModal
        open={true}
        onClose={mockOnClose}
        sequence={[]}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText(/No characters in sequence/i)).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('should call onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <SequenceEditorModal
        open={true}
        onClose={mockOnClose}
        sequence={defaultSequence}
        onChange={mockOnChange}
      />
    );

    const closeButton = screen.getByLabelText(/Close/i);
    await user.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should call onClose when backdrop is clicked', async () => {
    const user = userEvent.setup();
    render(
      <SequenceEditorModal
        open={true}
        onClose={mockOnClose}
        sequence={defaultSequence}
        onChange={mockOnChange}
      />
    );

    const backdrop = screen.getByText(/Edit Character Sequence/i).closest('.fixed');
    if (backdrop) {
      await user.click(backdrop);
      expect(mockOnClose).toHaveBeenCalled();
    }
  });

  it('should not call onClose when modal content is clicked', async () => {
    const user = userEvent.setup();
    render(
      <SequenceEditorModal
        open={true}
        onClose={mockOnClose}
        sequence={defaultSequence}
        onChange={mockOnChange}
      />
    );

    const modalContent = screen.getByText(/Edit Character Sequence/i).closest('.bg-white');
    if (modalContent) {
      await user.click(modalContent);
      expect(mockOnClose).not.toHaveBeenCalled();
    }
  });

  it('should call onChange when preset is selected', async () => {
    const user = userEvent.setup();
    render(
      <SequenceEditorModal
        open={true}
        onClose={mockOnClose}
        sequence={defaultSequence}
        onChange={mockOnChange}
      />
    );

    const select = screen.getByRole('combobox');
    const kochPreset = SEQUENCE_PRESETS.find((p) => p.id === 'koch');
    if (kochPreset) {
      await user.selectOptions(select, 'koch');

      expect(mockOnChange).toHaveBeenCalled();
      const lastCall = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1];
      expect(Array.isArray(lastCall[0])).toBe(true);
    }
  });

  it('should show custom option when sequence is modified', () => {
    const customSequence = ['A', 'B', 'C'];
    render(
      <SequenceEditorModal
        open={true}
        onClose={mockOnClose}
        sequence={customSequence}
        onChange={mockOnChange}
      />
    );

    const select = screen.getByRole('combobox');
    expect(select).toHaveValue('custom');
    expect(screen.getByText(/Custom sequence active/i)).toBeInTheDocument();
  });

  it('should show reset button when custom', () => {
    const customSequence = ['A', 'B', 'C'];
    render(
      <SequenceEditorModal
        open={true}
        onClose={mockOnClose}
        sequence={customSequence}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText(/Reset to/i)).toBeInTheDocument();
  });

  it('should call onChange when reset button is clicked', async () => {
    const user = userEvent.setup();
    const customSequence = ['A', 'B', 'C'];
    render(
      <SequenceEditorModal
        open={true}
        onClose={mockOnClose}
        sequence={customSequence}
        onChange={mockOnChange}
      />
    );

    const resetButton = screen.getByText(/Reset to/i);
    await user.click(resetButton);

    expect(mockOnChange).toHaveBeenCalled();
  });

  it('should call onChange when shuffle button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <SequenceEditorModal
        open={true}
        onClose={mockOnClose}
        sequence={defaultSequence}
        onChange={mockOnChange}
      />
    );

    const shuffleButton = screen.getByTitle(/Randomize order/i);
    await user.click(shuffleButton);

    expect(mockOnChange).toHaveBeenCalled();
    const lastCall = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1];
    expect(Array.isArray(lastCall[0])).toBe(true);
    expect(lastCall[0].length).toBe(defaultSequence.length);
  });

  it('should call onChange when character is added', async () => {
    const user = userEvent.setup();
    render(
      <SequenceEditorModal
        open={true}
        onClose={mockOnClose}
        sequence={defaultSequence}
        onChange={mockOnChange}
      />
    );

    // Find a character that's not in the sequence (e.g., 'A')
    const addButtons = screen.getAllByRole('button');
    const addButton = addButtons.find((btn) => btn.textContent === 'A' && btn.title?.includes('A'));
    if (addButton) {
      await user.click(addButton);
      expect(mockOnChange).toHaveBeenCalled();
      const lastCall = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1];
      expect(lastCall[0]).toContain('A');
    }
  });

  it('should call onChange when character is removed', async () => {
    const user = userEvent.setup();
    render(
      <SequenceEditorModal
        open={true}
        onClose={mockOnClose}
        sequence={defaultSequence}
        onChange={mockOnChange}
      />
    );

    // Find the K character container
    const kCharContainer = screen.getByText('K').closest('[draggable="true"]');
    expect(kCharContainer).toBeInTheDocument();

    // Hover over the container to show the remove button
    await user.hover(kCharContainer!);

    // Find all remove buttons and click the first one (for K)
    const removeButtons = screen.getAllByTitle(/Remove character/i);
    expect(removeButtons.length).toBeGreaterThan(0);
    await user.click(removeButtons[0]);

    expect(mockOnChange).toHaveBeenCalled();
    const lastCall = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1];
    expect(lastCall[0].length).toBe(defaultSequence.length - 1);
    expect(lastCall[0]).not.toContain('K');
  });

  it('should filter out characters already in sequence from available chars', () => {
    render(
      <SequenceEditorModal
        open={true}
        onClose={mockOnClose}
        sequence={defaultSequence}
        onChange={mockOnChange}
      />
    );

    // Characters K, M, R should not appear in "Add Characters" section
    const addSection = screen.getByText(/Add Characters/i);
    expect(addSection).toBeInTheDocument();

    // Verify K, M, R are not in the available chars section
    const availableCharButtons = screen
      .getByText(/Add Characters/i)
      .closest('div')
      ?.querySelectorAll('button');
    if (availableCharButtons) {
      const buttonTexts = Array.from(availableCharButtons).map((btn) => btn.textContent);
      expect(buttonTexts).not.toContain('K');
      expect(buttonTexts).not.toContain('M');
      expect(buttonTexts).not.toContain('R');
    }
  });

  it('should handle drag and drop reordering', () => {
    render(
      <SequenceEditorModal
        open={true}
        onClose={mockOnClose}
        sequence={defaultSequence}
        onChange={mockOnChange}
      />
    );

    const kChar = screen.getByText('K').closest('[draggable="true"]');
    const mChar = screen.getByText('M').closest('[draggable="true"]');

    expect(kChar).toBeInTheDocument();
    expect(mChar).toBeInTheDocument();

    if (kChar && mChar) {
      // Create a mock dataTransfer object
      const mockDataTransfer = {
        effectAllowed: 'move',
        dropEffect: 'move',
      };

      // Simulate drag start on K
      fireEvent.dragStart(kChar, {
        dataTransfer: mockDataTransfer,
      });

      // Simulate drag over on M
      fireEvent.dragOver(mChar, {
        dataTransfer: mockDataTransfer,
        preventDefault: jest.fn(),
      });

      // Simulate drop on M
      fireEvent.drop(mChar, {
        dataTransfer: mockDataTransfer,
        preventDefault: jest.fn(),
      });

      // onChange should be called with reordered sequence
      expect(mockOnChange).toHaveBeenCalled();
      const lastCall = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1];
      expect(Array.isArray(lastCall[0])).toBe(true);
      expect(lastCall[0].length).toBe(defaultSequence.length);
    }
  });

  it('should call onClose when Done button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <SequenceEditorModal
        open={true}
        onClose={mockOnClose}
        sequence={defaultSequence}
        onChange={mockOnChange}
      />
    );

    const doneButton = screen.getByRole('button', { name: /Done/i });
    await user.click(doneButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should detect matching preset on mount', () => {
    const kochPreset = SEQUENCE_PRESETS.find((p) => p.id === 'koch');
    if (kochPreset) {
      render(
        <SequenceEditorModal
          open={true}
          onClose={mockOnClose}
          sequence={kochPreset.sequence}
          onChange={mockOnChange}
        />
      );

      const select = screen.getByRole('combobox');
      expect(select).toHaveValue('koch');
      expect(screen.queryByText(/Custom sequence active/i)).not.toBeInTheDocument();
    }
  });

  it('should update preset selection when sequence changes', async () => {
    const kochPreset = SEQUENCE_PRESETS.find((p) => p.id === 'koch');
    if (kochPreset) {
      const { rerender } = render(
        <SequenceEditorModal
          open={true}
          onClose={mockOnClose}
          sequence={kochPreset.sequence}
          onChange={mockOnChange}
        />
      );

      // Initially should show koch preset
      const select = screen.getByRole('combobox');
      expect(select).toHaveValue('koch');

      // Change to custom sequence
      rerender(
        <SequenceEditorModal
          open={true}
          onClose={mockOnClose}
          sequence={['A', 'B', 'C']}
          onChange={mockOnChange}
        />
      );

      await waitFor(() => {
        expect(select).toHaveValue('custom');
      });
    }
  });
});

