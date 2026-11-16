'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { Parcel02Icon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useLazyLoadQuery, usePaginationFragment } from 'react-relay';
import type { softwareListTable_query$key } from '@/__generated__/softwareListTable_query.graphql';
import type { softwareListTablePaginationQuery as SoftwareListTablePaginationQueryType } from '@/__generated__/softwareListTablePaginationQuery.graphql';
import type { softwareListTableQuery as SoftwareListTableQueryType } from '@/__generated__/softwareListTableQuery.graphql';
import { EmptyState, useRetryKey } from '@/app/components/shared';
import type { SoftwareListFrameRenderProps } from '../shared/software-list-frame';
import { SOFTWARE_LIST_PAGE_SIZE } from './software-list-columns';
import { toSoftwareFilter } from './software-list-filters';
import { SoftwareTable } from './software-table';

/**
 * The fleet-wide `softwares` connection — one row per software title,
 * aggregated across devices. Search is pushed to the server; the pagination fragment drives infinite scroll. The rows themselves
 * are the shared `SoftwareTable`, the one a device's own inventory draws too.
 */
const softwareListTableQuery = graphql`
  query softwareListTableQuery($filter: SoftwareFilterInput, $search: String, $first: Int!, $after: String) {
    ...softwareListTable_query @arguments(filter: $filter, search: $search, first: $first, after: $after)
  }
`;

const softwareListTableFragment = graphql`
  fragment softwareListTable_query on Query
  @refetchable(queryName: "softwareListTablePaginationQuery")
  @argumentDefinitions(
    filter: { type: "SoftwareFilterInput" }
    search: { type: "String" }
    first: { type: "Int", defaultValue: 20 }
    after: { type: "String" }
  ) {
    softwares(filter: $filter, search: $search, first: $first, after: $after)
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

interface SoftwareListTableProps extends Pick<
  SoftwareListFrameRenderProps,
  'deferredSelections' | 'selections' | 'onSelectionsChange'
> {
  debouncedSearch: string;
  /**
   * True while the deferred query variables lag the live search
   * state (a refetch is in flight and the rows on screen are the previous
   * result) — guards the empty state so it never flashes on stale data.
   */
  isPending: boolean;
  onEmptyChange: (isEmpty: boolean) => void;
  stickyHeaderOffset: string;
  emptyTitle: string;
  emptyDescription: string;
}

/**
 * The Software inventory rows, with their own boundary. In a loading scope (the boundary's fallback, or the module's
 * flag window) the reader draws the shared table with no rows, which is the table's own loading state; otherwise it
 * runs the query, which suspends under that boundary.
 */
export function SoftwareListTable(props: SoftwareListTableProps) {
  return (
    <LoadingSuspense label="Loading software">
      <SoftwareListTableReader {...props} />
    </LoadingSuspense>
  );
}

function SoftwareListTableReader(props: SoftwareListTableProps) {
  if (useLoadingScope()) return <SoftwareTable surface="fleet" stickyHeaderOffset={props.stickyHeaderOffset} />;
  return <SoftwareListTableQuery {...props} />;
}

function SoftwareListTableQuery({
  deferredSelections,
  selections,
  onSelectionsChange,
  debouncedSearch,
  isPending,
  onEmptyChange,
  stickyHeaderOffset,
  emptyTitle,
  emptyDescription,
}: SoftwareListTableProps) {
  const retryKey = useRetryKey();
  const queryData = useLazyLoadQuery<SoftwareListTableQueryType>(
    softwareListTableQuery,
    {
      filter: toSoftwareFilter(deferredSelections),
      search: debouncedSearch || null,
      first: SOFTWARE_LIST_PAGE_SIZE,
      after: null,
    },
    { fetchPolicy: 'store-or-network', fetchKey: retryKey },
  );

  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    SoftwareListTablePaginationQueryType,
    softwareListTable_query$key
  >(softwareListTableFragment, queryData);

  const rows = data.softwares.edges.map(edge => edge.node);

  const fetchNextPage = () => {
    if (hasNext && !isLoadingNext) loadNext(SOFTWARE_LIST_PAGE_SIZE);
  };

  return (
    <SoftwareTable
      surface="fleet"
      rows={rows}
      totalCount={data.softwares.filteredCount}
      debouncedSearch={debouncedSearch}
      isPending={isPending}
      emptyState={<EmptyState icon={<Parcel02Icon />} title={emptyTitle} description={emptyDescription} />}
      onEmptyChange={onEmptyChange}
      stickyHeaderOffset={stickyHeaderOffset}
      selections={selections}
      onSelectionsChange={onSelectionsChange}
      infiniteScroll={{ hasNextPage: hasNext, isFetchingNextPage: isLoadingNext, onLoadMore: fetchNextPage }}
    />
  );
}
