jest.mock('@/lib/morseAudio', () => ({
  playMorseCodeControlled: jest.fn(() => Promise.resolve()),
  resumeAudioContextFromUserGesture: jest.fn(),
}));

jest.mock('@/lib/training/sleepCancelablePolled', () => ({
  sleepCancelablePolled: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/lib/morseSignals', () => {
  const actual = jest.requireActual('@/lib/morseSignals') as Record<string, unknown>;
  const decodeMorsePattern = actual['decodeMorsePattern'] as (pattern: string) => string | null;
  return {
    ...actual,
    decodeMorsePattern: jest.fn(decodeMorsePattern),
  };
});

import { renderHook, act } from '@testing-library/react';

import { DEFAULT_TRAINING_SETTINGS } from '@/config/training.config';
import { useMorseDecoderPractice } from '@/hooks/useMorseDecoderPractice';
import { playMorseCodeControlled, resumeAudioContextFromUserGesture } from '@/lib/morseAudio';
import { decodeMorsePattern } from '@/lib/morseSignals';

const mockPlayMorse = playMorseCodeControlled as jest.MockedFunction<typeof playMorseCodeControlled>;
const mockResumeAudio = resumeAudioContextFromUserGesture as jest.MockedFunction<
  typeof resumeAudioContextFromUserGesture
>;
const mockDecodeMorsePattern = decodeMorsePattern as jest.MockedFunction<typeof decodeMorsePattern>;

function fireKey(type: 'keydown' | 'keyup', code: string, key: string, repeat = false): void {
  window.dispatchEvent(
    new KeyboardEvent(type, {
      code,
      key,
      bubbles: true,
      cancelable: true,
      repeat,
    }),
  );
}

/** Press and release a paddle synchronously so the keyer emits one element. */
function tapPaddle(code: string, key: string): void {
  fireKey('keydown', code, key);
  fireKey('keyup', code, key);
}

describe('useMorseDecoderPractice', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const actualMorseSignals = jest.requireActual('@/lib/morseSignals') as {
      decodeMorsePattern: typeof decodeMorsePattern;
    };
    mockDecodeMorsePattern.mockImplementation(actualMorseSignals.decodeMorsePattern);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const settings = DEFAULT_TRAINING_SETTINGS;

  it('starts empty when enabled', () => {
    const { result } = renderHook(() =>
      useMorseDecoderPractice({ enabled: true, settings }),
    );

    expect(result.current.segments).toEqual([]);
    expect(result.current.livePattern).toBe('');
  });

  it('clear resets segments and live pattern', async () => {
    const { result } = renderHook(() =>
      useMorseDecoderPractice({ enabled: true, settings }),
    );

    act(() => {
      tapPaddle('BracketLeft', '{');
    });

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      result.current.clear();
    });

    expect(result.current.segments).toEqual([]);
    expect(result.current.livePattern).toBe('');
  });

  it('updates livePattern on dit and commits E after letter gap', async () => {
    const { result } = renderHook(() =>
      useMorseDecoderPractice({ enabled: true, settings }),
    );

    act(() => {
      tapPaddle('BracketLeft', '{');
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.livePattern).toBe('.');

    const dotMs = 1200 / 23;
    const letterGapMs = dotMs * 3;

    act(() => {
      jest.advanceTimersByTime(letterGapMs + 10);
    });

    expect(result.current.livePattern).toBe('');
    expect(result.current.segments).toHaveLength(1);
    expect(result.current.segments[0]?.display).toBe('E');
    expect(mockResumeAudio).toHaveBeenCalled();
    expect(mockPlayMorse).toHaveBeenCalled();
  });

  it('decodes dah as T after letter gap', async () => {
    const { result } = renderHook(() =>
      useMorseDecoderPractice({ enabled: true, settings }),
    );

    act(() => {
      tapPaddle('BracketRight', '}');
    });

    await act(async () => {
      await Promise.resolve();
      jest.advanceTimersByTime(500);
    });

    expect(result.current.segments[0]?.display).toBe('T');
  });

  it('ignores repeated keydown events', async () => {
    const { result } = renderHook(() =>
      useMorseDecoderPractice({ enabled: true, settings }),
    );

    await act(async () => {
      fireKey('keydown', 'BracketLeft', '{', true);
      await Promise.resolve();
    });

    expect(result.current.livePattern).toBe('');
    expect(mockPlayMorse).not.toHaveBeenCalled();
  });

  it('does not accept keys when disabled', () => {
    const { result } = renderHook(() =>
      useMorseDecoderPractice({ enabled: false, settings }),
    );

    act(() => {
      tapPaddle('BracketLeft', '{');
      jest.advanceTimersByTime(500);
    });

    expect(result.current.livePattern).toBe('');
    expect(result.current.segments).toEqual([]);
  });

  it('commits replacement character when pattern does not decode', async () => {
    mockDecodeMorsePattern.mockReturnValueOnce(null);

    const { result } = renderHook(() =>
      useMorseDecoderPractice({ enabled: true, settings }),
    );

    act(() => {
      tapPaddle('BracketLeft', '{');
    });

    await act(async () => {
      await Promise.resolve();
      jest.advanceTimersByTime(500);
    });

    expect(result.current.segments[0]?.display).toBe('\uFFFD');
  });
});
