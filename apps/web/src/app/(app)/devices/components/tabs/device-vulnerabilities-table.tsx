'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ReactNode } from 'react';
import { graphql, useLazyLoadQuery, usePaginationFragment } from 'react-relay';
import type { deviceVulnerabilitiesTable_query$key } from '@/__generated__/deviceVulnerabilitiesTable_query.graphql';
import type { deviceVulnerabilitiesTablePaginationQuery as DeviceVulnerabilitiesTablePaginationQueryType } from '@/__generated__/deviceVulnerabilitiesTablePaginationQuery.graphql';
import type { deviceVulnerabilitiesTableQuery as DeviceVulnerabilitiesTableQueryType } from '@/__generated__/deviceVulnerabilitiesTableQuery.graphql';
import { VULNERABILITY_LIST_PAGE_SIZE } from '@/app/(app)/software/components/vulnerability-list/vulnerability-list-columns';
import { VulnerabilityTable } from '@/app/(app)/software/components/vulnerability-list/vulnerability-table';
import { useRetryKey } from '@/app/components/shared';

/**
 * Device → Vulnerabilities: the CVEs present on this machine, one row per CVE —
 * the same `Vulnerability` node the fleet-wide list shows, drawn by the same
 * table. Search only, as on the page — no sort and no funnels; the pagination
 * fragment drives infinite scroll.
 */
const deviceVulnerabilitiesTableQuery = graphql`
  query deviceVulnerabilitiesTableQuery($machineId: String!, $search: String, $first: Int!, $after: String) {
    ...deviceVulnerabilitiesTable_query @arguments(machineId: $machineId, search: $search, first: $first, after: $after)
  }
`;

const deviceVulnerabilitiesTableFragment = graphql`
  fragment deviceVulnerabilitiesTable_query on Query
  @refetchable(queryName: "deviceVulnerabilitiesTablePaginationQuery")
  @argumentDefinitions(
    machineId: { type: "String!" }
    search: { type: "String" }
    first: { type: "Int", defaultValue: 20 }
    after: { type: "String" }
  ) {
    deviceVulnerabilities(machineId: $machineId, search: $search, first: $first, after: $after)
      @connection(key: "deviceVulnerabilitiesTable_deviceVulnerabilities") {
      filteredCount
      edges {
        node {
          ...vulnerabilityTable_vulnerability
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

interface DeviceVulnerabilitiesTableProps {
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
    <LoadingSuspense label="Loading vulnerabilities">
      <DeviceVulnerabilitiesTableReader {...props} />
    </LoadingSuspense>
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
}: DeviceVulnerabilitiesTableProps) {
  const retryKey = useRetryKey();
  const queryData = useLazyLoadQuery<DeviceVulnerabilitiesTableQueryType>(
    deviceVulnerabilitiesTableQuery,
    { machineId, search: debouncedSearch || null, first: VULNERABILITY_LIST_PAGE_SIZE, after: null },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );

  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    DeviceVulnerabilitiesTablePaginationQueryType,
    deviceVulnerabilitiesTable_query$key
  >(deviceVulnerabilitiesTableFragment, queryData);

  const rows = data.deviceVulnerabilities.edges.map(edge => edge.node);

  const fetchNextPage = () => {
    if (hasNext && !isLoadingNext) loadNext(VULNERABILITY_LIST_PAGE_SIZE);
  };

  return (
    <VulnerabilityTable
      rows={rows}
      totalCount={data.deviceVulnerabilities.filteredCount}
      debouncedSearch={debouncedSearch}
      isPending={isPending}
      emptyState={emptyState}
      onEmptyChange={onEmptyChange}
      stickyHeaderOffset={stickyHeaderOffset}
      infiniteScroll={{ hasNextPage: hasNext, isFetchingNextPage: isLoadingNext, onLoadMore: fetchNextPage }}
    />
  );
}
