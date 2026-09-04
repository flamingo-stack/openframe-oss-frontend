import type { ChunkData } from '@flamingo-stack/openframe-frontend-core';
import type { ChatType } from '../constants';
import type { CursorPageInfo, Dialog, DialogStatus, Message, TicketActivityFilter } from '../types/dialog.types';

export interface TicketsPage {
  dialogs: Dialog[];
  pageInfo: CursorPageInfo;
  filteredCount: number;
}

export interface MessagePage {
  messages: Message[];
  pageInfo: CursorPageInfo;
}

export interface FetchTicketsParams {
  // Lifecycle status ids; callers resolve them from the status snapshot before
  // firing (there is no enum fallback — an empty list sends no status filter).
  statusIds: string[];
  search?: string;
  organizationIds?: string[];
  assigneeIds?: string[];
  tagIds?: string[];
  // Sent as `TicketFilterInput.hasUnreadNotifications: true`; the backend
  // treats false and null alike (no filter), so only `true` is ever sent.
  unreadOnly?: boolean;
  cursor?: string;
  limit: number;
}

export interface FetchBoardColumnByStatusIdParams {
  statusId: string;
  search?: string;
  organizationIds?: string[];
  assigneeIds?: string[];
  tagIds?: string[];
  unreadOnly?: boolean;
  // Sent as `TicketFilterInput.activity`; OR within the list, AND with the
  // other params. Empty list sends no filter.
  activity?: TicketActivityFilter[];
  cursor?: string;
  limit: number;
}

export interface ReorderTicketParams {
  id: string;
  afterTicketId: string | null;
  beforeTicketId: string | null;
  // Lifecycle column id, forwarded as ReorderTicketInput.statusId. Always send it,
  // on a same-column reorder too: the backend uses its presence to choose between
  // the lifecycle ranking (statusId columns — what the board shows) and the legacy
  // one (the deprecated `status` enum). See `moveTicketRequest`.
  statusId?: string;
}

export interface TicketStatusTransitionRule {
  from: string;
  to: string[];
}

export interface FetchMessagesParams {
  dialogId: string;
  chatType: ChatType;
  cursor?: string;
  limit: number;
  sortField?: string;
  sortDirection?: 'ASC' | 'DESC';
}

export interface TicketService {
  fetchDialogs(params: FetchTicketsParams): Promise<TicketsPage>;
  fetchBoardColumnByStatusId(params: FetchBoardColumnByStatusIdParams): Promise<TicketsPage>;
  fetchDialog(id: string): Promise<Dialog | null>;
  fetchMessages(params: FetchMessagesParams): Promise<MessagePage>;
  transitionTicket(ticketId: string, toStatusId: string): Promise<void>;
  reorderTicket(params: ReorderTicketParams): Promise<DialogStatus>;
  fetchTicketStatusTransitionRules(): Promise<TicketStatusTransitionRule[]>;
  sendMessage(dialogId: string, content: string, chatType: ChatType): Promise<void>;
  approveRequest(requestId: string): Promise<void>;
  rejectRequest(requestId: string): Promise<void>;
  fetchChunks(dialogId: string, chatType: ChatType, fromSequenceId?: number | null): Promise<ChunkData[]>;
}
