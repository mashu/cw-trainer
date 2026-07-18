export {
  buildTeachingPlan,
  CERTIFICATE_MIN_CHARS,
  CERTIFICATE_SESSIONS_TARGET,
  CERTIFICATE_SPEEDS_WPM,
  COPY_TEST_MIN_CHARS,
  QUALITY_ACCURACY,
  QUALITY_SESSIONS_TARGET,
} from './teachingPlan';
export type { CurriculumStage } from './teachingPlan';
export { evaluateTeachingPlan } from './progress';
export type {
  SpeedCertificateProgress,
  StageGoalId,
  StageGoalProgress,
  StageProgress,
  StageStatus,
  TeachingPlanProgress,
} from './progress';
