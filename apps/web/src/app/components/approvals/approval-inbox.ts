import {
  getApprovalMeta,
  MINGO_APPROVAL_REQUEST_TYPE,
  type Notification,
  resolutionToStatus,
  TICKET_APPROVAL_REQUEST_TYPE,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import type { TicketStatusDefinition } from '@/app/(app)/tickets/statuses/types/ticket-statuses.types';
import type { Dialog } from '@/app/(app)/tickets/types/dialog.types';
import { getTicketDeviceName } from '@/app/(app)/tickets/utils/ticket-device-name';
import { formatTicketRef } from '@/app/(app)/tickets/utils/ticket-ref';
import { withNotificationIcon } from '@/app/components/notifications/notification-category-icons';
import { normalizeToolCall } from '@/graphql/notifications/notification-attributes';
import { parseInstant } from '@/lib/graphql-scalars';
import type { ApprovalDecision } from './approval-decisions';
import type { ApprovalDialogNode } from './approval-dialogs-query';

/**
 * What needs a person's approval, composed on the client from the contracts that exist
 * (there is no server-side "approvals" list): the Needs approval page draws it, and its
 * count is the sidebar's "Needs approval" badge.
 *
 * - **Approval requests**: every pending `TICKET_APPROVAL_REQUEST` / `MINGO_APPROVAL_REQUEST`
 *   among the notifications the drawer has loaded, plus every Mingo chat in
 *   `ACTION_REQUIRED` with a pending approval (a request whose notification was read, or
 *   sits beyond the drawer's first page, still waits).
 * - **Tickets waiting for a technician**: the Tech Required lane's tickets that carry a
 *   pending technician approval and are not already a request above.
 *
 * Each card is the lib's approval tile, so each is a `Notification`: the drawer's own for a
 * notification, one built here (same type, same meta) for a chat or a ticket.
 */

export type ApprovalSection = 'requests' | 'tickets';

export interface ApprovalCard {
  /** The approval request id: the card's key, and what two sources of one request share. */
  approvalRequestId: string;
  section: ApprovalSection;
  /** What the tile draws; its `meta` carries the approval (`getApprovalMeta`). */
  notification: Notification;
  /** The unread notification the card is, when it is one: what its ✓ completes. */
  notificationId: string | null;
  /** The raw Mingo dialog the request belongs to, when known. */
  dialogId: string | null;
  /** The raw ticket id, when the request belongs to a ticket. */
  ticketId: string | null;
  /** Epoch ms of the request. */
  createdAt: number;
  /** Still waiting for a decision; false only for a card kept on screen after one. */
  pending: boolean;
}

export interface ApprovalSources {
  /** The notification drawer's loaded list (the lib provider's state). */
  notifications: readonly Notification[];
  /** Mingo chats in `ACTION_REQUIRED`, every admin's. */
  dialogs: readonly ApprovalDialogNode[];
  /** The Tech Required lane, as the board caches it; `null` where tickets do not exist (OSS). */
  tickets: readonly Dialog[] | null;
  /** Requests this tab has settled, from any surface (`approval-decisions.ts`). */
  decisions: Readonly<Record<string, ApprovalDecision>>;
}

export interface ApprovalInbox {
  requests: ApprovalCard[];
  /** Always empty where `sources.tickets` is `null`. */
  tickets: ApprovalCard[];
  pendingRequests: number;
  pendingTickets: number;
  /** Every pending card: the sidebar badge. */
  pendingCount: number;
}

/** The labels the lib tile prints in its header, for the cards built here. */
const MINGO_REQUEST_LABEL = 'Mingo Approval Request';
const TECHNICIAN_REQUEST_LABEL = 'Technician Approval Required';
/** The backend's own title for a chat approval, when the chat has no title yet. */
const UNTITLED_REQUEST_TITLE = 'Approval required';
const NO_DEVICE = 'No device';
const NO_CUSTOMER = 'No customer';

/**
 * `CLIENT` approvals are the end user's to answer in their chat (the board shows them as
 * "Pending client approval"); everything else waits on a technician.
 */
function isTechnicianApproval(approvalType: unknown): boolean {
  return typeof approvalType !== 'string' || approvalType.toUpperCase() !== 'CLIENT';
}

/** The tenant's system Tech Required status, the one lane section 2 reads. */
export function techRequiredStatusId(statuses: readonly TicketStatusDefinition[] | undefined): string | null {
  return statuses?.find(status => status.isSystem && status.kind === 'TECH_REQUIRED')?.id ?? null;
}

function epochOf(instant: string | null | undefined): number {
  return (instant ? parseInstant(instant)?.getTime() : undefined) ?? 0;
}

function notificationCard(notification: Notification): ApprovalCard | null {
  if (notification.read) return null;
  const approval = getApprovalMeta(notification);
  if (!approval || resolutionToStatus(approval.resolution) !== 'pending') return null;
  if (!isTechnicianApproval(approval.approvalType)) return null;
  return {
    approvalRequestId: approval.approvalRequestId,
    section: 'requests',
    // Settled: a page is not a pop-up, so no live countdown and no dismiss ×.
    notification: { ...notification, settled: true },
    notificationId: notification.id,
    dialogId: approval.dialogId ?? null,
    ticketId: approval.ticketId ?? null,
    createdAt: notification.createdAt,
    pending: true,
  };
}

interface RequestFacts {
  approvalRequestId: string;
  approvalType: string | null;
  toolCalls: readonly unknown[];
  createdAt: number;
}

/** A request with no notification behind it, drawn as the notification it would have been. */
function builtCard(
  section: ApprovalSection,
  request: RequestFacts,
  shown: Pick<Notification, 'type' | 'title' | 'description' | 'category'>,
  ids: { notificationType: string; dialogId: string | null; ticketId: string | null },
): ApprovalCard {
  const notification = withNotificationIcon({
    ...shown,
    id: `approval:${request.approvalRequestId}`,
    createdAt: request.createdAt,
    severity: 'INFO',
    read: false,
    settled: true,
    meta: {
      notificationType: ids.notificationType,
      approvalRequestId: request.approvalRequestId,
      approvalType: request.approvalType,
      dialogId: ids.dialogId,
      ticketId: ids.ticketId,
      resolution: 'PENDING',
      toolCalls: request.toolCalls.map(normalizeToolCall),
    },
  });
  return {
    approvalRequestId: request.approvalRequestId,
    section,
    notification,
    notificationId: null,
    dialogId: ids.dialogId,
    ticketId: ids.ticketId,
    createdAt: request.createdAt,
    pending: true,
  };
}

/** The request's own explanation, else what its first tool call says it does. */
function requestSummary(explanation: string | null | undefined, toolCalls: readonly unknown[]): string | undefined {
  if (explanation) return explanation;
  const first = toolCalls.length > 0 ? normalizeToolCall(toolCalls[0]) : null;
  return first?.toolExplanation || first?.toolTitle || undefined;
}

function dialogCard(dialog: ApprovalDialogNode): ApprovalCard | null {
  const request = dialog.pendingApproval;
  if (!request || !isTechnicianApproval(request.approvalType)) return null;
  const toolCalls = request.toolCalls ?? [];
  return builtCard(
    'requests',
    {
      approvalRequestId: request.id,
      approvalType: request.approvalType ?? null,
      toolCalls,
      createdAt: epochOf(request.createdAt ?? dialog.createdAt),
    },
    {
      type: MINGO_REQUEST_LABEL,
      title: dialog.title || UNTITLED_REQUEST_TITLE,
      description: requestSummary(request.explanation, toolCalls),
      category: 'MINGO',
    },
    { notificationType: MINGO_APPROVAL_REQUEST_TYPE, dialogId: dialog.dialogId, ticketId: null },
  );
}

function ticketCard(ticket: Dialog): ApprovalCard | null {
  const request = ticket.pendingApproval;
  if (!request || !isTechnicianApproval(request.approvalType)) return null;
  return builtCard(
    'tickets',
    {
      approvalRequestId: request.id,
      approvalType: request.approvalType ?? null,
      toolCalls: request.toolCalls ?? [],
      createdAt: epochOf(request.createdAt ?? ticket.statusUpdatedAt ?? ticket.createdAt),
    },
    {
      type: TECHNICIAN_REQUEST_LABEL,
      title: formatTicketRef(ticket, ticket.id),
      description: `${getTicketDeviceName(ticket) || NO_DEVICE} · ${ticket.organizationName || NO_CUSTOMER}`,
      category: 'TICKETS',
    },
    { notificationType: TICKET_APPROVAL_REQUEST_TYPE, dialogId: ticket.dialogId ?? null, ticketId: ticket.id },
  );
}

/**
 * A Mingo request's notification is titled "Approval required"; the chat it waits in is
 * the better name, and the one its title link opens.
 */
function withChatTitle(card: ApprovalCard, dialog: ApprovalDialogNode): ApprovalCard {
  if (!dialog.title || card.ticketId) return card;
  return { ...card, notification: { ...card.notification, title: dialog.title } };
}

/** The card as it stays on screen after a decision: the tile then shows `ApprovalStatusTag` + "by {name}". */
export function decidedCard(
  card: ApprovalCard,
  decision: ApprovalDecision,
  resolvedByName: string | null,
): ApprovalCard {
  return {
    ...card,
    pending: false,
    notification: {
      ...card.notification,
      meta: { ...card.notification.meta, resolution: decision.toUpperCase(), resolvedByName },
    },
  };
}

function newestFirst(a: ApprovalCard, b: ApprovalCard): number {
  return b.createdAt - a.createdAt || a.approvalRequestId.localeCompare(b.approvalRequestId);
}

/**
 * The two sections from the sources. One card per approval request: a notification wins
 * over the chat that raised it (it carries the backend's own text), and a request already
 * shown as a request is not shown again as a ticket. A request settled in this tab leaves
 * both — except the cards in `kept`, decided on the page itself, which stay where they were
 * with their decision on them.
 */
export function composeApprovalInbox(
  sources: ApprovalSources,
  kept: Readonly<Record<string, ApprovalCard>> = {},
): ApprovalInbox {
  const requests = new Map<string, ApprovalCard>();
  for (const notification of sources.notifications) {
    const card = notificationCard(notification);
    if (card && !requests.has(card.approvalRequestId)) requests.set(card.approvalRequestId, card);
  }
  for (const dialog of sources.dialogs) {
    const card = dialogCard(dialog);
    if (!card) continue;
    const shown = requests.get(card.approvalRequestId);
    requests.set(card.approvalRequestId, shown ? withChatTitle(shown, dialog) : card);
  }

  const tickets = new Map<string, ApprovalCard>();
  for (const ticket of sources.tickets ?? []) {
    const card = ticketCard(ticket);
    if (card && !requests.has(card.approvalRequestId) && !tickets.has(card.approvalRequestId)) {
      tickets.set(card.approvalRequestId, card);
    }
  }

  for (const id of Object.keys(sources.decisions)) {
    requests.delete(id);
    tickets.delete(id);
  }
  for (const card of Object.values(kept)) {
    if (card.section === 'tickets' && sources.tickets === null) continue;
    requests.delete(card.approvalRequestId);
    tickets.delete(card.approvalRequestId);
    (card.section === 'requests' ? requests : tickets).set(card.approvalRequestId, card);
  }

  const requestCards = [...requests.values()].sort(newestFirst);
  const ticketCards = [...tickets.values()].sort(newestFirst);
  const pendingRequests = requestCards.filter(card => card.pending).length;
  const pendingTickets = ticketCards.filter(card => card.pending).length;
  return {
    requests: requestCards,
    tickets: ticketCards,
    pendingRequests,
    pendingTickets,
    pendingCount: pendingRequests + pendingTickets,
  };
}
