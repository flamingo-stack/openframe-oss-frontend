'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tenantConnectionsService } from '../services/tenant-connections-service';
import type {
  CreateTenantConnectionInput,
  TenantConnectionsFilter,
  UpdateTenantConnectionInput,
} from '../types/tenant-connection';

// react-query over the interface-typed service. Every write invalidates the whole
// key root: a probe changes the row's access tag, a rename changes the list and the
// details title, a new connection removes its customer from the picker.
export const tenantConnectionKeys = {
  all: ['tenant-connections'] as const,
  list: (filter: TenantConnectionsFilter) =>
    [...tenantConnectionKeys.all, 'list', filter.search ?? '', filter.organizationId ?? ''] as const,
  detail: (id: string) => [...tenantConnectionKeys.all, 'detail', id] as const,
  options: () => [...tenantConnectionKeys.all, 'options'] as const,
  organizations: () => [...tenantConnectionKeys.all, 'organizations'] as const,
};

// Relay's network layer already retries transient failures; a react-query retry on top
// would re-run that whole sequence (and `get`'s scan) before an error could show.
const retry = false;

export function useTenantConnections(filter: TenantConnectionsFilter = {}) {
  return useQuery({
    queryKey: tenantConnectionKeys.list(filter),
    queryFn: () => tenantConnectionsService.list(filter),
    retry,
  });
}

/** `null` data means the id is unknown — not-found, not loading. */
export function useTenantConnection(id: string) {
  return useQuery({
    queryKey: tenantConnectionKeys.detail(id),
    queryFn: () => tenantConnectionsService.get(id),
    enabled: id !== '',
    retry,
  });
}

export function useTenantConnectionOptions() {
  return useQuery({
    queryKey: tenantConnectionKeys.options(),
    queryFn: () => tenantConnectionsService.getOptions(),
    retry,
  });
}

/** The customers the picker may offer — every page, up to the service's cap (a search-less `Select` cannot page). */
export function useTenantOrganizations({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: tenantConnectionKeys.organizations(),
    queryFn: () => tenantConnectionsService.listAvailableOrganizations(),
    enabled,
    retry,
  });
}

/** Silent mutations — the caller owns toast feedback (the module's forms and flow hooks). */
export function useCreateTenantConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTenantConnectionInput) => tenantConnectionsService.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: tenantConnectionKeys.all });
    },
  });
}

export function useUpdateTenantConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTenantConnectionInput }) =>
      tenantConnectionsService.update(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: tenantConnectionKeys.all });
    },
  });
}

export function useStartTenantConsent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tenantConnectionsService.startConsent(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: tenantConnectionKeys.all });
    },
  });
}

export function useCheckTenantConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tenantConnectionsService.check(id),
    // Settled, not success: a refused probe also changes what the row shows.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: tenantConnectionKeys.all });
    },
  });
}
