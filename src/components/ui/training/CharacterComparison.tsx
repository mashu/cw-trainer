'use client';

import React from 'react';

interface CharacterComparisonProps {
  /** The expected/sent string */
  sent: string;
  /** The received/typed string */
  received: string;
  /** Whether to show boxes around characters (default: true) */
  showBoxes?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Displays a character-by-character comparison of sent vs received text.
 * Shows two aligned rows:
 * - Top row (ground truth): Always same pale style - never changes
 * - Bottom row (received): Errors are bold, correct chars are pale
 */
export function CharacterComparison({
  sent,
  received,
  showBoxes = true,
  size = 'sm',
}: CharacterComparisonProps): JSX.Element {
  const sentUpper = sent.toUpperCase();
  const receivedUpper = (received || '').toUpperCase();
  const maxLen = Math.max(sentUpper.length, receivedUpper.length);

  // Size config with explicit dimensions for proper centering
  const sizeConfig = {
    sm: { text: 'text-xs', size: 20 },
    md: { text: 'text-sm', size: 24 },
    lg: { text: 'text-base', size: 28 },
  };

  const { text: textSize, size: boxPx } = sizeConfig[size];

  // Common box style for proper vertical centering
  const boxStyle: React.CSSProperties = {
    width: boxPx,
    height: boxPx,
    lineHeight: `${boxPx}px`,
  };

  // Build arrays of character elements
  const sentElements: JSX.Element[] = [];
  const receivedElements: JSX.Element[] = [];

  for (let i = 0; i < maxLen; i++) {
    const expectedChar = sentUpper[i] || ' ';
    const typedChar = receivedUpper[i] || '_';
    const isMatch = sentUpper[i] === receivedUpper[i];
    const isMissing = i >= receivedUpper.length;
    const isExtra = i >= sentUpper.length;

    // Ground truth row - always bold (represents the correct answer)
    sentElements.push(
      <span
        key={`s-${i}`}
        style={showBoxes ? boxStyle : undefined}
        className={showBoxes
          ? `${textSize} font-mono text-center border rounded bg-emerald-50 text-emerald-600 border-emerald-200 inline-block font-bold`
          : `${textSize} font-mono inline-block w-[1ch] text-center text-emerald-600 font-bold`
        }
      >
        {expectedChar}
      </span>
    );

    // Received row - correct chars are BOLD, errors are normal weight
    if (showBoxes) {
      receivedElements.push(
        <span
          key={`r-${i}`}
          style={boxStyle}
          className={`${textSize} font-mono text-center border rounded inline-block ${
            isMatch
              ? 'bg-emerald-50 text-emerald-600 border-emerald-200 font-bold'
              : isMissing
                ? 'bg-rose-50 text-rose-300 border-rose-200'
                : isExtra
                  ? 'bg-rose-100 text-rose-500 border-rose-300 line-through'
                  : 'bg-rose-100 text-rose-500 border-rose-300'
          }`}
        >
          {typedChar}
        </span>
      );
    } else {
      receivedElements.push(
        <span
          key={`r-${i}`}
          className={`${textSize} font-mono inline-block w-[1ch] text-center ${
            isMatch
              ? 'text-emerald-600 font-bold'
              : 'text-rose-500'
          }`}
        >
          {typedChar}
        </span>
      );
    }
  }

  return (
    <div className="font-mono leading-tight">
      <div className={`flex ${showBoxes ? 'gap-0.5' : ''}`}>{sentElements}</div>
      <div className={`flex ${showBoxes ? 'gap-0.5 mt-0.5' : ''}`}>{receivedElements}</div>
    </div>
  );
}

/**
 * Simple display for a correct group - just shows the text in green
 */
export function CorrectGroupDisplay({
  text,
  size = 'sm',
}: {
  text: string;
  size?: 'sm' | 'md' | 'lg';
}): JSX.Element {
  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  return (
    <span className={`${sizeClasses[size]} font-mono text-emerald-700`}>
      {text}
    </span>
  );
}

