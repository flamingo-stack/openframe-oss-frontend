import type { ChunkData } from '@flamingo-stack/openframe-frontend-core';
import { apiClient } from '@/lib/api-client';
import type { ChatType } from '../constants';
import { API_ENDPOINTS } from '../constants';
import { getDialogMessagesQuery, normalizeMessageDataAliases } from '../queries/dialogs-queries';
import {
  GET_TICKET_QUERY,
  GET_TICKET_STATUS_TRANSITION_RULES_QUERY,
  GET_TICKETS_QUERY,
  getBoardColumnTicketsQuery,
  REORDER_TICKET_MUTATION,
  TRANSITION_TICKET_MUTATION,
} from '../queries/ticket-queries';
import type { Dialog, DialogOwnerEnum, DialogStatus, Message } from '../types/dialog.types';
import type { GraphQlResponse } from '../utils/graphql';
import { extractGraphQlData } from '../utils/graphql';
import type {
  FetchBoardColumnByStatusIdParams,
  FetchMessagesParams,
  FetchTicketsParams,
  MessagePage,
  ReorderTicketParams,
  TicketService as TicketServiceInterface,
  TicketStatusTransitionRule,
  TicketsPage,
} from './ticket-service.types';

interface TicketNode {
  id: string;
  ticketNumber: number;
  title: string;
  status: string;
  statusDefinition?: { id: string; name: string; color: string; kind?: string } | null;
  availableTransitions?: Array<{ id: string; name: string; color: string }> | null;
  owner: {
    type: 'CLIENT' | 'ADMIN';
    machineId?: string;
    machine?: { id: string; machineId: string; hostname: string; organizationId?: string };
    userId?: string;
    user?: { id: string; firstName: string; lastName: string };
  };
  deviceId?: string;
  deviceHostname?: string;
  organizationId?: string;
  organizationName?: string;
  organizationImage?: { imageUrl: string; hash?: string };
  assignedTo?: string;
  assignedName?: string;
  assigneeImage?: { imageUrl: string; hash?: string };
  tags?: Array<{ id: string; key: string; color?: string }>;
  unreadNotificationCount?: number;
  escalatedByUser?: boolean | null;
  resolvedBy?: string | null;
  pendingApproval?: {
    id: string;
    approvalType?: string;
    command?: string;
    explanation?: string;
    createdAt?: string;
    toolCalls?: Array<{
      toolExecutionRequestId: string;
      toolName: string;
      toolTitle?: string;
      toolExplanation?: string;
      toolType?: string;
      requiresApproval: boolean;
      approvalType?: string | null;
      toolCallArguments?: Record<string, unknown> | null;
    }>;
  } | null;
  notes?: Array<{
    id: string;
    ticketId: string;
    content: string;
    authorId: string;
    author?: { id: string; firstName: string; lastName: string };
    authorImage?: { imageUrl: string; hash?: string };
    createdAt: string;
    updatedAt: string;
  }>;
  attachments?: Array<{
    id: string;
    ticketId: string;
    fileName: string;
    contentType: string;
    fileSize: number;
    uploadedAt: string;
    uploadedBy: string;
  }>;
  dialog?: {
    id: string;
    currentMode?: string;
    tokenUsage?: Array<{
      chatType: string;
      inputTokensSize: number | null;
      outputTokensSize: number | null;
      totalTokensSize: number | null;
      contextSize: number | null;
    }> | null;
  };
  description?: string;
  creationSource?: string;
  createdAt: string;
  updatedAt?: string;
  resolvedAt?: string;
  order?: string;
}

interface TicketResponse {
  ticket: TicketNode | null;
}

interface TicketsResponse {
  tickets: {
    edges: Array<{ cursor: string; node: TicketNode }>;
    pageInfo: { hasNextPage: boolean; hasPreviousPage: boolean; startCursor?: string; endCursor?: string };
    filteredCount: number;
  };
}

const TICKET_TO_DIALOG_STATUS: Record<string, DialogStatus> = {
  ACTIVE: 'ACTIVE',
  TECH_REQUIRED: 'TECH_REQUIRED',
  ON_HOLD: 'ON_HOLD',
  RESOLVED: 'RESOLVED',
  ARCHIVED: 'ARCHIVED',
};

interface StatusMutationPayload {
  ticket: { id: string; status: string } | null;
  userErrors: Array<{ field?: string[]; message: string }>;
}

