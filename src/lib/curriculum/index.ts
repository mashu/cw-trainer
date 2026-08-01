export {
  buildTeachingPlan,
  CERTIFICATE_SPEEDS_WPM,
  COPY_TEST_MIN_CHARS,
  QUALITY_ACCURACY,
  QUALITY_SESSIONS_TARGET,
} from './teachingPlan';
export type { CurriculumStage } from './teachingPlan';
export {
  evaluateCharacterCoverage,
  hasCharacterCoverage,
  sessionPracticedCharacters,
} from './characterCoverage';
export type { CharacterCoverage } from './characterCoverage';
export { evaluateTeachingPlan } from './progress';
export type {
  StageGoalId,
  StageGoalProgress,
  StageProgress,
  StageStatus,
  TeachingPlanProgress,
} from './progress';
export {
  attemptedStageForLevel,
  CERT_MIN_ACCURACY,
  CERT_MIN_CORRECT_CHARS,
  evaluateSessionSpeedRun,
  evaluateSpeedCertificateMatrix,
} from './speedCertificates';
export type {
  CertificateCell,
  CertificateStageRow,
  SessionSpeedRun,
  SpeedCertificateMatrix,
} from './speedCertificates';
