import { DIALOG_MODE } from '../constants';
import type { Dialog } from '../types/dialog.types';
import { TICKET_STATUS_KIND } from './ticket-statistics';

/**
 * A ticket is "AI-active" when its chat dialog exists and is still driven by
 * the AI assistant (mode AI, not yet switched to DIRECT). Status changes and
 * assignment on such tickets go through the Take Over confirmation flow
 * instead of firing immediately.
 *
 * Terminal tickets (Resolved/Archived) are never AI-active, whatever the
 * dialog mode says: a Fae ticket closed without a take-over keeps mode AI
 * forever, and treating it as AI-worked would let Take Over reopen a closed
 * ticket around the Reopen flow (no requestTicketReopen, no chat card, no
 * notification). Leaving a terminal status belongs to the Reopen modal.
 */
export function hasActiveAiDialog(
  dialog: Pick<Dialog, 'dialogId' | 'currentMode' | 'statusKind'> | null | undefined,
): boolean {
  // Complement of the existing `isDirectMode` check (use-direct-chat): a dialog
  // that hasn't been switched to DIRECT is still owned by the AI.
  if (!dialog?.dialogId || dialog.currentMode === DIALOG_MODE.DIRECT) return false;
  return dialog.statusKind !== TICKET_STATUS_KIND.RESOLVED && dialog.statusKind !== TICKET_STATUS_KIND.ARCHIVED;
}
