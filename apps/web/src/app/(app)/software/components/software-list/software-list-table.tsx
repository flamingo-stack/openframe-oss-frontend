'use client';

import { Parcel02Icon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useLazyLoadQuery, usePaginationFragment } from 'react-relay';
import type { softwareListTable_query$key } from '@/__generated__/softwareListTable_query.graphql';
import type { softwareListTablePaginationQuery as SoftwareListTablePaginationQueryType } from '@/__generated__/softwareListTablePaginationQuery.graphql';
import type { softwareListTableQuery as SoftwareListTableQueryType } from '@/__generated__/softwareListTableQuery.graphql';
import { EmptyState, NO_NEXT_PAGE, useRetryKey } from '@/app/components/shared';
import { SOFTWARE_LIST_PAGE_SIZE } from './software-list-columns';
import { SoftwareTable } from './software-table';

/**
 * The fleet-wide `softwares` connection — one row per software title,
 * aggregated across devices. Search is pushed to the server; the pagination fragment drives infinite scroll. The rows themselves
 * are the shared `SoftwareTable`, the one a device's own inventory draws too.
 */
const softwareListTableQuery = graphql`
  query softwareListTableQuery($search: String, $first: Int!, $after: String) {
    ...softwareListTable_query @arguments(search: $search, first: $first, after: $after)
  }
`;

const softwareListTableFragment = graphql`
  fragment softwareListTable_query on Query
  @refetchable(queryName: "softwareListTablePaginationQuery")
  @argumentDefinitions(
    search: { type: "String" }
    first: { type: "Int", defaultValue: 20 }
    after: { type: "String" }
  ) {
    softwares(search: $search, first: $first, after: $after) @connection(key: "softwareListTable_softwares") {
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
 * The Software inventory rows. In a loading scope (the frame's Suspense fallback, or the module's flag window) it
 * draws the shared table with no rows, which is the table's own loading state; otherwise it runs the query, which
 * suspends, so it lives under the frame's `<Suspense>`.
 */
export function SoftwareListTable(props: SoftwareListTableProps) {
  if (useLoadingScope()) {
    return (
      <SoftwareTable
        rows={[]}
        totalCount={0}
        debouncedSearch={props.debouncedSearch}
        isPending={props.isPending}
        // Never drawn while loading: the table shows its loading rows, not the empty state.
        emptyState={null}
        onEmptyChange={props.onEmptyChange}
        stickyHeaderOffset={props.stickyHeaderOffset}
        infiniteScroll={NO_NEXT_PAGE}
      />
    );
  }
  return <SoftwareListTableQuery {...props} />;
}

function SoftwareListTableQuery({
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
    { search: debouncedSearch || null, first: SOFTWARE_LIST_PAGE_SIZE, after: null },
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
      rows={rows}
      totalCount={data.softwares.filteredCount}
      debouncedSearch={debouncedSearch}
      isPending={isPending}
      emptyState={<EmptyState icon={<Parcel02Icon />} title={emptyTitle} description={emptyDescription} />}
      onEmptyChange={onEmptyChange}
      stickyHeaderOffset={stickyHeaderOffset}
      infiniteScroll={{ hasNextPage: hasNext, isFetchingNextPage: isLoadingNext, onLoadMore: fetchNextPage }}
    />
  );
}
