'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useApplyAssignmentsDiff, useAssignedItems } from '@/components/assignments';
import { EVENT_SUBTYPE, trackDashboardActivity } from '@/lib/analytics';
import { apiClient } from '@/lib/api-client';
import { queryState } from '@/lib/query-state';
import { API_ENDPOINTS, CREATION_SOURCE } from '../constants';
import { GET_TICKET_QUERY } from '../queries/ticket-queries';
import { useTicketStatusesQuery } from '../statuses/hooks/use-ticket-statuses-query';
import { type CreateTicketFormData, createTicketSchema } from '../types/create-ticket.types';
import type { Ticket } from '../types/ticket.types';
import type { GraphQlResponse } from '../utils/graphql';
import { extractGraphQlData } from '../utils/graphql';
import { isResolvedStatusId } from '../utils/is-resolved-status';
import { ticketsQueryKeys } from '../utils/query-keys';
import { resolveCurrentStatus } from '../utils/resolve-current-status';
import { useCreateTicket } from './use-create-ticket';
import { useTempAttachments } from './use-temp-attachments';
import { useTransitionTicket } from './use-transition-ticket';
import { useUpdateTicket } from './use-update-ticket';

interface UseCreateTicketFormOptions {
  ticketId?: string | null;
}

export function useCreateTicketForm({ ticketId }: UseCreateTicketFormOptions = {}) {
  const isEditMode = !!ticketId;
  const createTicketMutation = useCreateTicket();
  const updateTicketMutation = useUpdateTicket();
  const transitionTicketMutation = useTransitionTicket();
  const tempAttachments = useTempAttachments();
  const { mutateAsync: applyAssignmentsDiff } = useApplyAssignmentsDiff();

  const ticketQuery = useQuery({
    queryKey: ticketsQueryKeys.editForm(ticketId || ''),
    queryFn: async () => {
      const response = await apiClient.post<GraphQlResponse<{ ticket: Ticket }>>(API_ENDPOINTS.GRAPHQL, {
        query: GET_TICKET_QUERY,
        variables: { id: ticketId },
      });
      return extractGraphQlData(response).ticket;
    },
    enabled: isEditMode,
    // Always refetch on open so status/assignee edits reflect transitions made elsewhere
    // (the edit-form key isn't covered by every detail-only invalidation).
    staleTime: 0,
  });
  const ticket = ticketQuery.data;
  // `gate: 'closed'` outside edit mode — the query never runs there, so it must
  // not report loading.
  const ticketState = queryState(ticketQuery, isEditMode ? 'open' : 'closed');
  const isLoadingTicket = ticketState.isLoading;

  // Resolve the ticket's current status (statusDefinition, or the legacy-status fallback
  // for tickets with no statusId) so edit mode can prefill it.
  const statusesQuery = useTicketStatusesQuery({ enabled: isEditMode });
  const currentStatus = resolveCurrentStatus(ticket, statusesQuery.data?.snapshot);

  const form = useForm<CreateTicketFormData>({
    resolver: zodResolver(createTicketSchema),
    defaultValues: {
      title: '',
      statusId: undefined,
      organizationId: undefined,
      deviceId: undefined,
      userId: undefined,
      assignedTo: undefined,
      type: 'text',
      tagIds: [],
      description: '',
      assignKnowledgeBase: false,
      assignments: {},
    },
  });

  const assignedItems = useAssignedItems({
    itemId: ticketId ?? null,
    itemType: 'TICKET',
    enabled: isEditMode,
  });

  // Prefill form when ticket data loads
  useEffect(() => {
    if (ticket && isEditMode && assignedItems.isReady) {
      form.reset({
        title: ticket.title || '',
        description: ticket.description || '',
        statusId: currentStatus?.id || undefined,
        organizationId: ticket.organizationId || undefined,
        deviceId: ticket.deviceId || undefined,
        assignedTo: ticket.assignedTo || undefined,
        userId: undefined,
        type: 'text',
        tagIds: ticket.tags?.map(t => t.id) || [],
        assignKnowledgeBase: false,
        assignments: assignedItems.value,
      });

      if (ticket.attachments?.length) {
        tempAttachments.initializeExisting(ticket.attachments);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tempAttachments.initializeExisting is stable (useCallback)
  }, [
    ticket,
    isEditMode,
    form,
    tempAttachments.initializeExisting,
    assignedItems.isReady,
    assignedItems.value,
    currentStatus?.id,
  ]);

  const handleSave = form.handleSubmit(async data => {
    const nextAssignments = data.assignments ?? {};
    if (isEditMode && ticketId) {
      const tempAttachmentIds = tempAttachments.getTempAttachmentIds();

      if (tempAttachments.hasPendingDeletes) {
        await tempAttachments.deleteRemovedAttachments();
      }

      // Transition first: updateTicket's onSuccess navigates away, so a failed
      // transition afterwards would strand the user on the next page mid-error.
      if (data.statusId && data.statusId !== currentStatus?.id) {
        // Editing a ticket into a RESOLVED-kind status is also a "resolve".
        // Track optimistically before the mutation, same as the detail-view
        // status changer (see isResolvedStatusId).
        if (isResolvedStatusId(data.statusId, statusesQuery.data?.snapshot)) {
          trackDashboardActivity(EVENT_SUBTYPE.RESOLVE_TICKET);
        }
        await transitionTicketMutation.mutateAsync({ ticketId, toStatusId: data.statusId });
      }

      await updateTicketMutation.mutateAsync({
        id: ticketId,
        title: data.title,
        description: data.description || undefined,
        organizationId: data.organizationId ?? null,
        deviceId: data.deviceId ?? null,
        assigneeId: data.assignedTo ?? null,
        tagIds: data.tagIds,
        tempAttachmentIds: tempAttachmentIds.length ? tempAttachmentIds : undefined,
      });

      await applyAssignmentsDiff({
        itemId: ticketId,
        itemType: 'TICKET',
        prev: assignedItems.value,
        next: nextAssignments,
      });
    } else {
      const tempAttachmentIds = tempAttachments.getTempAttachmentIds();

      const created = await createTicketMutation.mutateAsync({
        title: data.title,
        description: data.description || undefined,
        statusId: data.statusId || undefined,
        organizationId: data.organizationId || undefined,
        deviceId: data.deviceId || undefined,
        assigneeId: data.assignedTo || undefined,
        tagIds: data.tagIds.length ? data.tagIds : undefined,
        tempAttachmentIds: tempAttachmentIds.length ? tempAttachmentIds : undefined,
      });

      if (created?.id && Object.keys(nextAssignments).length > 0) {
        await applyAssignmentsDiff({
          itemId: created.id,
          itemType: 'TICKET',
          prev: {},
          next: nextAssignments,
        });
      }
    }
  });

  const isFaeForm = ticket?.creationSource === CREATION_SOURCE.FAE_FORM;

  return {
    form,
    ticket,
    isEditMode,
    isLoadingTicket,
    // Gates Save in edit mode. `isLoadingTicket` cannot: offline the query PAUSES
    // and reports false with no data, so the form renders blank and Save writes
    // those blanks over the real ticket.
    ticketLoaded: ticketState.hasData,
    isSubmitting:
      createTicketMutation.isPending || updateTicketMutation.isPending || transitionTicketMutation.isPending,
    handleSave,
    tempAttachments,
    isFaeForm,
  };
}
