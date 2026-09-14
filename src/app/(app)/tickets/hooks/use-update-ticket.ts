'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { API_ENDPOINTS } from '../constants';
import {
  ASSIGN_TICKET_MUTATION,
  UNASSIGN_TICKET_MUTATION,
  UNLINK_DEVICE_FROM_TICKET_MUTATION,
  UNLINK_ORGANIZATION_FROM_TICKET_MUTATION,
  UPDATE_TICKET_MUTATION,
} from '../queries/ticket-queries';
import type { Ticket, TicketPayload, UpdateTicketInput } from '../types/ticket.types';
import type { GraphQlResponse } from '../utils/graphql';
import { extractGraphQlData } from '../utils/graphql';
import { dialogsQueryKeys, ticketsQueryKeys } from '../utils/query-keys';

/**
 * Error wrapper that records which step of the multi-mutation ticket update
 * sequence failed, so callers/toasts can distinguish a partial update from a
 * fully-failed one.
 */
export class TicketUpdateStepError extends Error {
  readonly step: string;
  readonly cause?: unknown;

  constructor(step: string, cause: unknown) {
    const message = cause instanceof Error ? cause.message : 'Failed to update ticket';
    super(message);
    this.name = 'TicketUpdateStepError';
    this.step = step;
    this.cause = cause;
  }
}

async function runTicketMutation<K extends string>(
  query: string,
  variables: Record<string, unknown>,
  key: K,
): Promise<Ticket | null> {
  const response = await apiClient.post<GraphQlResponse<Record<K, TicketPayload>>>(API_ENDPOINTS.GRAPHQL, {
    query,
    variables,
  });

  const data = extractGraphQlData(response);
  const payload = data[key];

  if (payload.userErrors?.length) {
    throw new Error(payload.userErrors[0].message);
  }

  return payload.ticket;
}

async function runTicketMutationStep<K extends string>(
  step: string,
  query: string,
  variables: Record<string, unknown>,
  key: K,
): Promise<Ticket | null> {
  try {
    return await runTicketMutation(query, variables, key);
  } catch (err) {
    throw new TicketUpdateStepError(step, err);
  }
}

async function updateTicketApi(input: UpdateTicketInput): Promise<Ticket | null> {
  const { id, deviceId, organizationId, assigneeId, ...rest } = input;
  let latest: Ticket | null = null;

  if (organizationId === null) {
    latest = await runTicketMutationStep(
      'unlinkOrganizationFromTicket',
      UNLINK_ORGANIZATION_FROM_TICKET_MUTATION,
      { input: { id } },
      'unlinkOrganizationFromTicket',
    );
  }

  if (deviceId === null) {
    latest = await runTicketMutationStep(
      'unlinkDeviceFromTicket',
      UNLINK_DEVICE_FROM_TICKET_MUTATION,
      { input: { id } },
      'unlinkDeviceFromTicket',
    );
  }

  if (assigneeId === null) {
    latest = await runTicketMutationStep(
      'unassignTicket',
      UNASSIGN_TICKET_MUTATION,
      { input: { id } },
      'unassignTicket',
    );
  } else if (typeof assigneeId === 'string') {
    latest = await runTicketMutationStep(
      'assignTicket',
      ASSIGN_TICKET_MUTATION,
      { input: { id, assigneeId } },
      'assignTicket',
    );
  }

  const updateInput: UpdateTicketInput = { id, ...rest };
  if (typeof deviceId === 'string') updateInput.deviceId = deviceId;
  if (typeof organizationId === 'string') updateInput.organizationId = organizationId;

  const hasFieldsToUpdate = Object.keys(updateInput).some(
    k => k !== 'id' && updateInput[k as keyof UpdateTicketInput] !== undefined,
  );

  if (hasFieldsToUpdate) {
    latest = await runTicketMutationStep('updateTicket', UPDATE_TICKET_MUTATION, { input: updateInput }, 'updateTicket');
  }

  return latest;
}

/**
 * Writes the ticket and reports it; navigation is the form's job
 * (`useCreateTicketForm`), which still has assignments to apply afterwards.
 */
export function useUpdateTicket() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateTicketApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ticketsQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: dialogsQueryKeys.all });
      toast({ title: 'Success', description: 'Ticket updated successfully', variant: 'success' });
    },
    onError: err => {
      // Some mutations may have already succeeded before this step failed,
      // so surface which step failed and refresh data to reflect the
      // partially-applied state rather than leaving stale cached data.
      if (err instanceof TicketUpdateStepError) {
        queryClient.invalidateQueries({ queryKey: ticketsQueryKeys.all });
        queryClient.invalidateQueries({ queryKey: dialogsQueryKeys.all });
        toast({
          title: 'Error',
          description: `Ticket update partially failed at step "${err.step}": ${err.message}`,
          variant: 'destructive',
        });
        return;
      }
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to update ticket',
        variant: 'destructive',
      });
    },
  });
}
