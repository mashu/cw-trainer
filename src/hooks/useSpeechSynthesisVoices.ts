import { useEffect, useState } from 'react';

export type SpeechVoiceOption = {
  readonly label: string;
  readonly voiceURI: string;
};

type SpeechSynthesisWithEvents = SpeechSynthesis & {
  readonly addEventListener?: (
    type: 'voiceschanged',
    listener: EventListenerOrEventListenerObject,
  ) => void;
  readonly removeEventListener?: (
    type: 'voiceschanged',
    listener: EventListenerOrEventListenerObject,
  ) => void;
};

export function useSpeechSynthesisVoices(): {
  readonly supported: boolean;
  readonly voices: readonly SpeechVoiceOption[];
} {
  const [supported, setSupported] = useState<boolean>(false);
  const [voices, setVoices] = useState<readonly SpeechVoiceOption[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setSupported(false);
      setVoices([]);
      return;
    }

    const synth = window.speechSynthesis as SpeechSynthesisWithEvents;
    setSupported(true);

    const updateVoices = (): void => {
      setVoices(
        synth.getVoices().map((voice) => ({
          label: `${voice.name}${voice.lang ? ` (${voice.lang})` : ''}`,
          voiceURI: voice.voiceURI,
        })),
      );
    };

    updateVoices();
    synth.addEventListener?.('voiceschanged', updateVoices);
    return (): void => {
      synth.removeEventListener?.('voiceschanged', updateVoices);
    };
  }, []);

  return { supported, voices };
}