function normalizeTicketToDialog(ticket: TicketNode): Dialog {
  return {
    id: ticket.id,
    title: ticket.title,
    status: TICKET_TO_DIALOG_STATUS[ticket.status] || (ticket.status as DialogStatus),
    statusId: ticket.statusDefinition?.id,
    statusName: ticket.statusDefinition?.name,
    statusColor: ticket.statusDefinition?.color,
    statusKind: ticket.statusDefinition?.kind,
    availableTransitions: ticket.availableTransitions ?? undefined,
    owner:
      ticket.owner.type === 'CLIENT'
        ? {
            type: 'CLIENT' as const,
            machineId: ticket.owner.machineId || '',
            machine: ticket.owner.machine,
          }
        : { type: ticket.owner.type as DialogOwnerEnum },
    createdAt: ticket.createdAt,
    statusUpdatedAt: ticket.updatedAt || null,
    resolvedAt: ticket.resolvedAt || null,
    resolvedBy: ticket.resolvedBy ?? null,
    aiResolutionSuggestedAt: null,
    rating: null,

    currentMode: ticket.dialog?.currentMode,
    ticketNumber: ticket.ticketNumber,
    order: ticket.order,
    dialogId: ticket.dialog?.id,
    description: ticket.description,
    creationSource: ticket.creationSource,
    deviceId: ticket.deviceId,
    deviceHostname: ticket.deviceHostname,
    organizationId: ticket.organizationId,
    organizationName: ticket.organizationName,
    organizationImageUrl: ticket.organizationImage?.imageUrl,
    organizationImageHash: ticket.organizationImage?.hash,
    assignedTo: ticket.assignedTo,
    assignedName: ticket.assignedName,
    assigneeImageUrl: ticket.assigneeImage?.imageUrl,
    assigneeImageHash: ticket.assigneeImage?.hash,
    tags: ticket.tags,
    unreadNotificationCount: ticket.unreadNotificationCount,
    escalatedByUser: ticket.escalatedByUser,
    pendingApproval: ticket.pendingApproval ?? undefined,
    attachments: ticket.attachments,
    tokenUsage: ticket.dialog?.tokenUsage ?? undefined,
    notes: ticket.notes?.map(note => ({
      id: note.id,
      ticketId: note.ticketId,
      content: note.content,
      authorId: note.authorId,
      authorName: note.author ? `${note.author.firstName} ${note.author.lastName}`.trim() : undefined,
      authorImageUrl: note.authorImage?.imageUrl,
      authorImageHash: note.authorImage?.hash,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    })),
  };
}

export class TicketService implements TicketServiceInterface {
  async fetchDialogs(params: FetchTicketsParams): Promise<TicketsPage> {
    const paginationVars: Record<string, unknown> = { limit: params.limit };
    if (params.cursor) {
      paginationVars.cursor = params.cursor;
    }

    const filter: Record<string, unknown> = {};
    if (params.statusIds.length) {
      filter.statusIds = params.statusIds;
    }
    if (params.organizationIds?.length) {
      filter.organizationIds = params.organizationIds;
    }
    if (params.assigneeIds?.length) {
      filter.assigneeIds = params.assigneeIds;
    }
    if (params.tagIds?.length) {
      filter.tagIds = params.tagIds;
    }
    if (params.unreadOnly) {
      filter.hasUnreadNotifications = true;
    }

    const response = await apiClient.post<GraphQlResponse<TicketsResponse>>(API_ENDPOINTS.GRAPHQL, {
      query: GET_TICKETS_QUERY,
      variables: {
        filter,
        pagination: paginationVars,
        search: params.search || undefined,
      },
    });

    const data = extractGraphQlData(response);
    const connection = data.tickets;

    return {
      dialogs: (connection?.edges || []).map(edge => normalizeTicketToDialog(edge.node)),
      pageInfo: connection?.pageInfo || {
        hasNextPage: false,
        hasPreviousPage: false,
        startCursor: null,
        endCursor: null,
      },
      filteredCount: connection?.filteredCount ?? 0,
    };
  }

  async fetchBoardColumnByStatusId(params: FetchBoardColumnByStatusIdParams): Promise<TicketsPage> {
    const response = await apiClient.post<GraphQlResponse<TicketsResponse>>(API_ENDPOINTS.GRAPHQL, {
      query: getBoardColumnTicketsQuery(),
      variables: {
        statusId: params.statusId,
        limit: params.limit,
        cursor: params.cursor,
        search: params.search || undefined,
        organizationIds: params.organizationIds?.length ? params.organizationIds : undefined,
        assigneeIds: params.assigneeIds?.length ? params.assigneeIds : undefined,
        tagIds: params.tagIds?.length ? params.tagIds : undefined,
        hasUnreadNotifications: params.unreadOnly || undefined,
      },
    });

    const data = extractGraphQlData(response);
    const connection = data.tickets;

    return {
      dialogs: (connection?.edges || []).map(edge => normalizeTicketToDialog(edge.node)),
      pageInfo: connection?.pageInfo || {
        hasNextPage: false,
        hasPreviousPage: false,
        startCursor: null,
        endCursor: null,
      },
      filteredCount: connection?.filteredCount ?? 0,
    };
  }

  async fetchDialog(id: string): Promise<Dialog | null> {
    const response = await apiClient.post<GraphQlResponse<TicketResponse>>(API_ENDPOINTS.GRAPHQL, {
      query: GET_TICKET_QUERY,
      variables: { id },
    });

    const data = extractGraphQlData(response);
    if (!data.ticket) return null;

    return normalizeTicketToDialog(data.ticket);
  }

