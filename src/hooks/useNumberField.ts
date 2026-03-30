import { useEffect, useState } from 'react';

import { useNumberInputHelpers } from './useNumberInput';

export interface NumberFieldOptions {
  /** Minimum allowed value (inclusive). */
  readonly min: number;
  /** Maximum allowed value (inclusive). */
  readonly max: number;
  /** Step for rounding. When > 0 the value is floored to the nearest integer. Use 0 for floats. Default 1. */
  readonly step?: number;
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
    readonly step: number;
    readonly value: string;
    readonly onFocus: (e: React.FocusEvent<HTMLInputElement>) => void;
    readonly onMouseUp: (e: React.MouseEvent<HTMLInputElement>) => void;
    readonly onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    readonly onBlur: (e: React.FocusEvent<HTMLInputElement>) => void;
  };
}

/**
 * Manages the full lifecycle of a number-input field:
 * - Local string state for free-form typing (empty/partial values allowed)
 * - Sync from external `currentValue` when it changes
 * - Spin-button detection for immediate saves
 * - Blur validation with fallback to `currentValue`
 *
 * Replaces the 13× useState + useEffect + handleNumberInputChange + handleNumberInputBlur
 * copy-paste pattern in TrainingSettingsForm and ICRSettingsForm.
 */
export function useNumberField(
  currentValue: number,
  options: NumberFieldOptions,
): NumberFieldResult {
  const { min, max, step = 1, fieldName, onChange, onSave } = options;
  const [localValue, setLocalValue] = useState<string>(String(currentValue));
  const { handleNumberInputChange, handleNumberInputBlur, handleSpinButtonClick } =
    useNumberInputHelpers(onSave);

  // Sync local state when the external value changes
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
      step: step || 1,
      value: localValue,
      onFocus: (e): void => e.target.select(),
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
          (num) => onChange(clamp(num)),
        );
      },
      onBlur: (e): void => {
        handleNumberInputBlur(
          e.target.value,
          setLocalValue,
          validator,
          (num) => onChange(clamp(num)),
          currentValue,
        );
      },
    },
  };
}
