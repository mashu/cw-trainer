jest.mock('@/lib/morseAudio', () => ({
  playMorseCodeControlled: jest.fn(),
  resumeAudioContextFromUserGesture: jest.fn(),
}));

jest.mock('@/lib/audio/bandConditions', () => ({
  createBandConditionsAudio: jest.fn(() => ({
    update: jest.fn(),
    stop: jest.fn(),
    morseOutput: { node: 'mock' },
  })),
}));

import { renderHook, act } from '@testing-library/react';

import { DEFAULT_TRAINING_SETTINGS } from '@/config/training.config';
import { useTrainingAudio } from '@/hooks/useTrainingAudio';
import { playMorseCodeControlled, resumeAudioContextFromUserGesture } from '@/lib/morseAudio';

const mockPlayMorse = playMorseCodeControlled as jest.MockedFunction<typeof playMorseCodeControlled>;
const mockResume = resumeAudioContextFromUserGesture as jest.MockedFunction<
  typeof resumeAudioContextFromUserGesture
>;

describe('useTrainingAudio', () => {
  const settings = DEFAULT_TRAINING_SETTINGS;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPlayMorse.mockResolvedValue({
      durationSec: 0.5,
      stop: jest.fn(),
    });
  });

  it('returns skippedBecauseAborted when session id does not match', async () => {
    const { result } = renderHook(() => useTrainingAudio(settings));

    result.current.sessionIdRef.current = 2;

    const playback = await result.current.playMorse('AB', 1);

    expect(playback).toEqual({ status: 'skippedBecauseAborted' });
    expect(mockPlayMorse).not.toHaveBeenCalled();
  });

  it('plays morse and returns duration', async () => {
    const { result } = renderHook(() => useTrainingAudio(settings));

    const playback = await result.current.playMorse('KM', 0);

    expect(playback).toEqual({ status: 'played', durationSec: 0.5 });
    expect(mockPlayMorse).toHaveBeenCalled();
  });

  it('resumes suspended AudioContext before playback', async () => {
    const { result } = renderHook(() => useTrainingAudio(settings));

    act(() => {
      result.current.ensureAudioReady();
    });
    const ctx = result.current.audioContextRef.current;
    if (ctx) {
      Object.defineProperty(ctx, 'state', { value: 'suspended', configurable: true });
    }

    await result.current.playMorse('KM', 0);

    expect(mockResume).toHaveBeenCalled();
  });

  it('returns failed when playback throws', async () => {
    mockPlayMorse.mockRejectedValueOnce(new Error('Audio failed'));
    const { result } = renderHook(() => useTrainingAudio(settings));

    const playback = await result.current.playMorse('KM', 0);

    expect(playback.status).toBe('failed');
    if (playback.status === 'failed') {
      expect(playback.message).toBe('Audio failed');
    }
  });

  it('ensureAudioReady creates context and resumes', () => {
    const { result } = renderHook(() => useTrainingAudio(settings));

    act(() => {
      result.current.ensureAudioReady();
    });

    expect(result.current.audioContextRef.current).not.toBeNull();
    expect(mockResume).toHaveBeenCalled();
  });

  it('stopAudio tears down playback and context', () => {
    const { result } = renderHook(() => useTrainingAudio(settings));

    act(() => {
      result.current.ensureAudioReady();
      result.current.stopAudio();
    });

    expect(result.current.audioContextRef.current).toBeNull();
  });

  it('sleepCancelable exits early when aborted', async () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useTrainingAudio(settings));

    result.current.trainingAbortRef.current = true;

    await act(async () => {
      const promise = result.current.sleepCancelable(500, 0);
      jest.advanceTimersByTime(500);
      await promise;
    });

    jest.useRealTimers();
  });

  it('sleepCancelable exits when session id changes', async () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useTrainingAudio(settings));

    await act(async () => {
      const promise = result.current.sleepCancelable(500, 0);
      result.current.sessionIdRef.current = 99;
      jest.advanceTimersByTime(100);
      await promise;
    });

    jest.useRealTimers();
  });
});
