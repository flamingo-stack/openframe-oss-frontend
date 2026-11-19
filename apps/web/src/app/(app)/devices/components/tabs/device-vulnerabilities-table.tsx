'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ReactNode } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { deviceVulnerabilitiesTableQuery as DeviceVulnerabilitiesTableQueryType } from '@/__generated__/deviceVulnerabilitiesTableQuery.graphql';
import type { SoftwareListFrameRenderProps } from '@/app/(app)/software/components/shared/software-list-frame';
import { VULNERABILITY_LIST_PAGE_SIZE } from '@/app/(app)/software/components/vulnerability-list/vulnerability-list-columns';
import { VulnerabilityTable } from '@/app/(app)/software/components/vulnerability-list/vulnerability-table';
import { useRetryKey } from '@/app/components/shared';
import { StaleCursorBoundary } from '@/app/components/shared/stale-cursor-boundary';
import { forwardPage } from '@/app/hooks/forward-page';
import { usePagedTable } from '@/app/hooks/use-paged-table';
import { useRefetchPage } from '@/app/hooks/use-refetch-page';

/**
 * Device → Vulnerabilities: the CVEs present on this machine, one row per CVE —
 * the same `Vulnerability` node the fleet-wide list shows, drawn by the same
 * table. Search only, as on the page — no sort and no funnels; one page at a time, its cursor in the URL
 * (`cveCursor`).
 */
const deviceVulnerabilitiesTableQuery = graphql`
  query deviceVulnerabilitiesTableQuery($machineId: String!, $search: String, $first: Int!, $after: String) {
    deviceVulnerabilities(machineId: $machineId, search: $search, first: $first, after: $after) {
      filteredCount
      edges {
        node {
          ...vulnerabilityTable_vulnerability
        }
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
    }
  }
`;

interface DeviceVulnerabilitiesTableProps extends Pick<
  SoftwareListFrameRenderProps,
  'pager' | 'pageVariables' | 'paramPrefix'
> {
  machineId: string;
  debouncedSearch: string;
  /** True while a refetch is in flight — guards the empty state so it never flashes on stale data. */
  isPending: boolean;
  /** Drawn for a device with no CVE; the tab picks the copy from the pipeline's stage. */
  emptyState: ReactNode;
  /** No CVE at all (not a search miss) — the tab drops its toolbar and banner. */
  onEmptyChange: (isEmpty: boolean) => void;
  stickyHeaderOffset: string;
}

/** The Vulnerabilities tab's rows, with their own boundary: in its scope the reader draws its own loading form. */
export function DeviceVulnerabilitiesTable(props: DeviceVulnerabilitiesTableProps) {
  return (
    <StaleCursorBoundary cursor={props.pager.cursor} onStaleCursor={props.pager.dropCursor}>
      <LoadingSuspense label="Loading vulnerabilities">
        <DeviceVulnerabilitiesTableReader {...props} />
      </LoadingSuspense>
    </StaleCursorBoundary>
  );
}

/**
 * The Vulnerabilities tab's rows. In a loading scope (the device or the module's flag has not answered, or its boundary's
 * fallback) it draws the table's own loading state and runs no query; otherwise the query below.
 */
function DeviceVulnerabilitiesTableReader(props: DeviceVulnerabilitiesTableProps) {
  if (useLoadingScope()) return <VulnerabilityTable stickyHeaderOffset={props.stickyHeaderOffset} />;
  return <DeviceVulnerabilitiesTableQuery {...props} />;
}

/** The Vulnerabilities tab's rows — suspends on the query, under the boundary above. */
function DeviceVulnerabilitiesTableQuery({
  machineId,
  debouncedSearch,
  isPending,
  emptyState,
  onEmptyChange,
  stickyHeaderOffset,
  pager,
  pageVariables,
  paramPrefix,
}: DeviceVulnerabilitiesTableProps) {
  const retryKey = useRetryKey();
  const variables = {
    machineId,
    search: debouncedSearch || null,
    ...forwardPage(pageVariables, VULNERABILITY_LIST_PAGE_SIZE),
  };
  const data = useLazyLoadQuery<DeviceVulnerabilitiesTableQueryType>(deviceVulnerabilitiesTableQuery, variables, {
    fetchPolicy: 'store-or-network',
    fetchKey: retryKey,
  });
  const refetch = useRefetchPage<DeviceVulnerabilitiesTableQueryType>(deviceVulnerabilitiesTableQuery, variables);

  const rows = data.deviceVulnerabilities.edges.map(edge => edge.node);
  const paged = usePagedTable({
    pager,
    pageInfo: data.deviceVulnerabilities.pageInfo,
    rowCount: rows.length,
    prefix: paramPrefix,
    refetch,
  });

  return (
    <VulnerabilityTable
      rows={rows}
      totalCount={data.deviceVulnerabilities.filteredCount}
      debouncedSearch={debouncedSearch}
      isPending={isPending}
      emptyState={emptyState}
      onEmptyChange={onEmptyChange}
      stickyHeaderOffset={stickyHeaderOffset}
      pager={paged.pager}
      refresh={paged.refresh}
    />
  );
}
