import { renderHook, act } from '@testing-library/react';

import { useNumberInputHelpers } from '@/hooks/useNumberInput';

describe('useNumberInputHelpers', () => {
  it('commits valid spin-button values without waiting for blur', () => {
    jest.useFakeTimers();
    const onValid = jest.fn();
    const setLocalState = jest.fn();
    const { result } = renderHook(() => useNumberInputHelpers());

    act(() => {
      result.current.handleSpinButtonClick('wpm');
      result.current.handleNumberInputChange('22', setLocalState, 'wpm', (n) => n >= 5 && n <= 40, onValid);
    });

    expect(setLocalState).toHaveBeenCalledWith('22');
    expect(onValid).toHaveBeenCalledWith(22);
    jest.useRealTimers();
  });

  it('ignores spin-button path when field name does not match', () => {
    jest.useFakeTimers();
    const onValid = jest.fn();
    const setLocalState = jest.fn();
    const { result } = renderHook(() => useNumberInputHelpers());

    act(() => {
      result.current.handleSpinButtonClick('other');
      result.current.handleNumberInputChange('22', setLocalState, 'wpm', (n) => n >= 5 && n <= 40, onValid);
    });

    expect(onValid).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('reverts invalid blur and calls onValid for valid blur', () => {
    jest.useFakeTimers();
    const onSave = jest.fn();
    const onValid = jest.fn();
    const setLocalState = jest.fn();
    const { result } = renderHook(() => useNumberInputHelpers(onSave));

    act(() => {
      result.current.handleNumberInputBlur('bad', setLocalState, () => false, onValid, 10);
    });
    expect(setLocalState).toHaveBeenCalledWith('10');
    expect(onValid).not.toHaveBeenCalled();

    act(() => {
      result.current.handleNumberInputBlur('12', setLocalState, (n) => n >= 1 && n <= 40, onValid, 10);
    });
    expect(setLocalState).toHaveBeenCalledWith('12');
    expect(onValid).toHaveBeenCalledWith(12);

    act(() => {
      jest.advanceTimersByTime(50);
    });
    expect(onSave).toHaveBeenCalled();
    jest.useRealTimers();
  });
});
