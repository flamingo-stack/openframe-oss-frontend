'use client';

import { useCallback, useState } from 'react';
import { useLazyLoadQuery } from 'react-relay';
import { graphql } from 'relay-runtime';

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

interface UseCustomersMinQueryResponse {
  organizations?: {
    edges?: { node: OrganizationMinNode }[];
  };
}

const useCustomersMinQuery = graphql`
  query useCustomersMinQuery($search: String, $first: Int) {
    organizations(search: $search, first: $first) {
      edges {
        node {
          id
          organizationId
          name
          isDefault
          image {
            imageUrl
          }
        }
      }
    }
  }
`;

export function useCustomersMin(limit: number = 10) {
  const [search, setSearch] = useState('');
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const data = useLazyLoadQuery<{
    response: UseCustomersMinQueryResponse;
    variables: { search: string; first: number };
  }>(useCustomersMinQuery, { search, first: limit });

  const payload = data.organizations;
  const list = Array.isArray(payload?.edges) ? payload.edges : [];
  const items: OrganizationMin[] = list.map(({ node }) => ({
    id: node.id,
    organizationId: node.organizationId,
    name: node.name,
    isDefault: node.isDefault,
    imageUrl: node.image?.imageUrl,
  }));

  const fetch = useCallback(async (nextSearch: string = '') => {
    setLoading(true);
    setError(null);
    try {
      setSearch(nextSearch);
      return items;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to fetch customers';
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { items, isLoading, error, fetch };
}
