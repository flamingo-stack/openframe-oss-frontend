'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';
import { apiClient } from '@/lib/api-client';
import { queryState } from '@/lib/query-state';
import { DEVICE_STATUS } from '../../devices/constants/device-statuses';
import { fetchDeviceOrganizationCounts } from '../../devices/queries/devices-api';
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
 *
 * No `organizationIds` argument: the backend's organization facet excludes that
 * filter from its own WHERE clause, so the map already covers every organization
 * (see `fetchDeviceOrganizationCounts`). Passing the list narrowed nothing and
 * cost ~2.6KB of request body per call.
 */
async function organizationCountsForStatuses(statuses: string[]): Promise<ReadonlyMap<string, number>> {
  try {
    return await fetchDeviceOrganizationCounts({ statuses });
  } catch (error) {
    console.warn('Customer device counts fetch failed:', error);
    return NO_COUNTS;
  }
}

/**
 * Throws on failure, unlike the counter helper above — the distinction is
 * subject vs detail.
 *
 * Returning an empty result here made the queryFn RESOLVE, so react-query stored
 * `status: 'success'` with `error: null` and the section rendered its "No
 * Customers added yet" empty state — a tenant with customers told it has none.
 * Nothing retries a successful query, so that false answer then sat in the cache
 * until its `gcTime` (10 min) elapsed; observed still blank minutes after the
 * network came back, while every other tile on the page had recovered.
 *
 * Throwing puts the query in `error`, which is what the section's existing
 * `error` branch renders and what makes it eligible for a reconnect refetch.
 */
async function fetchOrganizations(): Promise<{
  organizations: OrganizationNode[];
  totalOrganizations: number;
}> {
  const orgsResponse = await apiClient.post<GraphQlResponse<OrganizationsResponse>>('/api/graphql', {
    query: GET_ORGANIZATIONS_QUERY,
    variables: { first: 100 },
  });

  if (!orgsResponse.ok) {
    throw new Error(orgsResponse.error || `Organizations request failed with status ${orgsResponse.status}`);
  }

  const orgsData = orgsResponse.data?.data?.organizations;
  if (!orgsData) {
    throw new Error('Invalid organizations overview response structure');
  }

  return {
    organizations: orgsData.edges.map(edge => edge.node),
    totalOrganizations: orgsData.filteredCount || 0,
  };
}

async function fetchCustomersOverview(_limit: number): Promise<{
  rows: OrganizationOverviewRow[];
  totalOrganizations: number;
}> {
  // ONE round, not two. The counts used to be awaited AFTER the organization list, because
  // they were passed `organizationIds` derived from it — an argument the backend discards.
  // With the dependency gone the three requests are independent, which removes a full
  // request-latency stage from the dashboard's critical path: this hook was the gate that
  // turned a slow query into a two-stage page load (p90 page 19s against a 2.9s slowest
  // request), and it fires while the rest of the dashboard is also loading.
  //
  // Two count queries, not three: `total` was a third call scoped to [ONLINE, OFFLINE],
  // which is exactly the union of the other two — the backend's organization facet counts
  // active devices only and the statuses partition it, so total === active + inactive by
  // construction. Summing locally is not an approximation.
  const [orgs, onlineCounts, offlineCounts] = await Promise.all([
    fetchOrganizations(),
    organizationCountsForStatuses([DEVICE_STATUS.ONLINE]),
    organizationCountsForStatuses([DEVICE_STATUS.OFFLINE]),
  ]);

  const { organizations, totalOrganizations } = orgs;
  if (organizations.length === 0) {
    return { rows: [], totalOrganizations };
  }

  const rows: OrganizationOverviewRow[] = organizations
    .map(org => {
      const active = onlineCounts.get(org.organizationId) || 0;
      const inactive = offlineCounts.get(org.organizationId) || 0;
      const total = active + inactive;
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

  // Default `'open'` gate: `enabled: isAuthenticated` is false only until the
  // session resolves, and that gate WILL open — so the section keeps its skeleton
  // meanwhile instead of falling into the "No Customers added yet" empty state.
  // `isLoading` also excludes paused, which `isPending` did not: offline, the
  // section used to skeleton forever.
  const state = queryState(query);

  return {
    rows: query.data?.rows ?? EMPTY_OVERVIEW_ROWS,
    loading: state.isLoading,
    isOffline: state.isOffline,
    canClaimEmpty: state.canClaimEmpty,
    error: state.error,
    totalOrganizations: query.data?.totalOrganizations ?? 0,
    refresh: query.refetch,
  };
}
