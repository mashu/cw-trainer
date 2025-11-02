/** Toast severity levels supported in the UI layer. */
export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

/** Representation of a toast notification. */
export interface ToastMessage {
  readonly id: string;
  readonly message: string;
  readonly variant: ToastVariant;
  readonly durationMs?: number;
}

/** Reusable navigation item definition for sidebar and menus. */
export interface NavigationItem {
  readonly id: string;
  readonly label: string;
  readonly href: string;
  readonly icon?: string;
  readonly badge?: string;
  readonly disabled?: boolean;
}
