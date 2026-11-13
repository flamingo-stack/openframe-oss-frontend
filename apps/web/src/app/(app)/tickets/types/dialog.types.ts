import type { BoardTicketPendingApproval } from '@flamingo-stack/openframe-frontend-core/components/features';

// Live activity of a ticket (`Ticket.activityState`): AI_WORKING while the
// dialog holds the AI processing lock, AWAITING_EXTERNAL after our side
// messaged the client and until the client replies, IDLE otherwise.
// Staleness is deliberately NOT part of this enum — the FE derives it from
// `lastActivityAt` against the status's `staleAfterMinutes`.
export type TicketActivityState = 'AI_WORKING' | 'AWAITING_EXTERNAL' | 'IDLE';

// Server-side board filter values (`TicketFilterInput.activity`); OR within
// the list, AND against the other filter params.
export type TicketActivityFilter = 'ACTIVE' | 'STALE' | 'AWAITING_EXTERNAL';

export type DialogOwnerEnum = 'CLIENT' | 'ADMIN';

export interface DialogOwner {
  type: DialogOwnerEnum;
}

export interface Machine {
  id: string;
  machineId: string;
  hostname?: string;
  /** User-defined device name (the registry `nickname`); `getTicketDeviceName` puts it first. */
  nickname?: string | null;
  organizationId?: string;
}

export interface ClientDialogOwner extends DialogOwner {
  machineId: string;
  machine?: Machine;
}

export interface DialogRating {
  id: string;
  dialogId: string;
  rating: number;
  createdAt: string;
}

export interface Dialog {
  id: string;
  title: string;
  // Lifecycle (custom-status) board fields — populated from Ticket.statusDefinition.
  statusId?: string;
  statusName?: string;
  statusColor?: string;
  statusKind?: string;
  // Allowed status transitions for this ticket (lifecycle), from Ticket.availableTransitions.
  availableTransitions?: Array<{ id: string; name: string; color: string }>;
  owner: ClientDialogOwner | DialogOwner;
  createdAt: string;
  statusUpdatedAt?: string | null;
  resolvedAt?: string | null;
  // Who closed the ticket: 'AI_AGENT' | 'TECHNICIAN' | 'END_USER' (open string on the BE).
  // Null while open.
  resolvedBy?: string | null;
  aiResolutionSuggestedAt?: string | null;
  rating?: DialogRating | null;

  // V2 ticket-specific fields (only populated when fetched as ticket)
  currentMode?: string; // 'AI' | 'DIRECT'
  ticketNumber?: number;
  order?: string;
  dialogId?: string;
  description?: string;
  creationSource?: string;
  deviceId?: string;
  deviceHostname?: string;
  organizationId?: string;
  organizationName?: string;
  organizationImageUrl?: string;
  organizationImageHash?: string;
  assignedTo?: string;
  assignedName?: string;
  assigneeImageUrl?: string;
  assigneeImageHash?: string;
  tags?: Array<{ id: string; key: string; color?: string }>;
  // How many client-chat messages the technicians have not read
  // (`Ticket.unreadMessageCount`): ONE counter shared by every technician, so a
  // ticket one technician opened shows no badge to the others. Drives the
  // per-row count in the table and the "New Message" highlight on the board card.
  unreadMessageCount?: number;
  // Canonical "last conversation activity" stamp (`Ticket.lastActivityAt`,
  // served with a createdAt fallback so it is never null on the BE). Moves on
  // any chat message, AI action, or lifecycle transition — unlike
  // `statusUpdatedAt`, which only tracks status/board moves.
  lastActivityAt?: string | null;
  activityState?: TicketActivityState;
  escalatedByUser?: boolean | null;
  // Latest pending tool-approval request for this ticket's dialog (from Ticket.pendingApproval).
  pendingApproval?: BoardTicketPendingApproval;
  attachments?: Array<{
    id: string;
    ticketId: string;
    fileName: string;
    contentType: string;
    fileSize: number;
    uploadedAt: string;
    uploadedBy: string;
  }>;
  notes?: Array<{
    id: string;
    ticketId: string;
    content: string;
    authorId: string;
    authorName?: string;
    authorImageUrl?: string;
    authorImageHash?: string;
    createdAt: string;
    updatedAt: string;
  }>;
  tokenUsage?: ChatTypeTokenUsage[] | null;
}

export interface ChatTypeTokenUsage {
  chatType: string;
  inputTokensSize: number | null;
  outputTokensSize: number | null;
  totalTokensSize: number | null;
  contextSize: number | null;
}

export interface CursorPageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor?: string | null;
  endCursor?: string | null;
}

export interface DialogEdge {
  cursor: string;
  node: Dialog;
}

export interface DialogConnection {
  edges: DialogEdge[];
  pageInfo: CursorPageInfo;
}
