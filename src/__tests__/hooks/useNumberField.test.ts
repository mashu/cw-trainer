import { renderHook, act } from '@testing-library/react';
import type { ChangeEvent, FocusEvent, MouseEvent } from 'react';

import { useNumberField } from '@/hooks/useNumberField';

function changeEvent(value: string): ChangeEvent<HTMLInputElement> {
  return { target: { value } } as ChangeEvent<HTMLInputElement>;
}

function blurEvent(value: string): FocusEvent<HTMLInputElement> {
  return { target: { value } } as FocusEvent<HTMLInputElement>;
}

function mouseUpEvent(active: boolean): MouseEvent<HTMLInputElement> {
  const target = { value: '5' } as HTMLInputElement;
  if (active) {
    Object.defineProperty(document, 'activeElement', {
      configurable: true,
      value: target,
    });
  }
  return { target } as MouseEvent<HTMLInputElement>;
}

describe('useNumberField', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    Object.defineProperty(document, 'activeElement', {
      configurable: true,
      value: document.body,
    });
  });

  it('initializes value from currentValue', () => {
    const onChange = jest.fn();
    const { result } = renderHook(() =>
      useNumberField(12, { min: 1, max: 40, fieldName: 'kochLevel', onChange }),
    );

    expect(result.current.value).toBe('12');
  });

  it('syncs local value when currentValue changes externally', () => {
    const onChange = jest.fn();
    const { result, rerender } = renderHook(
      ({ value }: { value: number }) =>
        useNumberField(value, { min: 1, max: 40, fieldName: 'kochLevel', onChange }),
      { initialProps: { value: 5 } },
    );

    rerender({ value: 9 });
    expect(result.current.value).toBe('9');
  });

  it('calls onChange with clamped integer on valid blur', () => {
    const onChange = jest.fn();
    const onSave = jest.fn();
    const { result } = renderHook(() =>
      useNumberField(10, { min: 1, max: 40, fieldName: 'kochLevel', onChange, onSave }),
    );

    act(() => {
      result.current.inputProps.onChange(changeEvent('15'));
      result.current.inputProps.onBlur(blurEvent('15'));
    });

    expect(onChange).toHaveBeenCalledWith(15);
    expect(result.current.value).toBe('15');

    act(() => {
      jest.advanceTimersByTime(50);
    });
    expect(onSave).toHaveBeenCalled();
  });

  it('reverts invalid blur to currentValue', () => {
    const onChange = jest.fn();
    const { result } = renderHook(() =>
      useNumberField(10, { min: 1, max: 40, fieldName: 'kochLevel', onChange }),
    );

    act(() => {
      result.current.inputProps.onChange(changeEvent('999'));
      result.current.inputProps.onBlur(blurEvent('999'));
    });

    expect(onChange).not.toHaveBeenCalled();
    expect(result.current.value).toBe('10');
  });

  it('floors fractional step values on valid blur', () => {
    const onChange = jest.fn();
    const { result } = renderHook(() =>
      useNumberField(1.2, { min: 0.5, max: 2, step: 0.1, fieldName: 'qsbDepth', onChange }),
    );

    act(() => {
      result.current.inputProps.onBlur(blurEvent('1.95'));
    });

    expect(onChange).toHaveBeenCalledWith(1.95);
  });

  it('applies spin-button change within the detection window', () => {
    jest.useFakeTimers();
    const onChange = jest.fn();
    const { result } = renderHook(() =>
      useNumberField(10, { min: 1, max: 40, fieldName: 'kochLevel', onChange }),
    );

    act(() => {
      result.current.inputProps.onMouseUp(mouseUpEvent(true));
      result.current.inputProps.onChange(changeEvent('11'));
    });

    expect(onChange).toHaveBeenCalledWith(11);
    jest.useRealTimers();
  });

  it('selects input text on focus', () => {
    const onChange = jest.fn();
    const select = jest.fn();
    const target = { select } as unknown as HTMLInputElement;
    const { result } = renderHook(() =>
      useNumberField(10, { min: 1, max: 40, fieldName: 'kochLevel', onChange }),
    );

    act(() => {
      result.current.inputProps.onFocus({ target } as FocusEvent<HTMLInputElement>);
    });

    expect(select).toHaveBeenCalled();
  });
});
