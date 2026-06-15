'use client';

import { useEffect, useState, type ChangeEvent, type FocusEvent, type MouseEvent } from 'react';

import { useNumberInputHelpers } from '@/hooks/useNumberInput';

export interface NumberFieldOptions {
  /** Minimum allowed value (inclusive). */
  readonly min: number;
  /** Maximum allowed value (inclusive). */
  readonly max: number;
  /** Step for rounding. When >= 1 the value is floored to an integer. Use a fractional step for floats. Default 1. */
  readonly step?: number;
  /**
   * When set, native spin buttons step by this amount while typed values may be any valid number.
   * Uses `step="any"` on the input so values like 85 are not marked invalid.
   */
  readonly spinStep?: number;
  /** Name used for spin-button click detection. */
  readonly fieldName: string;
  /** Called with the clamped numeric value whenever a valid change occurs. */
  readonly onChange: (value: number) => void;
  /** Optional callback fired on save (e.g. spin-button or blur). */
  readonly onSave?: () => void;
}

export interface NumberFieldResult {
  /** Current string value for the `<input>` `value` prop. */
  readonly value: string;
  /** Props to spread onto an `<input type="number">`. */
  readonly inputProps: {
    readonly type: 'number';
    readonly min: number;
    readonly max: number;
    readonly step: number | 'any';
    readonly value: string;
    readonly onFocus: (e: FocusEvent<HTMLInputElement>) => void;
    readonly onMouseUp: (e: MouseEvent<HTMLInputElement>) => void;
    readonly onChange: (e: ChangeEvent<HTMLInputElement>) => void;
    readonly onBlur: (e: FocusEvent<HTMLInputElement>) => void;
  };
}

/**
 * Manages local string state, external sync, spin-button handling, and blur validation
 * for a single `<input type="number">`. Used across training settings forms.
 */
export function useNumberField(currentValue: number, options: NumberFieldOptions): NumberFieldResult {
  const { min, max, step = 1, spinStep, fieldName, onChange, onSave } = options;
  const [localValue, setLocalValue] = useState<string>(String(currentValue));
  const { handleNumberInputChange, handleNumberInputBlur, handleSpinButtonClick } =
    useNumberInputHelpers(onSave);

  useEffect(() => {
    setLocalValue(String(currentValue));
  }, [currentValue]);

  const clamp = (n: number): number => {
    const clamped = Math.max(min, Math.min(max, n));
    return step >= 1 ? Math.floor(clamped) : clamped;
  };

  const validator = (n: number): boolean => !isNaN(n) && n >= min && n <= max;

  return {
    value: localValue,
    inputProps: {
      type: 'number',
      min,
      max,
      step: spinStep !== undefined ? 'any' : step || 1,
      value: localValue,
      onFocus: (e): void => {
        e.target.select();
      },
      onMouseUp: (e): void => {
        const target = e.target as HTMLInputElement;
        if (target === document.activeElement) {
          handleSpinButtonClick(fieldName);
        }
      },
      onChange: (e): void => {
        handleNumberInputChange(
          e.target.value,
          setLocalValue,
          fieldName,
          validator,
          (num) => {
            onChange(clamp(num));
          },
          spinStep !== undefined
            ? { currentValue, spinStep, clamp }
            : undefined,
        );
      },
      onBlur: (e): void => {
        handleNumberInputBlur(
          e.target.value,
          setLocalValue,
          validator,
          (num) => {
            onChange(clamp(num));
          },
          currentValue,
        );
      },
    },
  };
}
