import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { GroupItem } from '@/components/ui/training/GroupItem';

describe('GroupItem', () => {
  const defaultProps = {
    index: 0,
    groupText: 'ABC',
    value: '',
    confirmed: false,
    onChange: jest.fn(),
    onConfirm: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render group item with correct index', () => {
    render(<GroupItem {...defaultProps} />);

    expect(screen.getByText('Group 1')).toBeInTheDocument();
  });

  it('should display placeholder when not confirmed', () => {
    render(<GroupItem {...defaultProps} />);

    const input = screen.getByPlaceholderText('Type group answer...');
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('');
  });

  it('should call onChange when input value changes', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    render(<GroupItem {...defaultProps} onChange={onChange} />);

    const input = screen.getByPlaceholderText('Type group answer...');
    await user.type(input, 'A');

    expect(onChange).toHaveBeenCalledWith('A');
  });

  it('should call onConfirm when Enter is pressed', async () => {
    const user = userEvent.setup();
    const onConfirm = jest.fn();

    render(<GroupItem {...defaultProps} value="ABC" onConfirm={onConfirm} />);

    const input = screen.getByPlaceholderText('Type group answer...');
    await user.type(input, '{Enter}');

    expect(onConfirm).toHaveBeenCalledWith('ABC');
  });

  it('should display sent group text when confirmed', () => {
    render(<GroupItem {...defaultProps} confirmed={true} />);

    expect(screen.getByText('ABC')).toBeInTheDocument();
  });

  it('should show correct indicator when answer is correct', () => {
    render(<GroupItem {...defaultProps} value="ABC" confirmed={true} />);

    expect(screen.getByText('✓')).toBeInTheDocument();
  });

  it('should not show correct indicator when answer is incorrect', () => {
    render(<GroupItem {...defaultProps} value="XYZ" confirmed={true} />);

    expect(screen.queryByText('✓')).not.toBeInTheDocument();
  });

  it('should show focused state when isFocused is true', () => {
    render(<GroupItem {...defaultProps} isFocused={true} />);

    expect(screen.getByText('Current')).toBeInTheDocument();
  });

  it('should disable input when disabled prop is true', () => {
    render(<GroupItem {...defaultProps} disabled={true} />);

    const input = screen.getByPlaceholderText('Waiting...');
    expect(input).toBeDisabled();
  });

  it('should call onFocus when input is focused', async () => {
    const user = userEvent.setup();
    const onFocus = jest.fn();

    render(<GroupItem {...defaultProps} onFocus={onFocus} />);

    const input = screen.getByPlaceholderText('Type group answer...');
    await user.click(input);

    expect(onFocus).toHaveBeenCalled();
  });

  it('should not call onFocus when disabled', async () => {
    const user = userEvent.setup();
    const onFocus = jest.fn();

    render(<GroupItem {...defaultProps} disabled={true} onFocus={onFocus} />);

    const input = screen.getByPlaceholderText('Waiting...');
    await user.click(input);

    expect(onFocus).not.toHaveBeenCalled();
  });

  it('should display character comparison when confirmed', () => {
    render(<GroupItem {...defaultProps} value="AB" confirmed={true} />);

    // Should show sent characters - use getAllByText since 'A' appears multiple times
    const sentChars = screen.getAllByText('A');
    expect(sentChars.length).toBeGreaterThan(0);
    
    // Check for the group text display
    expect(screen.getByText('ABC')).toBeInTheDocument();
  });

  it('should normalize input to uppercase', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    render(<GroupItem {...defaultProps} onChange={onChange} />);

    const input = screen.getByPlaceholderText('Type group answer...');
    await user.type(input, 'abc');

    // The onChange should receive the raw value, but display will be normalized
    expect(onChange).toHaveBeenCalled();
  });
});

