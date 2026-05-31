'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { usePreviewPlayback } from '@/hooks/usePreviewPlayback';
import { defaultCharPreviewIndex, splitLettersAndDigits } from '@/lib/charPreviewUtils';
import { playMorseCodeControlled } from '@/lib/morseAudio';
import { computeCharPool } from '@/lib/trainingUtils';
import type { CharacterSetMode, TrainingSettings } from '@/types';

import { CharPreviewStrip } from './CharPreviewStrip';

interface NewLetterPlayerProps {
  settings: Pick<
    TrainingSettings,
    | 'kochLevel'
    | 'charWpmMin'
    | 'charWpmMax'
    | 'effectiveWpmMin'
    | 'effectiveWpmMax'
    | 'sideToneMin'
    | 'sideToneMax'
    | 'volumeMin'
    | 'volumeMax'
    | 'linkVolume'
    | 'steepness'
    | 'envelopeSmoothing'
  > & {
    charSetMode?: CharacterSetMode;
    digitsLevel?: number;
    customSet?: readonly string[];
    customSequence?: readonly string[];
    slidingWindowStart?: number;
    slidingWindowEnd?: number;
  };
}

function poolSettingsFrom(
  settings: NewLetterPlayerProps['settings'],
): Parameters<typeof computeCharPool>[0] {
  return {
    kochLevel: settings.kochLevel,
    ...(settings.charSetMode !== undefined ? { charSetMode: settings.charSetMode } : {}),
    ...(settings.digitsLevel !== undefined ? { digitsLevel: settings.digitsLevel } : {}),
    ...(settings.customSet && settings.customSet.length > 0
      ? { customSet: [...settings.customSet] }
      : {}),
    ...(settings.customSequence && settings.customSequence.length > 0
      ? { customSequence: [...settings.customSequence] }
      : {}),
    ...(settings.slidingWindowStart !== undefined
      ? { slidingWindowStart: settings.slidingWindowStart }
      : {}),
    ...(settings.slidingWindowEnd !== undefined
      ? { slidingWindowEnd: settings.slidingWindowEnd }
      : {}),
  };
}

function useSelectableIndex(defaultIndex: number): {
  readonly selectedIndex: number;
  readonly setIndex: (index: number) => void;
} {
  const [userIndex, setUserIndex] = useState<number | null>(null);

  useEffect(() => {
    setUserIndex(null);
  }, [defaultIndex]);

  return {
    selectedIndex: userIndex ?? defaultIndex,
    setIndex: setUserIndex,
  };
}

