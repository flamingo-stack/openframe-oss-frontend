'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { Parcel02Icon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { softwareListTableQuery as SoftwareListTableQueryType } from '@/__generated__/softwareListTableQuery.graphql';
import { EmptyState, useRetryKey } from '@/app/components/shared';
import { readCursor, StaleCursorBoundary } from '@/app/components/shared/stale-cursor-boundary';
import { forwardPage } from '@/app/hooks/forward-page';
import { usePagedTable } from '@/app/hooks/use-paged-table';
import { useRefetchPage } from '@/app/hooks/use-refetch-page';
import type { SoftwareListFrameRenderProps } from '../shared/software-list-frame';
import { SOFTWARE_LIST_PAGE_SIZE } from './software-list-columns';
import { toSoftwareFilter } from './software-list-filters';
import { SoftwareTable } from './software-table';
import { useSoftwareListFilters } from './use-software-list-filters';

/**
 * The fleet-wide `softwares` connection — one row per software title,
 * aggregated across devices. Search is pushed to the server; one page at a time, its cursor in the URL (no
 * `@connection`: a cursor from a link must read exactly its page). The rows themselves are the shared
 * `SoftwareTable`, the one a device's own inventory draws too.
 */
const softwareListTableQuery = graphql`
  query softwareListTableQuery($filter: SoftwareFilterInput, $search: String, $first: Int!, $after: String) {
    softwares(filter: $filter, search: $search, first: $first, after: $after) {
      filteredCount
      edges {
        node {
          ...softwareTable_software
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

interface SoftwareListTableProps extends Pick<
  SoftwareListFrameRenderProps,
  | 'deferredSelections'
  | 'selections'
  | 'onSelectionsChange'
  | 'filtersOpen'
  | 'onFiltersClose'
  | 'pager'
  | 'pageVariables'
  | 'paramPrefix'
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
    <StaleCursorBoundary cursor={readCursor(props.pageVariables)} onStaleCursor={props.pager.dropCursor}>
      <SoftwareListTableLoading {...props} />
    </StaleCursorBoundary>
  );
}

/** The rows' loading boundary, the whole output of its own component (the loading standard), under the
 * stale-cursor boundary above. */
function SoftwareListTableLoading(props: SoftwareListTableProps) {
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
  filtersOpen,
  onFiltersClose,
  pager,
  pageVariables,
  paramPrefix,
}: SoftwareListTableProps) {
  const retryKey = useRetryKey();
  const variables = {
    filter: toSoftwareFilter(deferredSelections),
    search: debouncedSearch || null,
    ...forwardPage(pageVariables, SOFTWARE_LIST_PAGE_SIZE),
  };
  const data = useLazyLoadQuery<SoftwareListTableQueryType>(softwareListTableQuery, variables, {
    fetchPolicy: 'store-or-network',
    fetchKey: retryKey,
  });
  const refetch = useRefetchPage<SoftwareListTableQueryType>(softwareListTableQuery, variables);

  const rows = data.softwares.edges.map(edge => edge.node);
  const paged = usePagedTable({
    pager,
    pageInfo: data.softwares.pageInfo,
    rowCount: rows.length,
    prefix: paramPrefix,
    refetch,
    isPending,
  });
  // The funnels' options: what occurs across the tenant's titles, from the server.
  const filterOptions = useSoftwareListFilters();

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
      filterOptions={filterOptions}
      filtersOpen={filtersOpen}
      onFiltersClose={onFiltersClose}
      pager={paged.pager}
      refresh={paged.refresh}
    />
  );
}
