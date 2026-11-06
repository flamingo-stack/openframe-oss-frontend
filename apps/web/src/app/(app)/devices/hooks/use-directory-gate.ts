'use client';

import { graphql } from 'react-relay';
import type { useDirectoryGateQuery } from '@/__generated__/useDirectoryGateQuery.graphql';
import { useTenantManagementV2Gate } from '@/app/(app)/cloud-tenant-management/components/shared/use-tenant-management-gate';
import { useNonSuspendingQuery } from '@/app/hooks/use-non-suspending-query';
import type { FeatureFlagGate } from '@/lib/feature-flags';
import { runtimeEnv } from '@/lib/runtime-config';

// Every status but NEVER. "Generate Connection Link" creates the record before anyone consents, and the link goes to
// the customer's admin, so a connection that never synced has nothing to show however long it waits. One that synced
// and was disconnected keeps its data, read-only, so it still counts.
const directoryGateQuery = graphql`
  query useDirectoryGateQuery($list: Boolean!) {
    directoryConnections(first: 1, filter: { lastSyncStatuses: [SUCCESS, ERROR] }) @include(if: $list) {
      totalCount
    }
  }
`;

/**
 * The tenant's directories on the device screens: SaaS only, behind Tenant Management Phase 2 (`tenant-management` and
 * `tenant-management-v2`, whose `'loading'` and `'off'` it returns as they are), and only once a connection has synced
 * (D30). The flags say the module exists, which is every tenant; a tenant with no synced directory has no directory
 * users, USER or SOURCES to show, and keeps the machine's local accounts.
 *
 * A failed count reads as `off`: the screens as they are without the module, which lose nothing a tenant relies on. A
 * first sync shows at the store's expiry.
 *
 * Each call asks for itself and keeps its own answer, so read it once per screen and hand the answer down. Two
 * readers can disagree after a failed count: one read `off`, the next asks again and reads `on`.
 */
export function useDirectoryGate(): FeatureFlagGate {
  const flag = useTenantManagementV2Gate();
  const isSaas = runtimeEnv.appMode() === 'saas-tenant';
  const { data, isLoading } = useNonSuspendingQuery<useDirectoryGateQuery>(
    directoryGateQuery,
    { list: true },
    isSaas && flag === 'on',
  );
  if (!isSaas) return 'off';
  if (flag !== 'on') return flag;
  if (isLoading) return 'loading';
  return (data.directoryConnections?.totalCount ?? 0) > 0 ? 'on' : 'off';
}
