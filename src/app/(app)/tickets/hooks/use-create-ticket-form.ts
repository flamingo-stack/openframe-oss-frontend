'use client';
'use no memo';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { isOptimisticTagId } from '@/app/components/shared/tags';
import { safeBackOrReplace } from '@/app/hooks/use-safe-back';
import { useApplyAssignmentsDiff, useAssignedItems } from '@/components/assignments';
import { EVENT_SUBTYPE, trackDashboardActivity } from '@/lib/analytics';
import { apiClient } from '@/lib/api-client';
import { queryState } from '@/lib/query-state';
import { routes } from '@/lib/routes';
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
  const router = useRouter();
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

  // Everything the prefill needs, from a fetch made AFTER mount. `editForm`
  // keeps the previous session's ticket for gcTime and the save-time
  // invalidation only refetches ACTIVE observers, so a re-opened form would
  // otherwise seed itself from the pre-save values. The status conjunct is for
  // legacy tickets, whose current status resolves only once the snapshot is in;
  // a settled snapshot that still resolves nothing (legacy ON_HOLD) proceeds
  // without one.
  const statusReady = !!currentStatus || !statusesQuery.isPending;
  const prefillReady =
    isEditMode && !!ticket && ticketQuery.isFetchedAfterMount && assignedItems.isReady && statusReady;

  // Prefill exactly once per ticket. `tempAttachments` is a new object on
  // every render (its callbacks key on TanStack's per-render mutation object)
  // and `form.reset` re-renders the `useForm` owner, so a prefill that re-ran
  // on every dependency change was a render loop — and wiped every edit on the
  // way. The ref, not the dependency list, is what makes this run once.
  const prefilledTicketId = useRef<string | null>(null);
  useEffect(() => {
    if (!prefillReady || !ticket || prefilledTicketId.current === ticket.id) return;
    prefilledTicketId.current = ticket.id;

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
  }, [prefillReady, ticket, form, tempAttachments, assignedItems.value, currentStatus?.id]);

  // Navigation is the LAST step here, not a mutation's `onSuccess`: the
  // assignments diff runs after the ticket write, and a failure there has to
  // land on this form — toast, input intact — not on the page after it. Every
  // awaited call toasts and rejects on its own, so the catch only keeps the
  // rejection from going unhandled (and lets `formState.isSubmitting` settle).
  const handleSave = form.handleSubmit(async data => {
    const nextAssignments = data.assignments ?? {};
    // A tag whose create is still in flight holds a placeholder id the backend
    // has never seen; the picker swaps in the persisted id when the create lands.
    const tagIds = data.tagIds.filter(id => !isOptimisticTagId(id));
    const tempAttachmentIds = tempAttachments.getTempAttachmentIds();

    try {
      if (isEditMode && ticketId) {
        if (tempAttachments.hasPendingDeletes) {
          await tempAttachments.deleteRemovedAttachments();
        }

        // Transition before the field write: a rejected transition leaves the
        // ticket untouched, while the reverse order leaves it half-saved.
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
          tagIds,
          tempAttachmentIds: tempAttachmentIds.length ? tempAttachmentIds : undefined,
        });

        await applyAssignmentsDiff({
          itemId: ticketId,
          itemType: 'TICKET',
          prev: assignedItems.value,
          next: nextAssignments,
        });

        safeBackOrReplace(router, routes.tickets.dialog(ticketId));
      } else {
        const created = await createTicketMutation.mutateAsync({
          title: data.title,
          description: data.description || undefined,
          statusId: data.statusId || undefined,
          organizationId: data.organizationId || undefined,
          deviceId: data.deviceId || undefined,
          assigneeId: data.assignedTo || undefined,
          tagIds: tagIds.length ? tagIds : undefined,
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

        router.replace(created?.id ? routes.tickets.dialog(created.id) : routes.tickets.list);
      }
    } catch {
      // Reported by the mutation that threw; see above.
    }
  });

  const isFaeForm = ticket?.creationSource === CREATION_SOURCE.FAE_FORM;

  return {
    form,
    ticket,
    isEditMode,
    isLoadingTicket,
    // Gates Save in edit mode: the form has been seeded from a post-mount fetch.
    // `isLoadingTicket` cannot: offline the query PAUSES and reports false with
    // no data, so the form renders blank and Save writes those blanks over the
    // real ticket. `hasData` cannot either: it is true for a stale cache entry
    // and true before the assignments answer, and a Save in either window writes
    // the defaults (null org/device/assignee, no tags) over the ticket.
    ticketLoaded: prefillReady,
    // The whole `handleSave` run, attachment deletes and the assignments diff
    // included — the mutations' own pending flags left Save re-enabled between
    // steps, and a second click mid-save re-sent the write.
    isSubmitting: form.formState.isSubmitting,
    handleSave,
    tempAttachments,
    isFaeForm,
  };
}
