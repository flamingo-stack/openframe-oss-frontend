'use client';

import { Parcel02Icon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import type { DataTableSortState } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useLazyLoadQuery, usePaginationFragment } from 'react-relay';
import type { softwareListTable_query$key } from '@/__generated__/softwareListTable_query.graphql';
import type { softwareListTablePaginationQuery as SoftwareListTablePaginationQueryType } from '@/__generated__/softwareListTablePaginationQuery.graphql';
import type {
  softwareListTableQuery as SoftwareListTableQueryType,
  SortInput,
} from '@/__generated__/softwareListTableQuery.graphql';
import { EmptyState, useRetryKey } from '@/app/components/shared';
import type { ListSelections } from '../shared/software-list-frame';
import { SOFTWARE_LIST_PAGE_SIZE, SOFTWARE_LIST_SORTABLE_COLUMN_IDS } from './software-list-columns';
import { SoftwareTable, toSoftwareFilterInput } from './software-table';
import { useSoftwareFilters } from './use-software-filters';

/**
 * The fleet-wide `softwares` connection — one row per software title,
 * aggregated across devices. Search, sort and the funnel are pushed to the
 * server; the pagination fragment drives infinite scroll. The rows themselves
 * are the shared `SoftwareTable`, the one a device's own inventory draws too,
 * with the funnel fed by `softwareFilters`.
 */
const softwareListTableQuery = graphql`
  query softwareListTableQuery(
    $filter: SoftwareFilterInput
    $search: String
    $sort: SortInput
    $first: Int!
    $after: String
  ) {
    ...softwareListTable_query @arguments(filter: $filter, search: $search, sort: $sort, first: $first, after: $after)
  }
`;

const softwareListTableFragment = graphql`
  fragment softwareListTable_query on Query
  @refetchable(queryName: "softwareListTablePaginationQuery")
  @argumentDefinitions(
    filter: { type: "SoftwareFilterInput" }
    search: { type: "String" }
    sort: { type: "SortInput" }
    first: { type: "Int", defaultValue: 20 }
    after: { type: "String" }
  ) {
    softwares(filter: $filter, search: $search, sort: $sort, first: $first, after: $after)
      @connection(key: "softwareListTable_softwares") {
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

interface SoftwareListTableProps {
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
  /**
   * True while the deferred query variables lag the live search/sort/funnel
   * state (a refetch is in flight and the rows on screen are the previous
   * result) — guards the empty state so it never flashes on stale data.
   */
  isPending: boolean;
  onEmptyChange: (isEmpty: boolean) => void;
  stickyHeaderOffset: string;
  emptyTitle: string;
  emptyDescription: string;
}

/** The Software inventory rows — suspends on the query, so it lives under the view's `<Suspense>`. */
export function SoftwareListTable({
  debouncedSearch,
  sort,
  deferredSelections,
  sortState,
  onSortChange,
  selections,
  onSelectionsChange,
  isPending,
  onEmptyChange,
  stickyHeaderOffset,
  emptyTitle,
  emptyDescription,
}: SoftwareListTableProps) {
  const retryKey = useRetryKey();
  const filter = toSoftwareFilterInput(deferredSelections);
  const queryData = useLazyLoadQuery<SoftwareListTableQueryType>(
    softwareListTableQuery,
    { filter, search: debouncedSearch || null, sort, first: SOFTWARE_LIST_PAGE_SIZE, after: null },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );

  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    SoftwareListTablePaginationQueryType,
    softwareListTable_query$key
  >(softwareListTableFragment, queryData);

  // The funnel's options: what actually occurs across the fleet, from the
  // server, so a value no title has is never offered.
  const filterOptions = useSoftwareFilters();

  const rows = data.softwares.edges.map(edge => edge.node);

  const fetchNextPage = () => {
    if (hasNext && !isLoadingNext) loadNext(SOFTWARE_LIST_PAGE_SIZE);
  };

  return (
    <SoftwareTable
      rows={rows}
      totalCount={data.softwares.filteredCount}
      debouncedSearch={debouncedSearch}
      sortableIds={SOFTWARE_LIST_SORTABLE_COLUMN_IDS}
      sortState={sortState}
      onSortChange={onSortChange}
      filterOptions={filterOptions}
      selections={selections}
      onSelectionsChange={onSelectionsChange}
      isFiltered={filter !== null}
      isPending={isPending}
      emptyState={<EmptyState icon={<Parcel02Icon />} title={emptyTitle} description={emptyDescription} />}
      onEmptyChange={onEmptyChange}
      stickyHeaderOffset={stickyHeaderOffset}
      infiniteScroll={{ hasNextPage: hasNext, isFetchingNextPage: isLoadingNext, onLoadMore: fetchNextPage }}
    />
  );
}
