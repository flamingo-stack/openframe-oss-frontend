'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';
import { apiClient } from '@/lib/api-client';
import { DEVICE_STATUS } from '../../devices/constants/device-statuses';
import { fetchDeviceCounts } from '../../devices/queries/devices-api';
import type { GraphQlResponse } from '../../devices/types/device.types';
import { dashboardQueryKeys } from '../utils/query-keys';

type OrganizationNode = {
  id: string;
  organizationId: string;
  name: string;
  websiteUrl?: string;
  image?: {
    imageUrl?: string;
    hash?: string;
  };
};

type OrganizationsResponse = {
  organizations: {
    edges: Array<{ node: OrganizationNode }>;
    pageInfo: { hasNextPage: boolean; endCursor?: string };
    filteredCount: number;
  };
};

export interface OrganizationOverviewRow {
  id: string;
  organizationId: string;
  name: string;
  websiteUrl: string;
  imageUrl: string | null;
  imageHash: string | null;
  total: number;
  active: number;
  inactive: number;
  activePct: number;
  inactivePct: number;
}

const GET_ORGANIZATIONS_QUERY = `
  query GetOrganizations($first: Int) {
    organizations(first: $first) {
      filteredCount
      edges {
        node {
          id
          organizationId
          name
          websiteUrl
          image {
            imageUrl
            hash
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

const NO_COUNTS: ReadonlyMap<string, number> = new Map();

/**
 * Device counts per organization, degrading to zeroes rather than failing.
 *
 * The section's subject is the customer list; the device columns are a detail of
 * it. A counter request that fails should leave those columns at 0, not collapse
 * the whole section into its "No Customers added yet" empty state.
 */
async function countsByOrganization(
  organizationIds: string[],
  statuses: string[],
): Promise<ReadonlyMap<string, number>> {
  try {
    const counts = await fetchDeviceCounts({ organizationIds, statuses });
    return counts.byOrganization;
  } catch (error) {
    console.warn('Customer device counts fetch failed:', error);
    return NO_COUNTS;
  }
}

async function fetchCustomersOverview(_limit: number): Promise<{
  rows: OrganizationOverviewRow[];
  totalOrganizations: number;
}> {
  try {
    const orgsResponse = await apiClient.post<GraphQlResponse<OrganizationsResponse>>('/api/graphql', {
      query: GET_ORGANIZATIONS_QUERY,
      variables: { first: 100 },
    });

    if (!orgsResponse.ok) {
      console.warn('Organizations overview API failed:', orgsResponse.error || orgsResponse.status);
      return { rows: [], totalOrganizations: 0 };
    }

    const orgsData = orgsResponse.data?.data?.organizations;
    if (!orgsData) {
      console.warn('Invalid organizations overview response structure');
      return { rows: [], totalOrganizations: 0 };
    }

    const totalOrganizations = orgsData.filteredCount || 0;
    const organizations = orgsData.edges.map(edge => edge.node);

    if (organizations.length === 0) {
      return { rows: [], totalOrganizations };
    }

    const allOrgIds = organizations.map(org => org.organizationId);

    // Three per-organization breakdowns: the total plus each half of it. The
    // facet query returns one count per organization for the statuses it is
    // scoped to, so online and offline need their own pass.
    const [totalCounts, onlineCounts, offlineCounts] = await Promise.all([
      countsByOrganization(allOrgIds, [DEVICE_STATUS.ONLINE, DEVICE_STATUS.OFFLINE]),
      countsByOrganization(allOrgIds, [DEVICE_STATUS.ONLINE]),
      countsByOrganization(allOrgIds, [DEVICE_STATUS.OFFLINE]),
    ]);

    const rows: OrganizationOverviewRow[] = organizations
      .map(org => {
        const total = totalCounts.get(org.organizationId) || 0;
        const active = onlineCounts.get(org.organizationId) || 0;
        const inactive = offlineCounts.get(org.organizationId) || 0;
        const activePct = total > 0 ? Math.round((active / total) * 100) : 0;
        const inactivePct = total > 0 ? Math.round((inactive / total) * 100) : 0;

        return {
          id: org.id,
          organizationId: org.organizationId,
          name: org.name,
          websiteUrl: org.websiteUrl || '',
          imageUrl: org.image?.imageUrl || null,
          imageHash: org.image?.hash || null,
          total,
          active,
          inactive,
          activePct,
          inactivePct,
        };
      })
      .sort((a, b) => b.total - a.total);

    return { rows, totalOrganizations };
  } catch (error) {
    console.warn('Organizations overview fetch failed:', error);
    return { rows: [], totalOrganizations: 0 };
  }
}

const EMPTY_OVERVIEW_ROWS: OrganizationOverviewRow[] = [];

export function useCustomersOverview(limit: number = 10) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);

  const query = useQuery({
    queryKey: dashboardQueryKeys.orgStats(limit),
    queryFn: () => fetchCustomersOverview(limit),
    enabled: isAuthenticated,
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    retryDelay: 1000,
    throwOnError: false,
    refetchOnWindowFocus: false,
  });

  return {
    rows: query.data?.rows ?? EMPTY_OVERVIEW_ROWS,
    // `isPending`, not `isLoading`: this query is `enabled: isAuthenticated`, which
    // is false on the first render, and a DISABLED query reports `isLoading: false`
    // (v5 defines it as `isPending && isFetching`). The section's
    // `loading && rows.length === 0` guard therefore fell through to the "No
    // Customers added yet" empty state on every load. See `use-dashboard-stats.ts`.
    loading: query.isPending,
    error: query.error?.message ?? null,
    totalOrganizations: query.data?.totalOrganizations ?? 0,
    refresh: query.refetch,

    isFetching: query.isFetching,
    isSuccess: query.isSuccess,
    dataUpdatedAt: query.dataUpdatedAt,
  };
}
