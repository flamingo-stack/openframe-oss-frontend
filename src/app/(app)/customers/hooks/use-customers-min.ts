'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { GET_ORGANIZATIONS_MIN_QUERY } from '../queries/customers-queries';

export interface OrganizationMin {
  id: string;
  organizationId: string;
  name: string;
  isDefault: boolean;
  imageUrl?: string;
}

/** The organization node the min query selects, before it is flattened above. */
interface OrganizationMinNode {
  id: string;
  organizationId: string;
  name: string;
  isDefault: boolean;
  image?: { imageUrl?: string } | null;
}

export const customersMinQueryKey = (limit: number, search: string) =>
  ['customers', 'min', { limit, search }] as const;

async function fetchCustomersMin(limit: number, search: string): Promise<OrganizationMin[]> {
  const response = await apiClient.post<{
    data?: { organizations?: { edges?: { node: OrganizationMinNode }[] } };
  }>('/api/graphql', {
    query: GET_ORGANIZATIONS_MIN_QUERY,
    variables: { search, first: limit },
  });

  if (!response.ok) {
    throw new Error(response.error || `Request failed with status ${response.status}`);
  }

  const payload = response.data?.data?.organizations;
  const list = Array.isArray(payload?.edges) ? payload.edges : [];
  return list.map(({ node }) => ({
    id: node.id,
    organizationId: node.organizationId,
    name: node.name,
    isDefault: node.isDefault,
    imageUrl: node.image?.imageUrl,
  }));
}

export function useCustomersMin(limit: number = 10, search: string = '') {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: customersMinQueryKey(limit, search),
    queryFn: () => fetchCustomersMin(limit, search),
  });

  return {
    items: data ?? [],
    isLoading,
    error: error instanceof Error ? error.message : null,
    fetch: refetch,
  };
}
