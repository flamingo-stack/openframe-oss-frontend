'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tenantConnectionsService } from '../services/tenant-connections-service';
import type {
  CreateTenantConnectionInput,
  TenantConnectionsFilter,
  TenantOrganization,
  UpdateTenantConnectionInput,
} from '../types/tenant-connection';

// react-query over the interface-typed service singleton (the remote-access
// hooks' shape). Every write invalidates the whole key root: a probe changes the
// row's access tag, a rename changes the list and the details title, a new
// connection removes its customer from the picker.
export const tenantConnectionKeys = {
  all: ['tenant-connections'] as const,
  list: (filter: TenantConnectionsFilter) =>
    [...tenantConnectionKeys.all, 'list', filter.search ?? '', filter.organizationId ?? ''] as const,
  detail: (id: string) => [...tenantConnectionKeys.all, 'detail', id] as const,
  options: () => [...tenantConnectionKeys.all, 'options'] as const,
  organizations: (includeOrganizationId?: string) =>
    [...tenantConnectionKeys.all, 'organizations', includeOrganizationId ?? ''] as const,
};

export function useTenantConnections(filter: TenantConnectionsFilter = {}) {
  return useQuery({
    queryKey: tenantConnectionKeys.list(filter),
    queryFn: () => tenantConnectionsService.list(filter),
  });
}

/** `null` data means the id is unknown — not-found, not loading. */
export function useTenantConnection(id: string) {
  return useQuery({
    queryKey: tenantConnectionKeys.detail(id),
    queryFn: () => tenantConnectionsService.get(id),
    enabled: id !== '',
  });
}

export function useTenantConnectionOptions() {
  return useQuery({
    queryKey: tenantConnectionKeys.options(),
    queryFn: () => tenantConnectionsService.getOptions(),
  });
}

/**
 * The customers the picker may offer: every page of
 * `directoryConnectionOrganizations` up to a cap. A search-less `Select` cannot
 * page on demand, so the pages are exhausted here; the cap is the point where the
 * design has to gain a search box.
 */
export const TENANT_ORGANIZATIONS_PAGE_SIZE = 100;
export const TENANT_ORGANIZATIONS_CAP = 500;

export function useTenantOrganizations(options: { includeOrganizationId?: string; enabled?: boolean } = {}) {
  const { includeOrganizationId, enabled = true } = options;
  return useQuery({
    queryKey: tenantConnectionKeys.organizations(includeOrganizationId),
    queryFn: async (): Promise<TenantOrganization[]> => {
      const items: TenantOrganization[] = [];
      let after: string | null = null;
      do {
        const page = await tenantConnectionsService.listAvailableOrganizations({
          first: TENANT_ORGANIZATIONS_PAGE_SIZE,
          after,
          includeOrganizationId,
        });
        items.push(...page.items);
        after = page.hasNextPage ? page.endCursor : null;
        if (items.length >= TENANT_ORGANIZATIONS_CAP) {
          if (process.env.NODE_ENV === 'development') {
            console.warn(
              `[tenant-management] customer picker stopped at ${TENANT_ORGANIZATIONS_CAP} organizations — the picker needs a search box`,
            );
          }
          break;
        }
      } while (after);
      return items;
    },
    enabled,
    // The key changes when the bound customer is asked back (after Generate, on
    // Edit); the previous list stays on screen instead of a blank, disabled field.
    placeholderData: keepPreviousData,
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
