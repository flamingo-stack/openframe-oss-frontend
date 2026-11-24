'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { Parcel02Icon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useLazyLoadQuery, usePaginationFragment } from 'react-relay';
import type { softwareListTable_adoptQuery$key } from '@/__generated__/softwareListTable_adoptQuery.graphql';
import type { softwareListTable_query$key } from '@/__generated__/softwareListTable_query.graphql';
import type { softwareListTableAdoptPaginationQuery as SoftwareListTableAdoptPaginationQueryType } from '@/__generated__/softwareListTableAdoptPaginationQuery.graphql';
import type { softwareListTableAdoptQuery as SoftwareListTableAdoptQueryType } from '@/__generated__/softwareListTableAdoptQuery.graphql';
import type { softwareListTablePaginationQuery as SoftwareListTablePaginationQueryType } from '@/__generated__/softwareListTablePaginationQuery.graphql';
import type { softwareListTableQuery as SoftwareListTableQueryType } from '@/__generated__/softwareListTableQuery.graphql';
import { EmptyState, useRetryKey } from '@/app/components/shared';
import { useSoftwareAdoptGate } from '../adopt/use-software-adopt-gate';
import type { SoftwareListFrameRenderProps } from '../shared/software-list-frame';
import { type SoftwareAdoptionRefs, SoftwareAdoptionRefsContext } from './software-adoption-cell';
import { SOFTWARE_LIST_PAGE_SIZE } from './software-list-columns';
import { toSoftwareFilter } from './software-list-filters';
import { SoftwareTable, type SoftwareTableProps } from './software-table';
import { useSoftwareListFilters } from './use-software-list-filters';

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

/**
 * The same list with Adopt on: each row also reads its Adoption count. A separate operation, not an `@include` on the
 * shared one: a backend without Adopt rejects any document that names `adoptionCount`, even a skipped one.
 */
const softwareListTableAdoptQuery = graphql`
  query softwareListTableAdoptQuery($filter: SoftwareFilterInput, $search: String, $first: Int!, $after: String) {
    ...softwareListTable_adoptQuery @arguments(filter: $filter, search: $search, first: $first, after: $after)
  }
`;

const softwareListTableAdoptFragment = graphql`
  fragment softwareListTable_adoptQuery on Query
  @refetchable(queryName: "softwareListTableAdoptPaginationQuery")
  @argumentDefinitions(
    filter: { type: "SoftwareFilterInput" }
    search: { type: "String" }
    first: { type: "Int", defaultValue: 20 }
    after: { type: "String" }
  ) {
    softwares(filter: $filter, search: $search, first: $first, after: $after)
      @connection(key: "softwareListTableAdopt_softwares") {
      filteredCount
      edges {
        node {
          id
          ...softwareTable_software
          ...softwareAdoptionCell_software
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
  'deferredSelections' | 'selections' | 'onSelectionsChange' | 'filtersOpen' | 'onFiltersClose'
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

/** Adopt's fields only on a backend that has them: with the flag off, the operation does not name them at all. */
function SoftwareListTableQuery(props: SoftwareListTableProps) {
  return useSoftwareAdoptGate() === 'on' ? (
    <SoftwareListAdoptQuery {...props} />
  ) : (
    <SoftwareListPlainQuery {...props} />
  );
}

const listVariables = ({ deferredSelections, debouncedSearch }: SoftwareListTableProps) => ({
  filter: toSoftwareFilter(deferredSelections),
  search: debouncedSearch || null,
  first: SOFTWARE_LIST_PAGE_SIZE,
  after: null,
});

function SoftwareListPlainQuery(props: SoftwareListTableProps) {
  const retryKey = useRetryKey();
  const queryData = useLazyLoadQuery<SoftwareListTableQueryType>(softwareListTableQuery, listVariables(props), {
    fetchPolicy: 'store-or-network',
    fetchKey: retryKey,
  });
  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    SoftwareListTablePaginationQueryType,
    softwareListTable_query$key
  >(softwareListTableFragment, queryData);

  return (
    <SoftwareListTableRows
      {...props}
      rows={data.softwares.edges.map(edge => edge.node)}
      totalCount={data.softwares.filteredCount}
      infiniteScroll={{
        hasNextPage: hasNext,
        isFetchingNextPage: isLoadingNext,
        onLoadMore: () => {
          if (hasNext && !isLoadingNext) loadNext(SOFTWARE_LIST_PAGE_SIZE);
        },
      }}
    />
  );
}

function SoftwareListAdoptQuery(props: SoftwareListTableProps) {
  const retryKey = useRetryKey();
  const queryData = useLazyLoadQuery<SoftwareListTableAdoptQueryType>(
    softwareListTableAdoptQuery,
    listVariables(props),
    {
      fetchPolicy: 'store-or-network',
      fetchKey: retryKey,
    },
  );
  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    SoftwareListTableAdoptPaginationQueryType,
    softwareListTable_adoptQuery$key
  >(softwareListTableAdoptFragment, queryData);

  const rows = data.softwares.edges.map(edge => edge.node);
  const adoption: SoftwareAdoptionRefs = new Map(rows.map(row => [row.id, row]));
  return (
    <SoftwareAdoptionRefsContext value={adoption}>
      <SoftwareListTableRows
        {...props}
        rows={rows}
        totalCount={data.softwares.filteredCount}
        infiniteScroll={{
          hasNextPage: hasNext,
          isFetchingNextPage: isLoadingNext,
          onLoadMore: () => {
            if (hasNext && !isLoadingNext) loadNext(SOFTWARE_LIST_PAGE_SIZE);
          },
        }}
      />
    </SoftwareAdoptionRefsContext>
  );
}

/** The fleet table over one variant's rows: the page, its total and its next page. */
function SoftwareListTableRows({
  rows,
  totalCount,
  infiniteScroll,
  selections,
  onSelectionsChange,
  debouncedSearch,
  isPending,
  onEmptyChange,
  stickyHeaderOffset,
  emptyTitle,
  emptyDescription,
  filtersOpen,
  onFiltersClose,
}: SoftwareListTableProps & Pick<SoftwareTableProps, 'rows' | 'totalCount' | 'infiniteScroll'>) {
  // The funnels' options: what occurs across the tenant's titles, from the server.
  const filterOptions = useSoftwareListFilters();

  return (
    <SoftwareTable
      surface="fleet"
      rows={rows}
      totalCount={totalCount}
      debouncedSearch={debouncedSearch}
      isPending={isPending}
      emptyState={<EmptyState icon={<Parcel02Icon />} title={emptyTitle} description={emptyDescription} />}
      onEmptyChange={onEmptyChange}
      stickyHeaderOffset={stickyHeaderOffset}
      selections={selections}
      onSelectionsChange={onSelectionsChange}
      filterOptions={filterOptions}
      filtersOpen={filtersOpen}
      onFiltersClose={onFiltersClose}
      infiniteScroll={infiniteScroll}
    />
  );
}
