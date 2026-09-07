'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fleetApiClient, type PolicyHost } from '@/lib/fleet-api-client';
import { handleApiError } from '@/lib/handle-api-error';
import { queriesQueryKeys } from '../../hooks/use-queries';
import { queryHostsQueryKeys } from '@/lib/query-keys/admin-query-keys';

const EMPTY_QUERY_HOSTS: PolicyHost[] = [];

// ============ API Functions ============

const MAX_QUERY_HOSTS_PAGES = 1000;

async function fetchAllQueryHosts(queryId: number): Promise<PolicyHost[]> {
  const allHosts: PolicyHost[] = [];
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    if (page >= MAX_QUERY_HOSTS_PAGES) {
      throw new Error('Failed to load query hosts: exceeded maximum pagination limit');
    }
    const res = await fleetApiClient.getQueryHosts(queryId, { page, per_page: 100 });
    if (!res.ok) {
      throw new Error(res.error || `Failed to load query hosts (${res.status})`);
    }
    const hosts = res.data?.hosts ?? [];
    allHosts.push(...hosts);
    hasMore = res.data?.meta?.has_next_results ?? false;
    page++;
  }

  return allHosts;
}

async function replaceQueryHostsApi(params: { queryId: number; hostIds: number[] }): Promise<void> {
  const res = await fleetApiClient.replaceQueryHosts(params.queryId, params.hostIds);
  if (!res.ok) {
    throw new Error(res.error || `Failed to update query hosts (${res.status})`);
  }
}

// ============ Hooks ============

export function useQueryHosts(queryId: number | null) {
  const query = useQuery({
    queryKey: queryHostsQueryKeys.list(queryId),
    queryFn: queryId === null ? skipToken : () => fetchAllQueryHosts(queryId),
  });

  return {
    hosts: query.data ?? EMPTY_QUERY_HOSTS,
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
    refetch: query.refetch,
  };
}

export function useReplaceQueryHosts() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: replaceQueryHostsApi,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryHostsQueryKeys.list(variables.queryId) });
      queryClient.invalidateQueries({ queryKey: queriesQueryKeys.detail(variables.queryId) });
    },
    onError: error => {
      handleApiError(error, toast, 'Failed to assign devices to query');
    },
  });
}
