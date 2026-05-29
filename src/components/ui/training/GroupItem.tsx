'use client';

import React from 'react';

import { CharacterComparison } from './CharacterComparison';

interface GroupItemProps {
  index: number;
  groupText: string;
  value: string;
  confirmed: boolean;
  isFocused?: boolean;
  disabled?: boolean;
  inputLocked?: boolean;
  onChange: (value: string) => void;
  onConfirm: (value?: string) => void;
  onFocus?: () => void;
  inputRef?: (el: HTMLInputElement | null) => void;
}

function InputLockIcon(): JSX.Element {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4 shrink-0 text-slate-500"
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function GroupItem({
  index,
  groupText,
  value,
  confirmed,
  isFocused = false,
  disabled = false,
  inputLocked = false,
  onChange,
  onConfirm,
  onFocus,
  inputRef,
}: GroupItemProps): JSX.Element {
  const normalizedValue = value.trim().toUpperCase();
  const groupCorrect =
    confirmed && normalizedValue.length === groupText.length && normalizedValue === groupText;
  const inputDisabled = disabled;
  const placeholder = inputLocked
    ? 'Listening...'
    : disabled
      ? 'Waiting...'
      : 'Type group answer...';

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (inputLocked) {
      e.preventDefault();
      return;
    }
    if (e.key === 'Enter' && !inputDisabled) {
      e.preventDefault();
      e.stopPropagation();
      onConfirm((e.target as HTMLInputElement).value);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    e.stopPropagation();
    if (inputLocked) return;
    onChange(e.target.value);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>): void => {
    if (inputLocked) {
      e.preventDefault();
    }
  };

  return (
    <div
      className={`p-2 sm:p-3 lg:p-4 rounded-xl border-2 transition-colors duration-200 w-full ${
        isFocused
          ? 'border-blue-400 bg-blue-50 shadow-md ring-2 ring-blue-200'
          : 'border-slate-200 bg-slate-50'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 sm:mb-3 gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-xs sm:text-sm font-bold px-2 py-1 rounded-full ${
              isFocused
                ? 'bg-blue-100 text-blue-700'
                : 'bg-slate-200 text-slate-600'
            }`}
          >
            Group {index + 1}
          </span>
          {isFocused && (
            <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full animate-pulse">
              Current
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-xs sm:text-sm font-mono px-2 sm:px-3 py-1 rounded-lg border bg-slate-100 text-slate-600 border-slate-200"
          >
            {confirmed ? groupText : '••••'}
          </span>
          {confirmed && (groupCorrect ? <span className="text-emerald-600 text-sm sm:text-lg">✓</span> : <span className="text-rose-600 text-sm sm:text-lg">✗</span>)}
        </div>
      </div>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleChange}
          onPaste={handlePaste}
          onFocus={() => {
            if (!inputDisabled) {
              onFocus?.();
            }
          }}
          onKeyDown={handleKeyDown}
          disabled={inputDisabled}
          readOnly={inputLocked}
          aria-readonly={inputLocked}
          aria-describedby={inputLocked ? `group-${index}-lock-hint` : undefined}
          className={`w-full px-2 sm:px-3 lg:px-4 py-2 sm:py-3 border-2 rounded-xl text-sm font-mono transition-all duration-200 ${
            inputLocked ? 'pr-9 sm:pr-10' : ''
          } ${
            inputDisabled
              ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed opacity-60'
              : inputLocked
                ? 'border-amber-200 bg-amber-50/70 text-slate-500 cursor-not-allowed'
                : isFocused
                  ? 'border-blue-400 focus:outline-none focus:ring-2 sm:focus:ring-4 focus:ring-blue-200 focus:border-blue-500'
                  : 'border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400'
          }`}
          placeholder={placeholder}
        />
        {inputLocked ? (
          <span
            id={`group-${index}-lock-hint`}
            className="pointer-events-none absolute inset-y-0 right-2 sm:right-3 flex items-center"
            title="Input locked until the group finishes playing"
          >
            <InputLockIcon />
          </span>
        ) : null}
      </div>
      {confirmed && (
        <div className="mt-2 overflow-x-auto">
          <CharacterComparison sent={groupText} received={normalizedValue} showBoxes={true} size="sm" />
        </div>
      )}
    </div>
  );
}
