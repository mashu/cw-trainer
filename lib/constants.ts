/**
 * Application-wide constants to avoid magic numbers and improve maintainability
 */

// Auto-confirmation timing
export const AUTO_CONFIRM_DELAY_MS = 300;

// Settings auto-save debounce delay
export const AUTO_SAVE_DELAY_MS = 2500;

// Audio processing constants
export const ENVELOPE_SAMPLE_RATE = 256;
export const AUDIO_DISCONNECT_DELAY_MS = 100;
export const AUDIO_CONTEXT_RESUME_TIMEOUT_MS = 100;

// ICR (Instant Character Recognition) polling intervals
export const ICR_POLLING_INTERVAL_MS = 10;
export const ICR_INPUT_POLLING_INTERVAL_MS = 20;

// Training timing
export const SLEEP_CANCELABLE_STEP_MS = 50;
export const INPUT_FOCUS_DELAY_MS = 100;
export const SCROLL_BEHAVIOR_DELAY_MS = 100;

// Toast notification duration
export const TOAST_DURATION_MS = 4000;

// Audio synthesis defaults
export const DEFAULT_TARGET_GAIN = 0.3;
export const DEFAULT_SAMPLE_RATE = 44100;
export const MIN_SAMPLE_RATE = 8000;

// PCM conversion constants
export const PCM_INT16_MIN = -0x8000;
export const PCM_INT16_MAX = 0x7FFF;

// Session persistence
export const MAX_KOCH_LEVEL_GUESS = 60;
export const MIN_KOCH_LEVEL = 1;
export const DEFAULT_AUTO_ADJUST_THRESHOLD = 90;

// UI constants
export const SWIPE_THRESHOLD_PX = 60;

