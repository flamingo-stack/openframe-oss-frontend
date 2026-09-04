import type { BoardTicketActivity } from '@flamingo-stack/openframe-frontend-core/components/features';
import type { TicketStatusDefinition, TicketStatusKind } from '../statuses/types/ticket-statuses.types';
import type { Dialog } from '../types/dialog.types';

/**
 * Client-side mirror of the backend's staleness default
 * (`openframe.tickets.staleness.default-minutes`). Only a safety net: the
 * effective threshold arrives resolved on `TicketStatusDefinition.staleAfterMinutes`.
 */
export const DEFAULT_STALE_AFTER_MINUTES = 120;

/**
 * Closed-out lanes show no live-activity signals at all: staleness is
 * meaningless there, and a lingering `AWAITING_EXTERNAL` (the resolution flow
 * ends with a message to the client, which arms `awaitingClientSince`) would
 * paint "Waiting for client response" across the whole Resolved lane. The
 * Figma resolved variant carries only the check mark.
 */
const ACTIVITY_EXEMPT_KINDS: ReadonlySet<TicketStatusKind> = new Set(['RESOLVED', 'ARCHIVED']);

/**
 * Picks the single live-activity indicator a board card shows, per the agreed
 * display rules: the backend's `activityState` (AI working / awaiting client)
 * when it is not IDLE, else staleness — the lowest-priority signal, shown only
 * when nothing else (approval, escalation, unread) claims the card.
 *
 * Staleness compares the backend's canonical `lastActivityAt` (any chat action
 * by any actor; falls back to `createdAt` server-side) against the column's
 * server-resolved `staleAfterMinutes` — the same inputs the `STALE` server
 * filter evaluates. A `STALE`-filtered lane can still show cards without the
 * indicator, though: a higher-priority signal (approval, escalation, unread)
 * suppresses it on the card, and the FE re-evaluates on the minute tick while
 * the server evaluated at query time.
 */
export function resolveBoardActivity(
  dialog: Dialog,
  status: TicketStatusDefinition,
  now: number,
): BoardTicketActivity | undefined {
  if (ACTIVITY_EXEMPT_KINDS.has(status.kind)) return undefined;

  if (dialog.activityState === 'AI_WORKING') return { kind: 'ai-working' };
  if (dialog.activityState === 'AWAITING_EXTERNAL') return { kind: 'waiting-external' };

  const hasNewMessage = (dialog.unreadNotificationCount ?? 0) > 0;
  if (dialog.pendingApproval || dialog.escalatedByUser || hasNewMessage) return undefined;

  const lastActivityAt = dialog.lastActivityAt ?? dialog.createdAt;
  if (!lastActivityAt) return undefined;

  const idleMs = now - new Date(lastActivityAt).getTime();
  const threshold = (status.staleAfterMinutes || DEFAULT_STALE_AFTER_MINUTES) * 60 * 1000;
  if (!Number.isFinite(idleMs) || idleMs < threshold) return undefined;

  return { kind: 'stale', label: `No activity for ${formatIdleDuration(idleMs)}` };
}

function formatIdleDuration(idleMs: number): string {
  const hours = Math.floor(idleMs / (60 * 60 * 1000));
  if (hours < 1) return `${Math.max(1, Math.floor(idleMs / (60 * 1000)))} min`;
  if (hours < 24) return hours === 1 ? '1 hour' : `${hours} hours`;
  const days = Math.floor(hours / 24);
  return days === 1 ? '1 day' : `${days} days`;
}
