/**
 * Canonical training settings I/O lives in `@/lib/utils/training-settings`.
 * This module remains so `@/lib/trainingSettings` (path alias → repo `lib/`) does not reintroduce
 * hand-rolled partial serializers — the previous implementation dropped fields and broke auto-save.
 *
 * @deprecated Import `normalizeTrainingSettings` and `serializeTrainingSettings` from `@/lib/utils/training-settings`.
 */
export {
  normalizeTrainingSettings as normalizeSettings,
  serializeTrainingSettings as serializeSettings,
} from '@/lib/utils/training-settings';
