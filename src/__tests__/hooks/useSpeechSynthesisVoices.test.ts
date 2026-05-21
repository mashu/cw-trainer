import { renderHook, act } from '@testing-library/react';

import { useSpeechSynthesisVoices } from '@/hooks/useSpeechSynthesisVoices';

describe('useSpeechSynthesisVoices', () => {
  const originalSpeechSynthesis = window.speechSynthesis;

  afterEach(() => {
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      writable: true,
      value: originalSpeechSynthesis,
    });
  });

  it('reports unsupported when speechSynthesis is absent from window', () => {
    Reflect.deleteProperty(window, 'speechSynthesis');

    const { result } = renderHook(() => useSpeechSynthesisVoices());

    expect(result.current.supported).toBe(false);
    expect(result.current.voices).toEqual([]);
  });

  it('maps voices and listens for voiceschanged', () => {
    const mockVoice = {
      name: 'Test Voice',
      lang: 'en-US',
      voiceURI: 'test-voice-uri',
    } as SpeechSynthesisVoice;

    const synth = {
      getVoices: jest.fn(() => [mockVoice]),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };

    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      writable: true,
      value: synth,
    });

    const { result, unmount } = renderHook(() => useSpeechSynthesisVoices());

    expect(result.current.supported).toBe(true);
    expect(result.current.voices).toEqual([
      { label: 'Test Voice (en-US)', voiceURI: 'test-voice-uri' },
    ]);
    expect(synth.addEventListener).toHaveBeenCalledWith('voiceschanged', expect.any(Function));

    unmount();
    expect(synth.removeEventListener).toHaveBeenCalledWith('voiceschanged', expect.any(Function));
  });

  it('labels voices without lang', () => {
    const mockVoice = {
      name: 'Plain',
      lang: '',
      voiceURI: 'plain-uri',
    } as SpeechSynthesisVoice;

    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      writable: true,
      value: {
        getVoices: jest.fn(() => [mockVoice]),
        addEventListener: undefined,
        removeEventListener: undefined,
      },
    });

    const { result } = renderHook(() => useSpeechSynthesisVoices());

    expect(result.current.voices[0]?.label).toBe('Plain');
  });

  it('updates voices when voiceschanged fires', () => {
    let voicesChangedHandler: (() => void) | undefined;
    const getVoices = jest
      .fn()
      .mockReturnValueOnce([])
      .mockReturnValueOnce([
        { name: 'Later', lang: 'pl', voiceURI: 'later-uri' } as SpeechSynthesisVoice,
      ]);

    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      writable: true,
      value: {
        getVoices,
        addEventListener: jest.fn((type: string, handler: () => void) => {
          if (type === 'voiceschanged') {
            voicesChangedHandler = handler;
          }
        }),
        removeEventListener: jest.fn(),
      },
    });

    const { result } = renderHook(() => useSpeechSynthesisVoices());

    expect(result.current.voices).toEqual([]);

    act(() => {
      voicesChangedHandler?.();
    });

    expect(result.current.voices).toEqual([
      { label: 'Later (pl)', voiceURI: 'later-uri' },
    ]);
  });
});
