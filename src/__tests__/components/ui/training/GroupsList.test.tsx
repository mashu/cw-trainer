import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { GroupsList } from '@/components/ui/training/GroupsList';

describe('GroupsList', () => {
  const defaultProps = {
    sentGroups: ['ABC', 'DEF', 'GHI'],
    userInput: ['', '', ''],
    confirmedGroups: {},
    currentFocusedGroup: 0,
    onChange: jest.fn(),
    onConfirm: jest.fn(),
    onFocus: jest.fn(),
    inputRef: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render all groups', () => {
    render(<GroupsList {...defaultProps} />);

    expect(screen.getByText('Group 1')).toBeInTheDocument();
    expect(screen.getByText('Group 2')).toBeInTheDocument();
    expect(screen.getByText('Group 3')).toBeInTheDocument();
  });

  it('should call onChange when input changes', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    render(<GroupsList {...defaultProps} onChange={onChange} />);

    const inputs = screen.getAllByPlaceholderText('Type group answer...');
    await user.type(inputs[0]!, 'A');

    expect(onChange).toHaveBeenCalledWith(0, 'A');
  });

  it('should call onConfirm when Enter is pressed', async () => {
    const user = userEvent.setup();
    const onConfirm = jest.fn();

    render(<GroupsList {...defaultProps} onConfirm={onConfirm} userInput={['ABC', '', '']} />);

    const inputs = screen.getAllByPlaceholderText('Type group answer...');
    await user.type(inputs[0]!, '{Enter}');

    expect(onConfirm).toHaveBeenCalledWith(0);
  });

  it('should call onFocus when input is focused', async () => {
    const user = userEvent.setup();
    const onFocus = jest.fn();

    render(<GroupsList {...defaultProps} onFocus={onFocus} />);

    const inputs = screen.getAllByPlaceholderText('Type group answer...');
    await user.click(inputs[1]!);

    expect(onFocus).toHaveBeenCalledWith(1);
  });

  it('should disable inputs for non-active groups during training', () => {
    render(
      <GroupsList
        {...defaultProps}
        isTraining={true}
        interactiveMode={false}
        currentActiveGroup={0}
      />,
    );

    const inputs = screen.getAllByPlaceholderText(/Type group answer|Waiting/);
    expect(inputs[0]).not.toBeDisabled();
    expect(inputs[1]).toBeDisabled();
    expect(inputs[2]).toBeDisabled();
  });

  it('should not disable inputs in interactive mode', () => {
    render(
      <GroupsList
        {...defaultProps}
        isTraining={true}
        interactiveMode={true}
        currentActiveGroup={0}
      />,
    );

    const inputs = screen.getAllByPlaceholderText('Type group answer...');
    inputs.forEach((input) => {
      expect(input).not.toBeDisabled();
    });
  });

  it('should not disable confirmed groups during training', () => {
    render(
      <GroupsList
        {...defaultProps}
        isTraining={true}
        interactiveMode={false}
        currentActiveGroup={0}
        confirmedGroups={{ 1: true }}
      />,
    );

    const inputs = screen.getAllByPlaceholderText(/Type group answer|Waiting/);
    expect(inputs[0]).not.toBeDisabled();
    expect(inputs[1]).not.toBeDisabled(); // Confirmed, so not disabled
    expect(inputs[2]).toBeDisabled();
  });

  it('should show focused state for current focused group', () => {
    render(<GroupsList {...defaultProps} currentFocusedGroup={1} />);

    expect(screen.getByText('Current')).toBeInTheDocument();
  });

  it('should display confirmed groups correctly', () => {
    render(
      <GroupsList
        {...defaultProps}
        confirmedGroups={{ 0: true, 1: true }}
        userInput={['ABC', 'DEF', '']}
      />,
    );

    expect(screen.getByText('ABC')).toBeInTheDocument();
    expect(screen.getByText('DEF')).toBeInTheDocument();
  });
});

