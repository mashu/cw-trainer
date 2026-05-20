'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useTrainingSessionLock } from '@/hooks/useTrainingSessionLock';
import { playMorseCodeControlled } from '@/lib/morseAudio';
import { computeCharPool } from '@/lib/trainingUtils';
import type { CharacterSetMode, TrainingSettings } from '@/types';

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

export function NewLetterPlayer({ settings }: NewLetterPlayerProps): JSX.Element | null {
  const { takeLock, releaseLock } = useTrainingSessionLock();
  const charSetMode = settings.charSetMode ?? 'koch';
  const useLinearNav = charSetMode === 'mixed' || charSetMode === 'digits';

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

  // Pool before the latest level step (letters and/or digits) to mark "new" characters.
  const previousLevelPool = useMemo(() => {
    const base = poolSettingsFrom(settings);
    if (charSetMode === 'digits') {
      const prevDigits = Math.max(1, (settings.digitsLevel ?? 10) - 1);
      if (prevDigits >= (settings.digitsLevel ?? 10)) return [];
      return computeCharPool({ ...base, digitsLevel: prevDigits });
    }
    if (charSetMode === 'mixed') {
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
  }, [settings, charSetMode]);

  // Always compute the latest/newest letter index - no state persistence
  // For level 1: show both letters (K M)
  // For level 2+: always default to the newest letter (the one not in previous level)
  const defaultLetterIndex = useMemo(() => {
    if (charPool.length === 0) return 0;
    if (useLinearNav) {
      const newChars = charPool.filter((char) => !previousLevelPool.includes(char));
      if (newChars.length > 0) {
        const lastNew = newChars[newChars.length - 1];
        const idx = lastNew ? charPool.indexOf(lastNew) : -1;
        if (idx >= 0) return idx;
      }
      return charPool.length - 1;
    }
    if (settings.kochLevel === 1) {
      return 0;
    }
    const newLetter = charPool.find((char) => !previousLevelPool.includes(char));
    if (newLetter) {
      return charPool.indexOf(newLetter);
    }
    return charPool.length - 1;
  }, [charPool, previousLevelPool, settings.kochLevel, useLinearNav]);

  // State for navigation - null means "use default", set when user navigates
  // This avoids the flash on initial load since we always use defaultLetterIndex until user navigates
  const [userSelectedIndex, setUserSelectedIndex] = useState<number | null>(null);

  // Reset user selection when settings change (so we go back to showing latest letter)
  React.useEffect(() => {
    setUserSelectedIndex(null);
  }, [defaultLetterIndex]);

  // The actual index to use: user selection if set, otherwise the computed default
  const selectedLetterIndex = userSelectedIndex ?? defaultLetterIndex;

  // Calculate values needed for hooks (handle empty charPool case)
  const selectedLetter =
    charPool.length > 0 ? (charPool[selectedLetterIndex] ?? charPool[0] ?? '') : '';
  const isKochLevelOne = !useLinearNav && settings.kochLevel === 1;
  const isFirstLevelPair = !useLinearNav && settings.kochLevel > 1 && selectedLetterIndex < 2;
  const canGoPrevious = isKochLevelOne ? false : selectedLetterIndex > 0;
  const canGoNext = isKochLevelOne ? false : selectedLetterIndex < charPool.length - 1;

  const pickToneHz = useCallback((): number => {
    const min = Math.max(100, settings.sideToneMin);
    const max = Math.max(min, settings.sideToneMax);
    if (min === max) return min;
    return Math.floor(min + Math.random() * (max - min + 1));
  }, [settings.sideToneMin, settings.sideToneMax]);

  const handlePlay = useCallback(async () => {
    if (isPlaying) {
      clearDurationDoneTimeout();
      // Stop if already playing
      if (stopRef.current) {
        stopRef.current();
        stopRef.current = null;
      }
      setIsPlaying(false);
      releaseLock();
      return;
    }

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    const ctx = audioContextRef.current;

    try {
      setIsPlaying(true);
      takeLock();
      // Determine what to play based on level
      let lettersToPlay: string[];
      if (useLinearNav) {
        lettersToPlay = selectedLetter ? [selectedLetter] : [];
      } else if (settings.kochLevel === 1) {
        lettersToPlay = charPool;
      } else if (isFirstLevelPair) {
        // Level 2+: if navigating to first two letters (K and M), play both together
        lettersToPlay = charPool.slice(0, 2);
      } else {
        // Level 2+: play only the selected letter
        lettersToPlay = selectedLetter ? [selectedLetter] : [];
      }
      const textToPlay = lettersToPlay.join(' '); // Add space between letters
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
        () => false, // Don't stop unless user clicks
      );
      stopRef.current = stop;

      // Wait for playback to finish based on actual duration
      const durationMs = Math.ceil((durationSec || 0) * 1000) + 100; // Add small buffer
      clearDurationDoneTimeout();
      durationDoneTimeoutRef.current = window.setTimeout(() => {
        durationDoneTimeoutRef.current = undefined;
        setIsPlaying(false);
        releaseLock();
        stopRef.current = null;
      }, durationMs);
    } catch (error) {
      console.error('Error playing letters:', error);
      clearDurationDoneTimeout();
      setIsPlaying(false);
      releaseLock();
      stopRef.current = null;
    }
  }, [
    isPlaying,
    selectedLetter,
    settings,
    charPool,
    isFirstLevelPair,
    useLinearNav,
    pickToneHz,
    clearDurationDoneTimeout,
    takeLock,
    releaseLock,
  ]);

  const handlePrevious = useCallback(() => {
    if (isPlaying || isKochLevelOne) return;
    if (useLinearNav) {
      setUserSelectedIndex(Math.max(0, selectedLetterIndex - 1));
      return;
    }
    let newIndex = selectedLetterIndex;
    if (selectedLetterIndex === 2) {
      newIndex = 0;
    } else if (selectedLetterIndex > 2) {
      newIndex = selectedLetterIndex - 1;
    } else if (selectedLetterIndex === 1) {
      newIndex = 0;
    }
    setUserSelectedIndex(newIndex);
  }, [isPlaying, isKochLevelOne, useLinearNav, selectedLetterIndex]);

  const handleNext = useCallback(() => {
    if (isPlaying || isKochLevelOne) return;
    if (useLinearNav) {
      setUserSelectedIndex(Math.min(charPool.length - 1, selectedLetterIndex + 1));
      return;
    }
    let newIndex = selectedLetterIndex;
    if (selectedLetterIndex < 2) {
      newIndex = 2;
    } else {
      newIndex = selectedLetterIndex + 1;
    }
    setUserSelectedIndex(newIndex);
  }, [isPlaying, isKochLevelOne, useLinearNav, selectedLetterIndex, charPool.length]);

  // Early return after all hooks
  if (charPool.length === 0) {
    return null;
  }

  // For level 1: display both letters
  // For level 2+: if navigating to first two letters (indices 0 or 1), display "K M", otherwise display selected letter
  const displayText = useLinearNav
    ? selectedLetter
    : settings.kochLevel === 1
      ? charPool.join(' ')
      : isFirstLevelPair
        ? charPool.slice(0, 2).join(' ')
        : selectedLetter;
  const isNewLetter = useLinearNav
    ? Boolean(selectedLetter && !previousLevelPool.includes(selectedLetter))
    : settings.kochLevel === 1
      ? false
      : isFirstLevelPair
        ? false
        : Boolean(selectedLetter && !previousLevelPool.includes(selectedLetter));

  const showNavigation = useLinearNav ? charPool.length > 1 : settings.kochLevel > 1;

  return (
    <div className="flex items-center gap-2">
      {/* Previous button - only for level 2+ */}
      {showNavigation && (
        <button
          onClick={handlePrevious}
          disabled={!canGoPrevious || isPlaying}
          className="p-1.5 rounded-md bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-50"
          title="Previous letter"
          type="button"
        >
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      )}

      {/* Play button */}
      <button
        onClick={handlePlay}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 transition-all duration-200 hover:shadow-sm text-sm font-medium justify-center relative"
        style={{ minWidth: '100px' }} // Fixed width to prevent layout shifts
        title={
          isKochLevelOne
            ? `Play two letters from level 1: ${displayText}`
            : `Play character: ${displayText}${isNewLetter ? ' (new for this level)' : ''}`
        }
        type="button"
      >
        {isPlaying ? (
          <>
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-xs">Stop</span>
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-xs">{displayText}</span>
            {/* Reserve space for NEW badge to prevent layout shifts - only for level 2+ */}
            {showNavigation && (
              <span className="text-[10px] text-blue-500 font-semibold w-8 text-center">
                {isNewLetter ? 'NEW' : ''}
              </span>
            )}
          </>
        )}
      </button>

      {/* Next button - only for level 2+ */}
      {showNavigation && (
        <button
          onClick={handleNext}
          disabled={!canGoNext || isPlaying}
          className="p-1.5 rounded-md bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-50"
          title="Next letter"
          type="button"
        >
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
