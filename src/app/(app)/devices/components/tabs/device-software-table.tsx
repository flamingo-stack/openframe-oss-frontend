'use client';

import type { DataTableSortState } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ReactNode } from 'react';
import { graphql, useLazyLoadQuery, usePaginationFragment } from 'react-relay';
import type { deviceSoftwareTable_query$key } from '@/__generated__/deviceSoftwareTable_query.graphql';
import type { deviceSoftwareTablePaginationQuery as DeviceSoftwareTablePaginationQueryType } from '@/__generated__/deviceSoftwareTablePaginationQuery.graphql';
import type {
  deviceSoftwareTableQuery as DeviceSoftwareTableQueryType,
  SortInput,
} from '@/__generated__/deviceSoftwareTableQuery.graphql';
import type { ListSelections } from '@/app/(app)/software/components/shared/software-list-frame';
import {
  SOFTWARE_LIST_PAGE_SIZE,
  SOFTWARE_LIST_SORTABLE_COLUMN_IDS,
} from '@/app/(app)/software/components/software-list/software-list-columns';
import { SoftwareTable, toSoftwareFilterInput } from '@/app/(app)/software/components/software-list/software-table';
import { useRetryKey } from '@/app/components/shared';
import { useDeviceSoftwareFilters } from './use-device-software-filters';

/**
 * Device → Software: what is installed on this machine, one row per title —
 * the same `Software` node the fleet-wide list shows, read in this device's
 * scope (the version is the one installed here), drawn by the same table with
 * the same sort toggles and funnel. Search, sort and the funnel go to the
 * server; the funnel's options come from `deviceSoftwareFilters`, the page's
 * facets scoped to this device. The pagination fragment drives infinite scroll.
 */
const deviceSoftwareTableQuery = graphql`
  query deviceSoftwareTableQuery(
    $machineId: String!
    $filter: SoftwareFilterInput
    $search: String
    $sort: SortInput
    $first: Int!
    $after: String
  ) {
    ...deviceSoftwareTable_query
      @arguments(machineId: $machineId, filter: $filter, search: $search, sort: $sort, first: $first, after: $after)
  }
`;

const deviceSoftwareTableFragment = graphql`
  fragment deviceSoftwareTable_query on Query
  @refetchable(queryName: "deviceSoftwareTablePaginationQuery")
  @argumentDefinitions(
    machineId: { type: "String!" }
    filter: { type: "SoftwareFilterInput" }
    search: { type: "String" }
    sort: { type: "SortInput" }
    first: { type: "Int", defaultValue: 20 }
    after: { type: "String" }
  ) {
    deviceSoftware(machineId: $machineId, filter: $filter, search: $search, sort: $sort, first: $first, after: $after)
      @connection(key: "deviceSoftwareTable_deviceSoftware") {
      filteredCount
      edges {
        node {
          ...softwareTable_software
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

interface DeviceSoftwareTableProps {
  machineId: string;
  debouncedSearch: string;
  /** Deferred sort — feeds the query (lags the live indicator during a refetch). */
  sort: SortInput | null;
  /** Deferred funnel selection — feeds the query (lags the live ticks during a refetch). */
  deferredSelections: ListSelections;
  /** Live sort — drives the header indicator so it flips instantly on click. */
  sortState: DataTableSortState | null;
  onSortChange: (columnId: string) => void;
  /** Live funnel selection — what the headers draw as ticked. */
  selections: ListSelections;
  onSelectionsChange: (next: Record<string, string[]>) => void;
  /** True while a refetch is in flight — guards the empty state so it never flashes on stale data. */
  isPending: boolean;
  /** Rows lead into the Software module's detail page — only when the tenant has the module. */
  linksEnabled: boolean;
  /** Drawn for a device with nothing installed; the tab picks the copy from the pipeline's stage. */
  emptyState: ReactNode;
  /** Nothing installed at all (not a search or funnel miss) — the tab drops its toolbar. */
  onEmptyChange: (isEmpty: boolean) => void;
  stickyHeaderOffset: string;
}

/** The Software tab's rows — suspends on the query, so it lives under the tab's `<Suspense>`. */
export function DeviceSoftwareTable({
  machineId,
  debouncedSearch,
  sort,
  deferredSelections,
  sortState,
  onSortChange,
  selections,
  onSelectionsChange,
  isPending,
  linksEnabled,
  emptyState,
  onEmptyChange,
  stickyHeaderOffset,
}: DeviceSoftwareTableProps) {
  const retryKey = useRetryKey();
  const filter = toSoftwareFilterInput(deferredSelections);
  const queryData = useLazyLoadQuery<DeviceSoftwareTableQueryType>(
    deviceSoftwareTableQuery,
    { machineId, filter, search: debouncedSearch || null, sort, first: SOFTWARE_LIST_PAGE_SIZE, after: null },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );

  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    DeviceSoftwareTablePaginationQueryType,
    deviceSoftwareTable_query$key
  >(deviceSoftwareTableFragment, queryData);

  // The funnel's options: what actually occurs on this device, from the
  // server, so a value no title here has is never offered.
  const filterOptions = useDeviceSoftwareFilters(machineId);

  const rows = data.deviceSoftware.edges.map(edge => edge.node);

  const fetchNextPage = () => {
    if (hasNext && !isLoadingNext) loadNext(SOFTWARE_LIST_PAGE_SIZE);
  };

  return (
    <SoftwareTable
      rows={rows}
      totalCount={data.deviceSoftware.filteredCount}
      debouncedSearch={debouncedSearch}
      // The page's own toggles, unchanged: `deviceSoftware` sorts by every field `softwares` does.
      sortableIds={SOFTWARE_LIST_SORTABLE_COLUMN_IDS}
      sortState={sortState}
      onSortChange={onSortChange}
      filterOptions={filterOptions}
      selections={selections}
      onSelectionsChange={onSelectionsChange}
      isFiltered={filter !== null}
      isPending={isPending}
      linksEnabled={linksEnabled}
      emptyState={emptyState}
      onEmptyChange={onEmptyChange}
      stickyHeaderOffset={stickyHeaderOffset}
      infiniteScroll={{ hasNextPage: hasNext, isFetchingNextPage: isLoadingNext, onLoadMore: fetchNextPage }}
    />
  );
}
