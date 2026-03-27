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
  onChange: (value: string) => void;
  onConfirm: (value?: string) => void;
  onFocus?: () => void;
  inputRef?: (el: HTMLInputElement | null) => void;
}

export function GroupItem({
  index,
  groupText,
  value,
  confirmed,
  isFocused = false,
  disabled = false,
  onChange,
  onConfirm,
  onFocus,
  inputRef,
}: GroupItemProps): JSX.Element {
  const normalizedValue = value.trim().toUpperCase();
  const groupCorrect =
    confirmed && normalizedValue.length === groupText.length && normalizedValue === groupText;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' && !disabled) {
      e.preventDefault();
      e.stopPropagation();
      onConfirm((e.target as HTMLInputElement).value);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    e.stopPropagation();
    onChange(e.target.value);
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
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onFocus={() => {
          if (!disabled) {
            onFocus?.();
          }
        }}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={`w-full px-2 sm:px-3 lg:px-4 py-2 sm:py-3 border-2 rounded-xl text-sm font-mono transition-all duration-200 ${
          disabled
            ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed opacity-60'
            : isFocused
              ? 'border-blue-400 focus:outline-none focus:ring-2 sm:focus:ring-4 focus:ring-blue-200 focus:border-blue-500'
              : 'border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400'
        }`}
        placeholder={disabled ? 'Waiting...' : 'Type group answer...'}
      />
      {confirmed && (
        <div className="mt-2 overflow-x-auto">
          <CharacterComparison sent={groupText} received={normalizedValue} showBoxes={true} size="sm" />
        </div>
      )}
    </div>
  );
}
