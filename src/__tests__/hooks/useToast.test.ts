import { renderHook, act } from '@testing-library/react';

import { useToast } from '@/hooks/useToast';
import { TOAST_DURATION_MS } from '@/lib/constants';

describe('useToast', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('starts with no toast', () => {
    const { result } = renderHook(() => useToast());
    expect(result.current.toast).toBeNull();
  });

  it('showToast displays the message', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast({ message: 'Saved', type: 'success' });
    });

    expect(result.current.toast).toEqual({ message: 'Saved', type: 'success' });
  });

  it('dismissToast clears the toast immediately', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast({ message: 'Error', type: 'error' });
      result.current.dismissToast();
    });

    expect(result.current.toast).toBeNull();
  });

  it('auto-dismisses after TOAST_DURATION_MS', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast({ message: 'Info', type: 'info' });
    });

    act(() => {
      jest.advanceTimersByTime(TOAST_DURATION_MS);
    });

    expect(result.current.toast).toBeNull();
  });

  it('replaces an existing toast and resets the dismiss timer', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast({ message: 'First', type: 'info' });
    });

    act(() => {
      jest.advanceTimersByTime(TOAST_DURATION_MS - 100);
    });

    act(() => {
      result.current.showToast({ message: 'Second', type: 'success' });
    });

    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(result.current.toast?.message).toBe('Second');

    act(() => {
      jest.advanceTimersByTime(TOAST_DURATION_MS);
    });
    expect(result.current.toast).toBeNull();
  });
});
