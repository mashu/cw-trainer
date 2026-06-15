import { useRef } from 'react';

/**
 * Shared helpers for number inputs with spin-button detection and blur validation.
 * Extracted from TrainingSettingsForm to be reusable across section components.
 */
type NumberInputHelpers = {
  handleSpinButtonClick: (fieldName: string) => void;
  handleNumberInputChange: (
    value: string,
    setLocalState: (val: string) => void,
    fieldName: string,
    validator: (num: number) => boolean,
    onValid: (num: number) => void,
    spinAdjust?: {
      readonly currentValue: number;
      readonly spinStep: number;
      readonly clamp: (n: number) => number;
    },
  ) => void;
  handleNumberInputBlur: (
    value: string,
    setLocalState: (val: string) => void,
    validator: (num: number) => boolean,
    onValid: (num: number) => void,
    currentValue: number,
  ) => void;
};

export function useNumberInputHelpers(onSaveSettings?: () => void): NumberInputHelpers {
  const spinButtonRef = useRef<{ field: string; timestamp: number } | null>(null);

  const handleSpinButtonClick = (fieldName: string): void => {
    spinButtonRef.current = { field: fieldName, timestamp: Date.now() };
  };

  const handleNumberInputChange = (
    value: string,
    setLocalState: (val: string) => void,
    fieldName: string,
    validator: (num: number) => boolean,
    onValid: (num: number) => void,
    spinAdjust?: {
      readonly currentValue: number;
      readonly spinStep: number;
      readonly clamp: (n: number) => number;
    },
  ): void => {
    const isSpinButton =
      spinButtonRef.current?.field === fieldName &&
      Date.now() - spinButtonRef.current.timestamp < 100;

    if (isSpinButton && spinAdjust) {
      const browserValue = parseFloat(value);
      if (!isNaN(browserValue)) {
        const direction =
          browserValue > spinAdjust.currentValue
            ? 1
            : browserValue < spinAdjust.currentValue
              ? -1
              : 0;
        const adjusted = spinAdjust.clamp(
          spinAdjust.currentValue + direction * spinAdjust.spinStep,
        );
        setLocalState(String(adjusted));
        onValid(adjusted);
      }
      return;
    }

    setLocalState(value);

    if (isSpinButton) {
      const numValue = parseFloat(value);
      if (!isNaN(numValue) && validator(numValue)) {
        onValid(numValue);
      }
    }
  };

  const handleNumberInputBlur = (
    value: string,
    setLocalState: (val: string) => void,
    validator: (num: number) => boolean,
    onValid: (num: number) => void,
    currentValue: number,
  ): void => {
    const numValue = parseFloat(value);
    if (isNaN(numValue) || !validator(numValue)) {
      setLocalState(String(currentValue));
    } else {
      setLocalState(String(numValue));
      onValid(numValue);
      if (onSaveSettings) {
        setTimeout(() => onSaveSettings(), 50);
      }
    }
  };

  return { handleNumberInputChange, handleNumberInputBlur, handleSpinButtonClick };
}
