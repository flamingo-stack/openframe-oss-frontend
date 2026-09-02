import type { BoardTicketPendingApproval } from '@flamingo-stack/openframe-frontend-core/components/features';

export type DialogStatus = 'ACTIVE' | 'TECH_REQUIRED' | 'ON_HOLD' | 'RESOLVED' | 'ARCHIVED';

export type DialogOwnerEnum = 'CLIENT' | 'ADMIN';

export interface DialogOwner {
  type: DialogOwnerEnum;
}

export interface Machine {
  id: string;
  machineId: string;
  displayName?: string;
  hostname?: string;
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
  status: DialogStatus;
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
  // Null while open; selected only when the ai-resolution flag is on.
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

// Message types
export type MessageOwnerType = 'CLIENT' | 'ASSISTANT' | 'ADMIN';
export type ChatType = string;
export type DialogMode = string;
export type MessageDataType =
  | 'TEXT'
  | 'ERROR'
  | 'EXECUTING_TOOL'
  | 'EXECUTED_TOOL'
  | 'APPROVAL_REQUEST'
  | 'APPROVAL_RESULT'
  | 'SYSTEM'
  | 'TICKET_EVENT'
  | 'CONTEXT_COMPACTION_START'
  | 'CONTEXT_COMPACTION_END';

export interface MessageOwner {
  type: MessageOwnerType;
}

export interface ClientOwner extends MessageOwner {
  machineId: string;
}

export interface AssistantOwner extends MessageOwner {
  /** Raw model id the reply was generated with. */
  model: string;
  /** Provider display name ("Claude", "OpenAI", "Google"). */
  providerName?: string | null;
}

export interface AdminOwner extends MessageOwner {
  userId: string;
  user?: {
    id: string;
    firstName?: string;
    lastName?: string;
  };
}

export interface MessageData {
  type: MessageDataType;
}

export interface TextData extends MessageData {
  text: string;
}

export interface ErrorData extends MessageData {
  error: string;
  details?: string;
}

export interface ExecutingToolData extends MessageData {
  type: 'EXECUTING_TOOL';
  integratedToolType: string;
  toolFunction: string;
  title?: string;
  toolExplanation?: string;
  parameters?: Record<string, unknown>;
  requiresApproval?: boolean;
  approvalStatus?: string;
}

export interface ExecutedToolData extends MessageData {
  type: 'EXECUTED_TOOL';
  integratedToolType: string;
  toolFunction: string;
  result?: string;
  success?: boolean;
  requiredApproval?: boolean;
  approvalStatus?: string;
}

export interface ApprovalRequestData extends MessageData {
  type: 'APPROVAL_REQUEST';
  approvalRequestId: string;
  approvalType: string;
  command: string;
  explanation: string;
}

export interface ApprovalResultData extends MessageData {
  type: 'APPROVAL_RESULT';
  approvalRequestId: string;
  approved: boolean;
  approvalType: string;
  command?: string;
  description?: string;
  risk?: string;
  details?: unknown;
}

export interface SystemData extends MessageData {
  type: 'SYSTEM';
  text: string;
}

/** Ticket lifecycle receipt — same field names as the live `TICKET_EVENT`
 *  NATS chunk, so one core-lib mapper covers both paths. `kind` is an open
 *  vocabulary (RESOLVED/REOPENED today); unknown kinds still render. */
export interface TicketEventData extends MessageData {
  type: 'TICKET_EVENT';
  kind: string;
  actorId?: string | null;
  actorName?: string | null;
  actorType?: string | null;
  reason?: string | null;
  /** Kind-token the ticket reopened INTO (AI_ASSISTANCE / TECH_REQUIRED / ...). */
  targetStatusKind?: string | null;
}

export interface Message {
  id: string;
  dialogId: string;
  chatType: ChatType;
  dialogMode: DialogMode;
  createdAt: string;
  lastChunkStreamSeq?: number | null;
  owner: ClientOwner | AssistantOwner | AdminOwner | MessageOwner;
  messageData:
    | TextData
    | ErrorData
    | ExecutingToolData
    | ExecutedToolData
    | ApprovalRequestData
    | ApprovalResultData
    | SystemData
    | TicketEventData
    | MessageData;
}

export interface MessageEdge {
  cursor: string;
  node: Message;
}

export interface MessageConnection {
  edges: MessageEdge[];
  pageInfo: CursorPageInfo;
}
