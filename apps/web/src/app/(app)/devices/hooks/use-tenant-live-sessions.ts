'use client';

import { skipToken, useQuery } from '@tanstack/react-query';
import { fetchQuery } from 'react-relay';
import type {
  RemoteSessionFilter,
  tenantRemoteSessionsRelayLiveQuery as LiveQuery,
} from '@/__generated__/tenantRemoteSessionsRelayLiveQuery.graphql';
import { RemoteSessionListState } from '@/generated/schema-enums';
import { tenantRemoteSessionsRelayLiveQuery } from '@/graphql/remote-sessions/tenant-remote-sessions-relay';
import { getRelayEnvironment } from '@/lib/relay';
import { sessionInterval, sessionPollMeta, sessionRetry } from '@/lib/session-poll';
import { type TenantSessionRow, toTenantSessionRow } from '../components/remote-sessions/tenant-session-columns';
import { deviceQueryKeys } from '../utils/query-keys';
import { LIVE_POLL_MS } from './use-session-recordings';

/** The list's filter without its state: the poll asks for the running sessions under the same scope. */
export type TenantLiveSessionsFilter = Omit<RemoteSessionFilter, 'recordingState'>;

/** The running sessions under `filter`, read once (the list's poll, the busy device's lookup). */
export async function readLiveSessions(filter: TenantLiveSessionsFilter): Promise<TenantSessionRow[]> {
  const data = await fetchQuery<LiveQuery>(
    getRelayEnvironment(),
    tenantRemoteSessionsRelayLiveQuery,
    { filter: { ...filter, recordingState: RemoteSessionListState.LIVE } },
    { fetchPolicy: 'network-only' },
  ).toPromise();
  return data?.remoteSessions.edges.map(edge => toTenantSessionRow(edge.node)) ?? [];
}

/**
 * The tenant's running sessions under the list's scope, read every 10 s while
 * the browser tab is visible, for the tenant-wide list's LIVE rows: a session
 * started or ended on any device shows within one poll. Null while `filter` is
 * null (Watch live off, or a state filter the running sessions never match) and
 * until the first answer. A failed read leaves the list as the server paged it.
 */
export function useTenantLiveSessions(filter: TenantLiveSessionsFilter | null): TenantSessionRow[] | null {
  const { data } = useQuery({
    queryKey: deviceQueryKeys.tenantLiveSessions(filter ?? {}),
    queryFn: filter ? () => readLiveSessions(filter) : skipToken,
    refetchInterval: sessionInterval(LIVE_POLL_MS),
    retry: sessionRetry(3),
    meta: sessionPollMeta,
  });
  return filter ? (data ?? null) : null;
}