  async fetchMessages(params: FetchMessagesParams): Promise<MessagePage> {
    const response = await apiClient.post<
      GraphQlResponse<{
        messages: { edges: Array<{ cursor: string; node: Message }>; pageInfo: MessagePage['pageInfo'] };
      }>
    >('/chat/graphql', {
      query: getDialogMessagesQuery(),
      variables: {
        dialogId: params.dialogId,
        chatType: params.chatType,
        cursor: params.cursor,
        limit: params.limit,
        sortField: params.sortField || 'createdAt',
        sortDirection: params.sortDirection || 'DESC',
      },
    });

    const data = extractGraphQlData(response);
    const { edges, pageInfo } = data.messages;

    return {
      // Single parse point for the messageData field aliases — see
      // `normalizeMessageDataAliases`.
      messages: edges.map(edge => ({
        ...edge.node,
        messageData: normalizeMessageDataAliases(edge.node.messageData),
      })),
      pageInfo,
    };
  }

  async transitionTicket(ticketId: string, toStatusId: string): Promise<void> {
    const response = await apiClient.post<GraphQlResponse<Record<'transitionTicket', StatusMutationPayload>>>(
      API_ENDPOINTS.GRAPHQL,
      { query: TRANSITION_TICKET_MUTATION, variables: { input: { ticketId, toStatusId } } },
    );

    const payload = extractGraphQlData(response).transitionTicket;
    if (payload.userErrors?.length) {
      throw new Error(payload.userErrors[0].message);
    }
    if (!payload.ticket) {
      throw new Error('transitionTicket returned no ticket');
    }
  }

  async fetchTicketStatusTransitionRules(): Promise<TicketStatusTransitionRule[]> {
    const response = await apiClient.post<
      GraphQlResponse<{ ticketStatusTransitionRules: Array<{ from: { id: string }; to: Array<{ id: string }> }> }>
    >(API_ENDPOINTS.GRAPHQL, { query: GET_TICKET_STATUS_TRANSITION_RULES_QUERY });

    const data = extractGraphQlData(response);
    return data.ticketStatusTransitionRules.map(r => ({
      from: r.from.id,
      to: r.to.map(t => t.id),
    }));
  }

  async reorderTicket(params: ReorderTicketParams): Promise<DialogStatus> {
    const input: Record<string, unknown> = {
      id: params.id,
      afterTicketId: params.afterTicketId,
      beforeTicketId: params.beforeTicketId,
    };
    if (params.statusId) {
      input.statusId = params.statusId;
    }

    const response = await apiClient.post<GraphQlResponse<Record<'reorderTicket', StatusMutationPayload>>>(
      API_ENDPOINTS.GRAPHQL,
      { query: REORDER_TICKET_MUTATION, variables: { input } },
    );

    const data = extractGraphQlData(response);
    const payload = data.reorderTicket;

    if (payload.userErrors?.length) {
      throw new Error(payload.userErrors[0].message);
    }
    if (!payload.ticket) {
      throw new Error('reorderTicket returned no ticket');
    }

    return TICKET_TO_DIALOG_STATUS[payload.ticket.status] || (payload.ticket.status as DialogStatus);
  }

  async sendMessage(dialogId: string, content: string, chatType: ChatType): Promise<void> {
    const response = await apiClient.post(API_ENDPOINTS.SEND_MESSAGE, {
      dialogId,
      content,
      chatType,
    });

    if (!response.ok) {
      throw new Error(response.error || 'Failed to send message');
    }
  }

  async approveRequest(requestId: string): Promise<void> {
    const response = await apiClient.post(`${API_ENDPOINTS.APPROVAL_REQUEST}/${requestId}/approve`, {
      approve: true,
    });

    if (!response.ok) {
      throw new Error(response.error || `Failed to approve request (${response.status})`);
    }
  }

  async rejectRequest(requestId: string): Promise<void> {
    const response = await apiClient.post(`${API_ENDPOINTS.APPROVAL_REQUEST}/${requestId}/approve`, {
      approve: false,
    });

    if (!response.ok) {
      throw new Error(response.error || `Failed to reject request (${response.status})`);
    }
  }

  async fetchChunks(dialogId: string, chatType: ChatType, fromSequenceId?: number | null): Promise<ChunkData[]> {
    let url = `${API_ENDPOINTS.DIALOG_CHUNKS}/${dialogId}/chunks?chatType=${chatType}`;
    if (fromSequenceId !== null && fromSequenceId !== undefined) {
      url += `&fromSequenceId=${fromSequenceId}`;
    }

    const response = await apiClient.get<ChunkData[]>(url);

    if (!response.ok) {
      console.error(`Failed to fetch ${chatType} chunks:`, response.status);
      return [];
    }

    return response.data || [];
  }
}
