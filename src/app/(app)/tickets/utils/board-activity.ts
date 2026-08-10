import type { BoardTicketActivity } from '@flamingo-stack/openframe-frontend-core/components/features';
import type { TicketStatusKind } from '../statuses/types/ticket-statuses.types';
import type { Dialog } from '../types/dialog.types';

/**
 * Staleness threshold until the backend exposes per-status configuration
 * (see the BE spec "ticket activity fields" — `staleAfterMinutes` on the
 * status definition). Per-kind overrides slot into the map below.
 */
export const DEFAULT_STALE_AFTER_MS = 2 * 60 * 60 * 1000;
const STALE_AFTER_MS_BY_KIND: Partial<Record<TicketStatusKind, number>> = {};

/** Staleness is meaningless once a ticket is closed out. */
const STALE_EXEMPT_KINDS: ReadonlySet<TicketStatusKind> = new Set(['RESOLVED', 'ARCHIVED']);

/**
 * Lowest-priority indicator: a card is marked stale only when nothing else
 * (approval, escalation, unread) claims its footer, per the agreed display
 * priority. `statusUpdatedAt` (the chat `Ticket.updatedAt`) is the best
 * activity signal available today — it moves on status changes only, so a
 * ticket with a busy chat but an unchanged status can read staler than it is.
 * The BE `lastActivityAt` field replaces it here once shipped.
 */
export function resolveStaleActivity(
  dialog: Dialog,
  statusKind: TicketStatusKind,
  hasNewMessage: boolean,
  now: number,
): BoardTicketActivity | undefined {
  if (STALE_EXEMPT_KINDS.has(statusKind)) return undefined;
  if (dialog.pendingApproval || dialog.escalatedByUser || hasNewMessage) return undefined;

  const lastActivityAt = dialog.statusUpdatedAt ?? dialog.createdAt;
  if (!lastActivityAt) return undefined;

  const idleMs = now - new Date(lastActivityAt).getTime();
  const threshold = STALE_AFTER_MS_BY_KIND[statusKind] ?? DEFAULT_STALE_AFTER_MS;
  if (!Number.isFinite(idleMs) || idleMs < threshold) return undefined;

  return { kind: 'stale', label: `No activity for ${formatIdleDuration(idleMs)}` };
}

function formatIdleDuration(idleMs: number): string {
  const hours = Math.floor(idleMs / (60 * 60 * 1000));
  if (hours < 24) return hours === 1 ? '1 hour' : `${hours} hours`;
  const days = Math.floor(hours / 24);
  return days === 1 ? '1 day' : `${days} days`;
}
