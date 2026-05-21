import { renderHook, act } from '@testing-library/react';

import { useVAD } from '@/hooks/useVAD';

describe('useVAD', () => {
  let rafId = 0;
  let rafCallback: FrameRequestCallback | null = null;

  beforeEach(() => {
    jest.useFakeTimers();
    rafId = 0;
    rafCallback = null;
    global.requestAnimationFrame = jest.fn((cb: FrameRequestCallback) => {
      rafCallback = cb;
      rafId += 1;
      return rafId;
    }) as typeof requestAnimationFrame;
    global.cancelAnimationFrame = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const runFrame = (): void => {
    const cb = rafCallback;
    rafCallback = null;
    cb?.(0);
  };

  const config = { vadEnabled: true, vadThreshold: 0.5, vadHoldMs: 80 };

  it('does not start when VAD is disabled', () => {
    const measure = jest.fn(() => 0);
    const { result } = renderHook(() =>
      useVAD({ ...config, vadEnabled: false }, measure, { current: null }, { current: null }),
    );

    act(() => {
      result.current.start();
    });

    expect(requestAnimationFrame).not.toHaveBeenCalled();
    expect(result.current.activeRef.current).toBe(false);
  });

  it('fires stop resolver after hold duration when armed', () => {
    const measure = jest.fn(() => 0.9);
    const audioEndAtRef = { current: null as number | null };
    const heardAtRef = { current: Date.now() - 500 };
    const onStop = jest.fn();
    let perfNow = 1000;
    const perfSpy = jest.spyOn(performance, 'now').mockImplementation(() => perfNow);

    const { result } = renderHook(() =>
      useVAD(config, measure, audioEndAtRef, heardAtRef),
    );

    act(() => {
      result.current.setStopResolver('trial-1', onStop);
      result.current.start();
      result.current.arm();
      runFrame();
      perfNow = 1100;
      runFrame();
    });

    perfSpy.mockRestore();
    expect(onStop).toHaveBeenCalledWith(expect.any(Number));
    expect(result.current.armedRef.current).toBe(false);
  });

  it('ignores input while audio is still playing', () => {
    const measure = jest.fn(() => 0.9);
    const audioEndAtRef = { current: Date.now() + 60_000 };
    const heardAtRef = { current: Date.now() - 500 };
    const onStop = jest.fn();

    const { result } = renderHook(() =>
      useVAD(config, measure, audioEndAtRef, heardAtRef),
    );

    act(() => {
      result.current.setStopResolver('trial-1', onStop);
      result.current.start();
      result.current.arm();
      runFrame();
      jest.advanceTimersByTime(200);
      runFrame();
    });

    expect(onStop).not.toHaveBeenCalled();
    expect(measure).not.toHaveBeenCalled();
  });

  it('rejects implausibly fast reactions as echo', () => {
    const measure = jest.fn(() => 0.9);
    const audioEndAtRef = { current: null as number | null };
    const now = Date.now();
    const heardAtRef = { current: now - 10 };
    const onStop = jest.fn();

    const { result } = renderHook(() =>
      useVAD(config, measure, audioEndAtRef, heardAtRef),
    );

    act(() => {
      result.current.setStopResolver('trial-1', onStop);
      result.current.start();
      result.current.arm();
      runFrame();
      jest.advanceTimersByTime(100);
      runFrame();
    });

    expect(onStop).not.toHaveBeenCalled();
  });

  it('stop cancels the animation loop', () => {
    const measure = jest.fn(() => 0);
    const { result } = renderHook(() =>
      useVAD(config, measure, { current: null }, { current: null }),
    );

    act(() => {
      result.current.start();
      result.current.stop();
    });

    expect(cancelAnimationFrame).toHaveBeenCalled();
    expect(result.current.activeRef.current).toBe(false);
  });

  it('manages trial resolvers', () => {
    const measure = jest.fn(() => 0);
    const { result } = renderHook(() =>
      useVAD(config, measure, { current: null }, { current: null }),
    );

    const resolver = jest.fn();
    act(() => {
      result.current.setStopResolver('a', resolver);
      result.current.clearStopResolver('a');
      result.current.setStopResolver('b', resolver);
      result.current.clearAllResolvers();
    });

    expect(result.current.armedRef.current).toBe(false);
  });
});
