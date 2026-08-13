'use client';

import { useQuery } from '@tanstack/react-query';
import { deviceQueryKeys } from '@/app/(app)/devices/utils/query-keys';
import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';
import { isSaasTenantMode } from '@/lib/app-mode';
import { queryState } from '@/lib/query-state';
import { dashboardApiService } from '../services/dashboard-api-service';
import { dashboardQueryKeys } from '../utils/query-keys';

/**
 * These queries are `enabled: isAuthenticated`, and the auth store is populated by
 * `useAuthSession`'s effect — i.e. AFTER first paint, now that nothing blocks the
 * app while the session resolves. So on the first render the query is disabled,
 * and `useTicketsOverview` is additionally gated on a mode that may never open at
 * all. Both readings come from `queryState` (see `lib/query-state.ts`), which is
 * the one place that knows a disabled query is not "loaded", a paused one is not
 * "loading", and a shut gate is neither.
 *
 * ## Counters are `number | null`, and `null` means "we don't know"
 *
 * These used to coalesce to `0`, which is a different claim entirely. In the
 * ERROR state — where `isPending` is false, so no skeleton renders — the whole
 * dashboard drew `ONLINE DEVICES 0 (0%)`, `OFFLINE DEVICES 0 (0%)` and every
 * ticket count at 0, with no error anywhere on screen. On an RMM console that
 * reads as "all clear" when the truth is "nothing loaded", and it was observed
 * persisting long after connectivity returned.
 *
 * Consumers must render `null` as unavailable (`—`), never as a number, and must
 * not feed it to a progress ring — see `devices-overview.tsx`.
 *
 * That `| null` IS this layer's "unknown" encoding, which is why these hooks pick
 * fields off `queryState` instead of spreading it the way the nine list hooks do:
 * a counter already says whether it knows its own value, so `hasData` would be a
 * second answer to the same question.
 */

export function useDevicesOverview() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);

  // Keyed under the device root, not the dashboard one: these counters are
  // device data, and archiving a device has to refresh them along with every
  // other device surface (see `invalidateDeviceQueries`).
  const query = useQuery({
    queryKey: deviceQueryKeys.stats(),
    // Called, not passed: React Query invokes `queryFn` as a bare function, so a
    // method reference arrives with `this === undefined` and the service's own
    // `catch { throw this.handleApiError(...) }` throws a TypeError that REPLACES
    // the real failure. Every error path — 500, timeout, offline — reported
    // "undefined is not an object (evaluating 'this.handleApiError')" instead.
    queryFn: () => dashboardApiService.fetchDeviceStats(),
    enabled: isAuthenticated,
    staleTime: 1 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
    retryDelay: 1000,
  });

  const state = queryState(query);

  return {
    total: query.data?.total ?? null,
    active: query.data?.active ?? null,
    inactive: query.data?.inactive ?? null,
    pending: query.data?.pending ?? null,
    archived: query.data?.archived ?? null,
    activePercentage: query.data?.activePercentage ?? null,
    inactivePercentage: query.data?.inactivePercentage ?? null,
    pendingPercentage: query.data?.pendingPercentage ?? null,
    archivedPercentage: query.data?.archivedPercentage ?? null,
    isLoading: state.isLoading,
    isOffline: state.isOffline,
    error: state.error,
    refetch: query.refetch,
  };
}

export function useTicketsOverview() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const isSaasMode = isSaasTenantMode();

  const query = useQuery({
    queryKey: dashboardQueryKeys.ticketStats(),
    // Same unbound-`this` trap as `fetchDeviceStats` above.
    queryFn: () => dashboardApiService.fetchTicketStats(),
    enabled: isSaasMode && isAuthenticated,
    staleTime: 3 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
    retryDelay: 1000,
  });

  // `'closed'` in OSS mode: this query never runs there, and a gate that will not
  // open is idle, not loading — read as loading it would skeleton for the life of
  // the page.
  const state = queryState(query, isSaasMode ? 'open' : 'closed');

  return {
    total: query.data?.total ?? null,
    active: query.data?.active ?? null,
    resolved: query.data?.resolved ?? null,
    avgResolveTime: query.data?.avgResolveTime ?? '—',
    avgFaeRate: query.data?.avgFaeRate ?? null,
    activePercentage: query.data?.activePercentage ?? null,
    resolvedPercentage: query.data?.resolvedPercentage ?? null,
    aiAssistance: query.data?.aiAssistance ?? null,
    techRequired: query.data?.techRequired ?? null,
    otherStatuses: query.data?.otherStatuses ?? null,
    techRequiredColor: query.data?.techRequiredColor,
    isLoading: state.isLoading,
    isOffline: state.isOffline,
    error: state.error,
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
