import type { TrainingSettings } from '@/types';

/** Input: form-style update with optional or empty customSet/customSequence. */
export type FormSettingsUpdate = Partial<TrainingSettings> & {
  customSet?: string[];
  customSequence?: string[];
};

/**
 * Normalizes form-style settings to store shape: customSet always array (empty if none),
 * customSequence only included when non-empty.
 */
export function formSettingsToStoreUpdate(
  formValue: FormSettingsUpdate,
): Partial<TrainingSettings> {
  const { customSet, customSequence, ...rest } = formValue;
  return {
    ...rest,
    customSet: customSet && customSet.length > 0 ? [...customSet] : [],
    ...(customSequence && customSequence.length > 0
      ? { customSequence: [...customSequence] }
      : {}),
  } as Partial<TrainingSettings>;
}
