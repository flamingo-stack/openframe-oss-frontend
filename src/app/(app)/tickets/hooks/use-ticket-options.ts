'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { GET_ORGANIZATIONS_MIN_QUERY } from '@/app/(app)/customers/queries/customers-queries';
import { DEFAULT_DEVICES_LIST_STATUSES } from '@/app/(app)/devices/constants/device-statuses';
import { fetchDevicesPage } from '@/app/(app)/devices/queries/devices-api';
import { deviceQueryKeys } from '@/app/(app)/devices/utils/query-keys';
import { isDeletedUserStatus } from '@/app/components/shared/deleted-user';
import type { Tag } from '@/app/components/shared/tags';
import { apiClient } from '@/lib/api-client';
import { getFullImageUrl } from '@/lib/image-url';
import { useAuthStore } from '@/stores';
import { API_ENDPOINTS } from '../constants';
import { GET_TICKET_LABELS_QUERY, GET_TICKETS_QUERY } from '../queries/ticket-queries';
import { useTicketStatusesQuery } from '../statuses/hooks/use-ticket-statuses-query';
import type { GraphQlResponse } from '../utils/graphql';
import { extractGraphQlData } from '../utils/graphql';
import { ticketsQueryKeys } from '../utils/query-keys';

export interface AutocompleteOption {
  label: string;
  value: string;
}

export interface AvatarOption extends AutocompleteOption {
  imageUrl?: string;
}

const EMPTY_AUTOCOMPLETE_OPTIONS: AutocompleteOption[] = [];
const EMPTY_AVATAR_OPTIONS: AvatarOption[] = [];

// --- Organizations (reuse existing query via /api/graphql) ---

async function fetchCustomerOptions(search: string): Promise<AvatarOption[]> {
  const response = await apiClient.post<any>('/api/graphql', {
    query: GET_ORGANIZATIONS_MIN_QUERY,
    variables: { search, first: 50 },
  });
  if (!response.ok) throw new Error(response.error || 'Failed to fetch customers');

  const edges = response.data?.data?.organizations?.edges ?? [];
  return edges.map(({ node }: any) => ({
    label: node.name,
    value: node.organizationId,
    imageUrl: getFullImageUrl(node.image?.imageUrl, node.image?.hash),
  }));
}

export function useOrganizationOptions(search = '', enabled = true) {
  const query = useQuery({
    queryKey: ['ticket-options', 'organizations', search],
    queryFn: () => fetchCustomerOptions(search),
    enabled,
  });

  return { options: query.data ?? EMPTY_AVATAR_OPTIONS, isLoading: query.isLoading };
}

// --- Devices (shared device query layer) ---

const DEVICE_OPTIONS_LIMIT = 50;

/**
 * The customer's devices, offered in the ticket form. Runs the same Relay
 * document, ordering and transform as the Devices page, so the dropdown shows
 * the same fleet the `/devices` table does — ONLINE/OFFLINE only, since PENDING
 * devices are still enrolling and ARCHIVED/DELETED live elsewhere.
 *
 * Imperative `fetchDevicesPage` rather than the suspending `useDeviceList`: this
 * re-queries on every keystroke, and a Suspense boundary would blank the open
 * dropdown between characters. react-query keeps the previous options on screen
 * while the next search resolves — the rows still land in the Relay store.
 */
export function useDeviceOptions(organizationId?: string, search = '') {
  // One object for both the cache key and the request — spelling the filter out
  // twice let them drift, and a key that doesn't describe its request caches the
  // wrong answer.
  const filter = useMemo(
    () => ({
      statuses: [...DEFAULT_DEVICES_LIST_STATUSES],
      ...(organizationId && { organizationIds: [organizationId] }),
    }),
    [organizationId],
  );

  const query = useQuery({
    queryKey: deviceQueryKeys.page(filter, search, DEVICE_OPTIONS_LIMIT),
    queryFn: () => fetchDevicesPage({ filter, search, first: DEVICE_OPTIONS_LIMIT }),
    enabled: !!organizationId,
    // `search` is part of the key, so every keystroke is a NEW query and `data`
    // would be undefined until it resolves — the open dropdown emptying itself
    // between characters. Verified in a browser: without this the option list
    // goes 4 → 0 → 4 on each refinement.
    placeholderData: keepPreviousData,
  });

  const options = useMemo<AutocompleteOption[]>(
    () =>
      (query.data?.devices ?? []).map(device => ({
        label: device.displayName || device.hostname || device.machineId,
        value: device.machineId,
      })),
    [query.data],
  );

  return { options, isLoading: query.isLoading };
}

// --- Users / Assignees (REST via /api/users) ---

async function fetchAssigneeOptions(): Promise<AvatarOption[]> {
  const response = await apiClient.get<any>('/api/users?page=0&size=100');
  if (!response.ok) throw new Error(response.error || 'Failed to fetch users');

  const items = response.data?.items ?? [];
  // Deleted (DELETED / SELF_DELETED) users are not assignable and are kept out
  // of assignee pickers/filters; existing assignments still render (marked as
  // deleted) via useUserStatusMap on the display side.
  return items
    .filter((user: any) => !isDeletedUserStatus(user.status))
    .map((user: any) => ({
      label: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email,
      value: user.id,
      imageUrl: getFullImageUrl(user.image?.imageUrl, user.image?.hash),
    }));
}