export function NewLetterPlayer({ settings }: NewLetterPlayerProps): JSX.Element | null {
  const { takePlayback: takeLock, releasePlayback: releaseLock } =
    usePreviewPlayback('letter-preview');
  const charSetMode = settings.charSetMode ?? 'koch';
  const isMixed = charSetMode === 'mixed';
  const isDigitsOnly = charSetMode === 'digits';
  const isKochLevelOne = !isMixed && !isDigitsOnly && settings.kochLevel === 1;

  const [isPlaying, setIsPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const durationDoneTimeoutRef = useRef<number | undefined>(undefined);

  const clearDurationDoneTimeout = useCallback((): void => {
    if (durationDoneTimeoutRef.current !== undefined) {
      window.clearTimeout(durationDoneTimeoutRef.current);
      durationDoneTimeoutRef.current = undefined;
    }
  }, []);

  useEffect(() => {
    return (): void => {
      clearDurationDoneTimeout();
      releaseLock();
    };
  }, [clearDurationDoneTimeout, releaseLock]);

  const charPool = useMemo(() => computeCharPool(poolSettingsFrom(settings)), [settings]);

  const previousLevelPool = useMemo(() => {
    const base = poolSettingsFrom(settings);
    if (isDigitsOnly) {
      const prevDigits = Math.max(1, (settings.digitsLevel ?? 10) - 1);
      if (prevDigits >= (settings.digitsLevel ?? 10)) return [];
      return computeCharPool({ ...base, digitsLevel: prevDigits });
    }
    if (isMixed) {
      const prevKoch = Math.max(1, settings.kochLevel - 1);
      const prevDigits = Math.max(1, (settings.digitsLevel ?? 10) - 1);
      if (prevKoch >= settings.kochLevel && prevDigits >= (settings.digitsLevel ?? 10)) {
        return [];
      }
      return computeCharPool({
        ...base,
        kochLevel: prevKoch,
        digitsLevel: prevDigits,
      });
    }
    if (settings.kochLevel <= 1) return [];
    return computeCharPool({ ...base, kochLevel: settings.kochLevel - 1 });
  }, [settings, isMixed, isDigitsOnly]);

  const { letters: lettersPool, digits: digitsPool } = useMemo(
    () => splitLettersAndDigits(charPool),
    [charPool],
  );
  const { letters: previousLettersPool, digits: previousDigitsPool } = useMemo(
    () => splitLettersAndDigits(previousLevelPool),
    [previousLevelPool],
  );

  const singlePool = isMixed ? lettersPool : charPool;
  const singlePreviousPool = isMixed ? previousLettersPool : previousLevelPool;

  const defaultSingleIndex = useMemo(
    () => defaultCharPreviewIndex(singlePool, singlePreviousPool),
    [singlePool, singlePreviousPool],
  );
  const defaultDigitsIndex = useMemo(
    () => defaultCharPreviewIndex(digitsPool, previousDigitsPool),
    [digitsPool, previousDigitsPool],
  );

  const singleNav = useSelectableIndex(defaultSingleIndex);
  const digitsNav = useSelectableIndex(defaultDigitsIndex);

  const pickToneHz = useCallback((): number => {
    const min = Math.max(100, settings.sideToneMin);
    const max = Math.max(min, settings.sideToneMax);
    if (min === max) return min;
    return Math.floor(min + Math.random() * (max - min + 1));
  }, [settings.sideToneMin, settings.sideToneMax]);

  const stopPlayback = useCallback((): void => {
    clearDurationDoneTimeout();
    if (stopRef.current) {
      stopRef.current();
      stopRef.current = null;
    }
    setIsPlaying(false);
    releaseLock();
  }, [clearDurationDoneTimeout, releaseLock]);

  const playCharacters = useCallback(
    async (chars: readonly string[]): Promise<void> => {
      if (chars.length === 0) return;

      if (isPlaying) {
        stopPlayback();
      }

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      const ctx = audioContextRef.current;

      try {
        setIsPlaying(true);
        takeLock();
        const textToPlay = chars.join(' ');
        const { stop, durationSec } = await playMorseCodeControlled(
          ctx,
          textToPlay,
          {
            charWpmMin: Math.max(1, settings.charWpmMin),
            charWpmMax: Math.max(1, settings.charWpmMax),
            effectiveWpmMin: Math.max(1, settings.effectiveWpmMin),
            effectiveWpmMax: Math.max(1, settings.effectiveWpmMax),
            sideTone: pickToneHz(),
            steepness: settings.steepness,
            envelopeSmoothing: settings.envelopeSmoothing ?? 0,
            volumeMin: settings.volumeMin ?? 1,
            volumeMax: settings.volumeMax ?? 1,
            linkVolume: settings.linkVolume ?? true,
          },
          () => false,
        );
        stopRef.current = stop;

        const durationMs = Math.ceil((durationSec || 0) * 1000) + 100;
        clearDurationDoneTimeout();
        durationDoneTimeoutRef.current = window.setTimeout(() => {
          durationDoneTimeoutRef.current = undefined;
          setIsPlaying(false);
          releaseLock();
          stopRef.current = null;
        }, durationMs);
      } catch (error) {
        console.error('Error playing characters:', error);
        clearDurationDoneTimeout();
        setIsPlaying(false);
        releaseLock();
        stopRef.current = null;
      }
    },
    [isPlaying, settings, pickToneHz, clearDurationDoneTimeout, takeLock, releaseLock, stopPlayback],
  );

  const playAtSingleIndex = useCallback(
    (index: number): void => {
      const toggleOff = isPlaying && index === singleNav.selectedIndex;
      singleNav.setIndex(index);
      if (toggleOff) {
        stopPlayback();
        return;
      }
      if (isKochLevelOne) {
        void playCharacters(charPool);
        return;
      }
      const char = singlePool[index];
      void playCharacters(char ? [char] : []);
    },
    [
      isPlaying,
      isKochLevelOne,
      charPool,
      singlePool,
      singleNav,
      playCharacters,
      stopPlayback,
    ],
  );

  const playAtDigitsIndex = useCallback(
    (index: number): void => {
      const toggleOff = isPlaying && index === digitsNav.selectedIndex;
      digitsNav.setIndex(index);
      if (toggleOff) {
        stopPlayback();
        return;
      }
      const char = digitsPool[index];
      void playCharacters(char ? [char] : []);
    },
    [isPlaying, digitsPool, digitsNav, playCharacters, stopPlayback],
  );

  if (charPool.length === 0) {
    return null;
  }

  if (isMixed) {
    return (
      <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:gap-6">
        <CharPreviewStrip
          label="Letters"
          pool={lettersPool}
          selectedIndex={singleNav.selectedIndex}
          previousPool={previousLettersPool}
          isPlaying={isPlaying}
          onPrevious={() => singleNav.setIndex(Math.max(0, singleNav.selectedIndex - 1))}
          onNext={() =>
            singleNav.setIndex(Math.min(lettersPool.length - 1, singleNav.selectedIndex + 1))
          }
          onPlayAtIndex={playAtSingleIndex}
        />
        <CharPreviewStrip
          label="Digits"
          pool={digitsPool}
          selectedIndex={digitsNav.selectedIndex}
          previousPool={previousDigitsPool}
          isPlaying={isPlaying}
          onPrevious={() => digitsNav.setIndex(Math.max(0, digitsNav.selectedIndex - 1))}
          onNext={() =>
            digitsNav.setIndex(Math.min(digitsPool.length - 1, digitsNav.selectedIndex + 1))
          }
          onPlayAtIndex={playAtDigitsIndex}
        />
      </div>
    );
  }

  return (
    <CharPreviewStrip
      pool={charPool}
      selectedIndex={singleNav.selectedIndex}
      previousPool={singlePreviousPool}
      isPlaying={isPlaying}
      playEntirePool={isKochLevelOne}
      onPrevious={() => singleNav.setIndex(Math.max(0, singleNav.selectedIndex - 1))}
      onNext={() =>
        singleNav.setIndex(Math.min(charPool.length - 1, singleNav.selectedIndex + 1))
      }
      onPlayAtIndex={playAtSingleIndex}
    />
  );
}
