import { DIALOG_MODE } from '../constants';
import type { Dialog } from '../types/dialog.types';

/**
 * A ticket is "AI-active" when its chat dialog exists and is still driven by
 * the AI assistant (mode AI, not yet switched to DIRECT). Status changes and
 * assignment on such tickets go through the Take Over confirmation flow
 * instead of firing immediately.
 */
export function hasActiveAiDialog(dialog: Pick<Dialog, 'dialogId' | 'currentMode'> | null | undefined): boolean {
  // Complement of the existing `isDirectMode` check (use-direct-chat): a dialog
  // that hasn't been switched to DIRECT is still owned by the AI.
  return !!dialog?.dialogId && dialog.currentMode !== DIALOG_MODE.DIRECT;
}