export function useAssigneeOptions(enabled = true) {
  const query = useQuery({
    queryKey: ['ticket-options', 'assignees'],
    queryFn: fetchAssigneeOptions,
    enabled,
  });

  return { options: query.data ?? EMPTY_AVATAR_OPTIONS, isLoading: query.isLoading };
}

/** Move the signed-in user to the top of an assignee option list (self-assign shortcut). */
export function sortSelfFirst<T extends AutocompleteOption>(options: T[], currentUserId: string | undefined): T[] {
  const idx = currentUserId ? options.findIndex(o => o.value === currentUserId) : -1;
  if (idx <= 0) return options;
  return [options[idx], ...options.slice(0, idx), ...options.slice(idx + 1)];
}

/** Assignee options with the signed-in user surfaced first. */
export function useSelfFirstAssigneeOptions(enabled = true) {
  const { options, isLoading } = useAssigneeOptions(enabled);
  const currentUserId = useAuthStore(state => state.user?.id);
  const sortedOptions = useMemo(() => sortSelfFirst(options, currentUserId), [options, currentUserId]);
  return { options: sortedOptions, isLoading };
}

// --- Labels (ticket-specific, via /chat/graphql) ---

async function fetchLabelOptions(): Promise<AutocompleteOption[]> {
  const response = await apiClient.post<GraphQlResponse<{ ticketLabels: Tag[] }>>(API_ENDPOINTS.GRAPHQL, {
    query: GET_TICKET_LABELS_QUERY,
  });
  const data = extractGraphQlData(response);
  return (data.ticketLabels ?? []).map(label => ({
    label: label.key,
    value: label.id,
  }));
}

export function useTicketLabelOptions() {
  const query = useQuery({
    queryKey: ticketsQueryKeys.labels(),
    queryFn: fetchLabelOptions,
  });

  return { options: query.data ?? EMPTY_AUTOCOMPLETE_OPTIONS, isLoading: query.isLoading };
}

// --- Ticket search ---

interface TicketSearchNode {
  id: string;
  ticketNumber: number | null;
  title: string | null;
  organizationId: string | null;
  organizationName: string | null;
  organizationImage?: { imageUrl?: string | null; hash?: string | null } | null;
  statusDefinition?: { kind?: string | null } | null;
}

/** A ticket option carrying its organization, so the customer field can be derived from it. */
export interface TicketSearchOption extends AutocompleteOption {
  organizationId?: string | null;
  organizationName?: string | null;
  organizationImageUrl?: string | null;
}

const EMPTY_TICKET_SEARCH_OPTIONS: TicketSearchOption[] = [];

async function fetchTicketSearchOptions(
  search: string,
  organizationId?: string,
  statusIds?: string[],
): Promise<TicketSearchOption[]> {
  const filter: Record<string, unknown> = {};
  if (organizationId) filter.organizationIds = [organizationId];
  // Scope to non-archived statuses so archived tickets aren't offered (and don't consume the
  // result limit). Client-side `kind` check below is a safety net if the id list is unavailable.
  if (statusIds?.length) filter.statusIds = statusIds;

  const response = await apiClient.post<GraphQlResponse<{ tickets: { edges: Array<{ node: TicketSearchNode }> } }>>(
    API_ENDPOINTS.GRAPHQL,
    {
      query: GET_TICKETS_QUERY,
      variables: {
        search: search || undefined,
        filter: Object.keys(filter).length ? filter : undefined,
        pagination: { limit: 50 },
      },
    },
  );
  const data = extractGraphQlData(response);
  return (data.tickets?.edges ?? [])
    .filter(({ node }) => node.statusDefinition?.kind !== 'ARCHIVED')
    .map(({ node }) => {
      const number = node.ticketNumber != null ? `#${node.ticketNumber}` : '';
      const label = [number, node.title].filter(Boolean).join(' ') || node.id;
      return {
        label,
        value: node.id,
        organizationId: node.organizationId,
        organizationName: node.organizationName,
        organizationImageUrl: getFullImageUrl(node.organizationImage?.imageUrl, node.organizationImage?.hash),
      };
    });
}

export function useTicketSearchOptions(search = '', organizationId?: string) {
  const statusesQuery = useTicketStatusesQuery({ enabled: true });
  const nonArchivedStatusIds = useMemo(
    () => statusesQuery.data?.snapshot.filter(status => status.kind !== 'ARCHIVED').map(status => status.id),
    [statusesQuery.data],
  );

  const query = useQuery({
    queryKey: ['ticket-options', 'tickets', search, organizationId ?? null, nonArchivedStatusIds ?? null],
    queryFn: () => fetchTicketSearchOptions(search, organizationId, nonArchivedStatusIds),
    enabled: !statusesQuery.isLoading,
  });

  return {
    options: query.data ?? EMPTY_TICKET_SEARCH_OPTIONS,
    isLoading: statusesQuery.isLoading || query.isLoading,
  };
}

/** Build a customer (organization) autocomplete option from a ticket, or null when it has none. */
export function customerOptionFromTicket(ticket: TicketSearchOption | null | undefined): AvatarOption | null {
  if (!ticket?.organizationId) return null;
  return {
    value: ticket.organizationId,
    label: ticket.organizationName || ticket.organizationId,
    imageUrl: ticket.organizationImageUrl ?? undefined,
  };
}
