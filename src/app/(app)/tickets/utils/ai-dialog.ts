import { DIALOG_MODE } from '../constants';
import type { Dialog } from '../types/dialog.types';
import { TICKET_STATUS_KIND } from './ticket-statistics';

/**
 * A ticket is "AI-active" when the AI assistant still works it: it sits in an
 * AI_ASSISTANCE-kind status (the "AI Handling" lane) and its chat dialog
 * exists and has not been switched to DIRECT. Status changes, assignment and
 * starting a direct chat on such a ticket go through the Take Over
 * confirmation flow instead of firing immediately.
 *
 * The status kind is the deciding signal, mirroring the backend: the AI is
 * disabled for a ticket the moment it leaves AI_ASSISTANCE
 * (`Ticket.isAiDisabled` is `statusKind != AI_ASSISTANCE`, and client messages
 * on such a ticket are rejected). The dialog mode is NOT a reliable proxy -
 * nothing flips it to DIRECT except an actual take-over or Start Direct Chat,
 * so a Fae ticket reopened into Tech Required (technician assigned), a
 * Fae-escalated Tech Required ticket and a Fae ticket closed without a
 * take-over all keep mode AI forever. Treating those as AI-worked asked
 * technicians to "take over" tickets they already owned (ClickUp 86ak573q9)
 * and would let Take Over reopen a closed ticket around the Reopen flow (no
 * chat card, no notification) - leaving a terminal status belongs to the
 * Reopen modal.
 */
export function hasActiveAiDialog(
  dialog: Pick<Dialog, 'dialogId' | 'currentMode' | 'statusKind'> | null | undefined,
): boolean {
  if (!dialog?.dialogId || dialog.statusKind !== TICKET_STATUS_KIND.AI_ASSISTANCE) return false;
  // Complement of the existing `isDirectMode` check (use-direct-chat): a dialog
  // that hasn't been switched to DIRECT is still owned by the AI.
  return dialog.currentMode !== DIALOG_MODE.DIRECT;
}
