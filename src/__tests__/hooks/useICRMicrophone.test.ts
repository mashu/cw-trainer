import { renderHook, act } from '@testing-library/react';

import { useICRMicrophone } from '@/hooks/useICRMicrophone';
import { ensureContext } from '@/lib/morseAudio';

jest.mock('@/lib/morseAudio', () => ({
  ensureContext: jest.fn(() => Promise.resolve()),
}));

const mockEnsureContext = ensureContext as jest.MockedFunction<typeof ensureContext>;

describe('useICRMicrophone', () => {
  const mockTrackStop = jest.fn();
  const mockAnalyser = {
    fftSize: 2048,
    smoothingTimeConstant: 0.8,
    connect: jest.fn(),
    disconnect: jest.fn(),
    getByteTimeDomainData: jest.fn((buffer: Uint8Array) => {
      buffer.fill(200);
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockEnsureContext.mockResolvedValue(undefined);

    const createMediaStreamSource = jest.fn(() => ({
      connect: jest.fn(),
      disconnect: jest.fn(),
    }));

    const createAnalyser = jest.fn(() => mockAnalyser);
    const createGain = jest.fn(() => ({
      gain: { value: 0 },
      connect: jest.fn(),
      disconnect: jest.fn(),
    }));

    global.AudioContext = jest.fn().mockImplementation(() => ({
      state: 'running',
      currentTime: 1,
      destination: {},
      resume: jest.fn().mockResolvedValue(undefined),
      close: jest.fn(),
      createMediaStreamSource,
      createAnalyser,
      createGain,
    })) as unknown as typeof AudioContext;

    Object.defineProperty(global.navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: jest.fn().mockResolvedValue({
          getTracks: () => [{ stop: mockTrackStop }],
        }),
        enumerateDevices: jest.fn().mockResolvedValue([]),
      },
    });
  });

  it('measureInputLevel returns 0 without analyser', () => {
    const { result } = renderHook(() => useICRMicrophone());
    expect(result.current.measureInputLevel()).toBe(0);
  });

  it('setupAudioContext creates and resumes context', async () => {
    const { result } = renderHook(() => useICRMicrophone());

    let ctx: AudioContext | undefined;
    await act(async () => {
      ctx = await result.current.setupAudioContext();
    });

    expect(ctx).toBeDefined();
    expect(result.current.audioContextRef.current).toBe(ctx);
    expect(mockEnsureContext).toHaveBeenCalled();
  });

  it('setupMic wires stream, analyser, and silent gain', async () => {
    const { result } = renderHook(() => useICRMicrophone());

    await act(async () => {
      await result.current.setupMic('device-1');
    });

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: { deviceId: { ideal: 'device-1' } },
      video: false,
    });
    expect(result.current.analyserRef.current).toBe(mockAnalyser);
    expect(result.current.mediaStreamRef.current).not.toBeNull();
  });

  it('measureInputLevel reads peak from analyser buffer', async () => {
    const { result } = renderHook(() => useICRMicrophone());

    await act(async () => {
      await result.current.setupMic();
    });

    const level = result.current.measureInputLevel();
    expect(level).toBeGreaterThan(0);
    expect(mockAnalyser.getByteTimeDomainData).toHaveBeenCalled();
  });

  it('stopMic stops tracks and clears refs', async () => {
    const { result } = renderHook(() => useICRMicrophone());

    await act(async () => {
      await result.current.setupMic();
    });

    act(() => {
      result.current.stopMic();
    });

    expect(mockTrackStop).toHaveBeenCalled();
    expect(result.current.mediaStreamRef.current).toBeNull();
    expect(result.current.analyserRef.current).toBeNull();
  });
});
