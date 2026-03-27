'use client';

import React, { useCallback, useRef } from 'react';

interface LinkedRangeInputProps {
  label: string;
  minValue: string;
  maxValue: string;
  linked: boolean;
  onMinChange: (value: string) => void;
  onMaxChange: (value: string) => void;
  onMinBlur: () => void;
  onMaxBlur: () => void;
  onLinkToggle: (linked: boolean) => void;
  min?: number;
  max?: number;
  step?: number;
  minLabel?: string;
  maxLabel?: string;
  unit?: string;
  disabled?: boolean;
  helpText?: string;
}

export function LinkedRangeInput({
  label,
  minValue,
  maxValue,
  linked,
  onMinChange,
  onMaxChange,
  onMinBlur,
  onMaxBlur,
  onLinkToggle,
  min = 1,
  max,
  step = 1,
  minLabel = 'Min',
  maxLabel = 'Max',
  unit,
  disabled = false,
  helpText,
}: LinkedRangeInputProps): JSX.Element {
  const spinButtonRef = useRef<{ field: string; timestamp: number } | null>(null);

  const handleSpinButtonClick = useCallback((fieldName: string) => {
    spinButtonRef.current = { field: fieldName, timestamp: Date.now() };
  }, []);

  const handleMinChange = useCallback((value: string) => {
    if (linked) {
      onMinChange(value);
      onMaxChange(value);
    } else {
      onMinChange(value);
    }
  }, [linked, onMinChange, onMaxChange]);

  const handleMaxChange = useCallback((value: string) => {
    if (linked) {
      onMinChange(value);
      onMaxChange(value);
    } else {
      onMaxChange(value);
    }
  }, [linked, onMinChange, onMaxChange]);

  const handleToggleLink = useCallback(() => {
    const newLinked = !linked;
    onLinkToggle(newLinked);
    if (newLinked) {
      // Sync max to min when linking
      onMaxChange(minValue);
    }
  }, [linked, onLinkToggle, minValue, onMaxChange]);

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <div className="flex items-center gap-2">
        {/* Min input */}
        <div className="flex-1">
          <div className="relative">
            <input
              type="number"
              min={min}
              max={max}
              step={step}
              value={minValue}
              disabled={disabled}
              onMouseUp={(e) => {
                const target = e.target as HTMLInputElement;
                if (target === document.activeElement) {
                  handleSpinButtonClick('min');
                }
              }}
              onChange={(e) => handleMinChange(e.target.value)}
              onBlur={onMinBlur}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed transition-all"
            />
            <span className="absolute -top-2 left-2 px-1 text-[10px] font-medium text-gray-500 bg-slate-50">
              {minLabel}
            </span>
          </div>
        </div>

        {/* Link toggle button */}
        <button
          type="button"
          onClick={handleToggleLink}
          disabled={disabled}
          className={`
            relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-300
            ${linked
              ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 hover:scale-105'
              : 'bg-white border-2 border-dashed border-gray-300 text-gray-400 hover:border-indigo-400 hover:text-indigo-500 hover:bg-indigo-50'
            }
            disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
          `}
          title={linked ? 'Unlink values (allow different min/max)' : 'Link values (same min/max)'}
        >
          {linked ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M8 12h8"
              />
            </svg>
          )}
          {/* Animated pulse when linked */}
          {linked && (
            <span className="absolute inset-0 rounded-xl bg-indigo-400 animate-ping opacity-20" />
          )}
        </button>

        {/* Max input */}
        <div className="flex-1">
          <div className="relative">
            <input
              type="number"
              min={min}
              max={max}
              step={step}
              value={maxValue}
              disabled={disabled || linked}
              onMouseUp={(e) => {
                const target = e.target as HTMLInputElement;
                if (target === document.activeElement && !linked) {
                  handleSpinButtonClick('max');
                }
              }}
              onChange={(e) => handleMaxChange(e.target.value)}
              onBlur={onMaxBlur}
              className={`
                w-full px-3 py-2 border border-gray-300 rounded-lg text-center font-medium transition-all
                focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
                ${linked ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}
                disabled:bg-gray-100 disabled:cursor-not-allowed
              `}
            />
            <span className="absolute -top-2 left-2 px-1 text-[10px] font-medium text-gray-500 bg-slate-50">
              {maxLabel}
            </span>
          </div>
        </div>

        {/* Unit label */}
        {unit && (
          <span className="text-sm font-medium text-gray-500 min-w-[40px]">{unit}</span>
        )}
      </div>
      
      {/* Help text */}
      {helpText && (
        <p className="text-xs text-gray-500 mt-1">{helpText}</p>
      )}
      
      {/* Status indicator */}
      <div className={`
        flex items-center gap-1.5 text-xs transition-all duration-300
        ${linked ? 'text-indigo-600' : 'text-gray-500'}
      `}>
        <span className={`
          w-1.5 h-1.5 rounded-full transition-all
          ${linked ? 'bg-indigo-500' : 'bg-gray-400'}
        `} />
        {linked ? 'Constant value' : 'Random range'}
      </div>
    </div>
  );
}

