'use client';

import { useCallback, useRef } from 'react';

import { ensureContext } from '@/lib/morseAudio';

export interface ICRMicrophoneEngine {
  /** Set up or resume the shared AudioContext. */
  readonly setupAudioContext: () => Promise<AudioContext>;
  /** Acquire mic stream and wire up the AnalyserNode. */
  readonly setupMic: (deviceId?: string) => Promise<void>;
  /** Stop mic tracks and disconnect analyser. */
  readonly stopMic: () => void;
  /** Measure current mic input level (0..1). */
  readonly measureInputLevel: () => number;
  /** Direct ref to the AudioContext (needed for playback). */
  readonly audioContextRef: React.MutableRefObject<AudioContext | null>;
  /** Wall-clock time when AudioContext was created/resumed. */
  readonly audioContextBaseTimeRef: React.MutableRefObject<number | null>;
  /** Direct ref to the AnalyserNode (needed for VAD). */
  readonly analyserRef: React.MutableRefObject<AnalyserNode | null>;
  /** Direct ref to the media stream (needed for cleanup). */
  readonly mediaStreamRef: React.MutableRefObject<MediaStream | null>;
}

/**
 * Manages microphone acquisition, AudioContext lifecycle, and audio level measurement
 * for ICR (Instant Character Recognition) training.
 */
export function useICRMicrophone(): ICRMicrophoneEngine {
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioContextBaseTimeRef = useRef<number | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const setupAudioContext = useCallback(async (): Promise<AudioContext> => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
      audioContextBaseTimeRef.current =
        Date.now() - audioContextRef.current.currentTime * 1000;
    }
    await ensureContext(audioContextRef.current);
    if (audioContextRef.current.state === 'running') {
      const ctx = audioContextRef.current;
      audioContextBaseTimeRef.current = Date.now() - ctx.currentTime * 1000;
    }
    return audioContextRef.current;
  }, []);

  const setupMic = useCallback(
    async (deviceId?: string): Promise<void> => {
      // Tear down previous stream
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
      const constraints: MediaStreamConstraints = {
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
        video: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaStreamRef.current = stream;
      const ctx = await setupAudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyserRef.current = analyser;
    },
    [setupAudioContext],
  );

  const stopMic = useCallback((): void => {
    try {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
    } catch { /* no-op */ }
    try {
      analyserRef.current?.disconnect();
    } catch { /* no-op */ }
    analyserRef.current = null;
  }, []);

  const measureInputLevel = useCallback((): number => {
    const analyser = analyserRef.current;
    if (!analyser) return 0;
    const buffer = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(buffer);
    let peak = 0;
    for (let i = 0; i < buffer.length; i++) {
      const sample = buffer[i];
      if (sample === undefined) continue;
      const v = Math.abs(sample - 128) / 128;
      if (v > peak) peak = v;
    }
    return peak;
  }, []);

  return {
    setupAudioContext,
    setupMic,
    stopMic,
    measureInputLevel,
    audioContextRef,
    audioContextBaseTimeRef,
    analyserRef,
    mediaStreamRef,
  };
}
