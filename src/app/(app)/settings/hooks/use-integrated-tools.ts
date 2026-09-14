'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core';
import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

// GraphQL query based on provided payload
// NOTE: credentials (username/password/apiKey) are intentionally NOT requested here.
// If the UI needs to indicate that credentials exist, the server should expose a
// redacted/masked representation via a dedicated field instead of returning secrets.
const GET_INTEGRATED_TOOLS_QUERY = `
  query GetIntegratedTools($filter: ToolFilterInput, $search: String) {
    integratedTools(filter: $filter, search: $search) {
      tools {
        id
        name
        description
        icon
        toolUrls {
          url
          port
          type
        }
        type
        toolType
        category
        platformCategory
        enabled
        layer
        layerOrder
        layerColor
        metricsPath
        healthCheckEndpoint
        healthCheckInterval
        connectionTimeout
        readTimeout
        allowedEndpoints
      }
    }
  }
`;

export type ToolUrl = { url: string; port?: number | null; type?: string | null };
export type ApiKey = { key: string; type?: string | null; keyName?: string | null };
export type Credentials = { username?: string | null; password?: string | null; apiKey?: ApiKey | null };
export type IntegratedTool = {
  id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  toolUrls?: ToolUrl[] | null;
  type?: string | null;
  toolType?: string | null;
  category?: string | null;
  platformCategory?: string | null;
  enabled?: boolean | null;
  credentials?: Credentials | null;
  layer?: string | null;
  layerOrder?: number | null;
  layerColor?: string | null;
};

interface GraphQlResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

type IntegratedToolsResponse = {
  integratedTools: { tools: IntegratedTool[] };
};

async function fetchIntegratedToolsRequest(
  filter: Record<string, unknown>,
  search: string,
): Promise<IntegratedTool[]> {
  const response = await apiClient.post<GraphQlResponse<IntegratedToolsResponse>>('/api/graphql', {
    query: GET_INTEGRATED_TOOLS_QUERY,
    variables: { filter, search },
  });

  if (!response.ok) {
    throw new Error(response.error || `Request failed with status ${response.status}`);
  }

  const graphql = response.data;
  if (graphql?.errors && graphql.errors.length) {
    throw new Error(graphql.errors[0].message);
  }

  return graphql?.data?.integratedTools?.tools ?? [];
}

export function useIntegratedTools(
  filter: Record<string, unknown> = { enabled: true, category: null },
  search: string = '',
) {
  const { toast } = useToast();

  const {
    data: tools = [],
    isLoading,
    error: queryError,
    refetch,
  } = useQuery<IntegratedTool[], Error>({
    queryKey: ['integrated-tools', filter, search],
    queryFn: async () => {
      try {
        return await fetchIntegratedToolsRequest(filter, search);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch integrated tools';
        toast({ title: 'Error fetching tools', description: message, variant: 'destructive' });
        throw err;
      }
    },
  });

  const fetchIntegratedTools = useCallback(async () => {
    const result = await refetch();
    if (result.error) {
      throw result.error;
    }
    return result.data ?? [];
  }, [refetch]);

  const error = queryError ? queryError.message : null;

  return { tools, isLoading, error, fetchIntegratedTools };
}
