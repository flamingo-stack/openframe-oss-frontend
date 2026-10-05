'use client';

import { useCallback, useState } from 'react';
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

export function useCustomersMin(limit: number = 10) {
  const [items, setItems] = useState<OrganizationMin[]>([]);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(
    async (search: string = '') => {
      setLoading(true);
      setError(null);
      try {
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
        const mapped: OrganizationMin[] = list.map(({ node }) => ({
          id: node.id,
          organizationId: node.organizationId,
          name: node.name,
          isDefault: node.isDefault,
          imageUrl: node.image?.imageUrl,
        }));
        setItems(mapped);
        return mapped;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to fetch customers';
        setError(msg);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [limit],
  );

  return { items, isLoading, error, fetch };
}
