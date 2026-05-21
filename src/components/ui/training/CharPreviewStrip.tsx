'use client';

import React from 'react';

export interface CharPreviewStripProps {
  readonly label?: string;
  readonly pool: readonly string[];
  readonly selectedIndex: number;
  readonly previousPool: readonly string[];
  readonly isPlaying: boolean;
  readonly playEntirePool?: boolean;
  readonly onPrevious: () => void;
  readonly onNext: () => void;
  /** Play the character at `index` (also moves selection to that index). */
  readonly onPlayAtIndex: (index: number) => void;
}

/** Square chip size shared by cells and chevrons for alignment. */
const CHIP_SIZE = 'size-10';

const CHEVRON_BTN = `flex ${CHIP_SIZE} shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-700 transition-all duration-200 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-blue-50`;

const CHAR_CELL_BASE = `relative flex ${CHIP_SIZE} shrink-0 items-center justify-center rounded-lg border text-center transition-all duration-200 disabled:cursor-not-allowed`;

function ChevronLeft(): JSX.Element {
  return (
    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
      <path
        fillRule="evenodd"
        d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ChevronRight(): JSX.Element {
  return (
    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
      <path
        fillRule="evenodd"
        d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function PreviewCharCell({
  char,
  displayText,
  position,
  isNew,
  isPlaying,
  wide,
  disabled,
  onClick,
}: {
  readonly char: string | null;
  readonly displayText: string;
  readonly position: 'left' | 'center' | 'right';
  readonly isNew: boolean;
  readonly isPlaying: boolean;
  readonly wide: boolean;
  readonly disabled: boolean;
  readonly onClick: () => void;
}): JSX.Element {
  const isCenter = position === 'center';
  const hasChar = Boolean(char);
  const pale = !isCenter && hasChar;
  const hidden = !hasChar;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || !hasChar}
      className={`${CHAR_CELL_BASE} ${wide ? 'min-w-14 w-auto max-w-[4.5rem] px-1.5' : ''} ${
        hidden
          ? 'border-transparent bg-transparent opacity-0 pointer-events-none'
          : isCenter
            ? 'border-blue-300 bg-blue-50 text-blue-900 hover:bg-blue-100 hover:shadow-sm'
            : 'border-blue-100 bg-blue-50/60 text-slate-500 hover:bg-blue-50 hover:border-blue-200'
      } ${pale ? 'opacity-45 hover:opacity-80' : ''}`}
      title={hasChar ? `Play ${displayText}${isNew && isCenter ? ' (new)' : ''}` : undefined}
      aria-label={hasChar ? `Play ${displayText}` : undefined}
      aria-hidden={hidden}
    >
      {isPlaying && isCenter ? (
        <span className="text-[10px] font-semibold leading-none text-blue-800">Stop</span>
      ) : (
        <span
          className={`font-bold leading-none tabular-nums ${
            wide ? 'text-sm tracking-tight' : 'text-lg'
          }`}
        >
          {hasChar ? displayText : '·'}
        </span>
      )}
      {isCenter && isNew && !isPlaying ? (
        <span className="absolute -top-1 left-1/2 -translate-x-1/2 rounded bg-blue-600 px-1 py-px text-[8px] font-bold leading-none text-white shadow-sm">
          NEW
        </span>
      ) : null}
    </button>
  );
}

export function CharPreviewStrip({
  label,
  pool,
  selectedIndex,
  previousPool,
  isPlaying,
  playEntirePool = false,
  onPrevious,
  onNext,
  onPlayAtIndex,
}: CharPreviewStripProps): JSX.Element | null {
  if (pool.length === 0) {
    return null;
  }

  const safeIndex = Math.max(0, Math.min(selectedIndex, pool.length - 1));
  const centerChar = pool[safeIndex] ?? '';
  const leftChar = safeIndex > 0 ? (pool[safeIndex - 1] ?? null) : null;
  const rightChar =
    safeIndex < pool.length - 1 ? (pool[safeIndex + 1] ?? null) : null;
  const canGoPrevious = safeIndex > 0;
  const canGoNext = safeIndex < pool.length - 1;
  const showNav = pool.length > 1 && !playEntirePool;

  const centerDisplay = playEntirePool ? pool.join(' ') : centerChar;
  const centerWide = playEntirePool || centerDisplay.includes(' ');
  const isCenterNew =
    !playEntirePool && Boolean(centerChar && !previousPool.includes(centerChar));

  const handleCellPlay = (index: number | null): void => {
    if (index === null) return;
    if (playEntirePool) {
      onPlayAtIndex(safeIndex);
      return;
    }
    onPlayAtIndex(index);
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="h-3.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label ?? '\u00A0'}
      </span>
      <div className="flex items-center justify-center gap-1.5">
        <button
          type="button"
          onClick={onPrevious}
          disabled={!showNav || !canGoPrevious || isPlaying}
          className={`${CHEVRON_BTN} ${showNav ? '' : 'invisible pointer-events-none'}`}
          title="Previous character"
          aria-label="Previous character"
          tabIndex={showNav ? 0 : -1}
        >
          <ChevronLeft />
        </button>

        <div className="flex items-center justify-center gap-1">
          <PreviewCharCell
            char={leftChar}
            displayText={leftChar ?? ''}
            position="left"
            isNew={false}
            isPlaying={false}
            wide={false}
            disabled={playEntirePool}
            onClick={() => handleCellPlay(safeIndex > 0 ? safeIndex - 1 : null)}
          />
          <PreviewCharCell
            char={centerChar}
            displayText={centerDisplay}
            position="center"
            isNew={isCenterNew}
            isPlaying={isPlaying}
            wide={centerWide}
            disabled={false}
            onClick={() => handleCellPlay(safeIndex)}
          />
          <PreviewCharCell
            char={rightChar}
            displayText={rightChar ?? ''}
            position="right"
            isNew={false}
            isPlaying={false}
            wide={false}
            disabled={playEntirePool}
            onClick={() =>
              handleCellPlay(safeIndex < pool.length - 1 ? safeIndex + 1 : null)
            }
          />
        </div>

        <button
          type="button"
          onClick={onNext}
          disabled={!showNav || !canGoNext || isPlaying}
          className={`${CHEVRON_BTN} ${showNav ? '' : 'invisible pointer-events-none'}`}
          title="Next character"
          aria-label="Next character"
          tabIndex={showNav ? 0 : -1}
        >
          <ChevronRight />
        </button>
      </div>
    </div>
  );
}
