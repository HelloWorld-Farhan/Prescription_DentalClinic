export type ConfirmationType = 'success' | 'info' | 'warning' | 'error';

export interface ConfirmationEventDetail {
  id: string;
  message: string;
  type?: ConfirmationType;
  duration?: number;
}

/**
 * Dispatches a top-bar confirmation notification with fluid animation.
 * Replaces the desktop top search bar or animates in the mobile top bar.
 */
export function showConfirmation(
  message: string,
  type: ConfirmationType = 'success',
  duration = 3500
) {
  if (typeof window === 'undefined') return;
  const detail: ConfirmationEventDetail = {
    id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    message,
    type,
    duration,
  };
  window.dispatchEvent(new CustomEvent<ConfirmationEventDetail>('clinical-confirmation', { detail }));
}
