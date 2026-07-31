'use client';

import { useQuery } from '@tanstack/react-query';
import { deviceQueryKeys } from '@/app/(app)/devices/utils/query-keys';
import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';
import { isSaasTenantMode } from '@/lib/app-mode';
import { dashboardApiService } from '../services/dashboard-api-service';
import { dashboardQueryKeys } from '../utils/query-keys';

/**
 * These queries are `enabled: isAuthenticated`, and the auth store is populated by
 * `useAuthSession`'s effect — i.e. AFTER first paint, now that nothing blocks the
 * app while the session resolves. So on the first render the query is disabled.
 *
 * `isLoading` is the wrong flag for that window. In react-query v5 it is
 * `isPending && isFetching`, and a disabled query is pending but NOT fetching — so
 * `isLoading` reads `false` while there is no data at all, and consumers render
 * their loaded state over empty data: zeroes in the stat cards, "No Customers added
 * yet" on a tenant that has customers, onboarding steps shown as not-done.
 *
 * `isPending` is the honest flag: true whenever the query has no data, disabled
 * included. It must still be combined with any PERMANENT gate (see
 * `useTicketsOverview`), or a query that is never meant to run in this mode would
 * report "loading" forever.
 */

export function useDevicesOverview() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);

  // Keyed under the device root, not the dashboard one: these counters are
  // device data, and archiving a device has to refresh them along with every
  // other device surface (see `invalidateDeviceQueries`).
  const query = useQuery({
    queryKey: deviceQueryKeys.stats(),
    queryFn: dashboardApiService.fetchDeviceStats,
    enabled: isAuthenticated,
    staleTime: 1 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
    retryDelay: 1000,
  });

  return {
    total: query.data?.total ?? 0,
    active: query.data?.active ?? 0,
    inactive: query.data?.inactive ?? 0,
    pending: query.data?.pending ?? 0,
    archived: query.data?.archived ?? 0,
    activePercentage: query.data?.activePercentage ?? 0,
    inactivePercentage: query.data?.inactivePercentage ?? 0,
    pendingPercentage: query.data?.pendingPercentage ?? 0,
    archivedPercentage: query.data?.archivedPercentage ?? 0,
    // `isPending`, not `isLoading` — see the note above.
    isLoading: query.isPending,
    error: query.error?.message ?? null,
    refetch: query.refetch,
  };
}

export function useTicketsOverview() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const isSaasMode = isSaasTenantMode();

  const query = useQuery({
    queryKey: dashboardQueryKeys.ticketStats(),
    queryFn: dashboardApiService.fetchTicketStats,
    enabled: isSaasMode && isAuthenticated,
    staleTime: 3 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
    retryDelay: 1000,
  });

  return {
    total: query.data?.total ?? 0,
    active: query.data?.active ?? 0,
    resolved: query.data?.resolved ?? 0,
    avgResolveTime: query.data?.avgResolveTime ?? '—',
    avgFaeRate: query.data?.avgFaeRate ?? 0,
    activePercentage: query.data?.activePercentage ?? 0,
    resolvedPercentage: query.data?.resolvedPercentage ?? 0,
    aiAssistance: query.data?.aiAssistance ?? 0,
    techRequired: query.data?.techRequired ?? 0,
    otherStatuses: query.data?.otherStatuses ?? 0,
    techRequiredColor: query.data?.techRequiredColor,
    // `isSaasMode` is the PERMANENT half of the gate: in OSS mode this query never
    // runs, so a bare `isPending` would report "loading" for the life of the page.
    isLoading: isSaasMode && query.isPending,
    error: query.error?.message ?? null,
    refetch: query.refetch,
  };
}

export function useSharedDashboardData() {
  const devicesQuery = useDevicesOverview();
  const ticketsQuery = useTicketsOverview();

  return {
    devices: {
      data: devicesQuery,
      isLoading: devicesQuery.isLoading,
    },
    tickets: {
      data: ticketsQuery,
      isLoading: ticketsQuery.isLoading,
    },
    isAnyLoading: devicesQuery.isLoading || ticketsQuery.isLoading,
    refetchAll: () => {
      devicesQuery.refetch();
      ticketsQuery.refetch();
    },
  };
}
