'use client';

import { Parcel02Icon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  type ColumnDef,
  DataTable,
  type DataTableSortState,
  type Row,
  useDataTable,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useEffect } from 'react';
import { graphql, useLazyLoadQuery, usePaginationFragment } from 'react-relay';
import type {
  softwareListTable_query$data,
  softwareListTable_query$key,
} from '@/__generated__/softwareListTable_query.graphql';
import type { softwareListTablePaginationQuery as SoftwareListTablePaginationQueryType } from '@/__generated__/softwareListTablePaginationQuery.graphql';
import type {
  softwareListTableQuery as SoftwareListTableQueryType,
  SortInput,
} from '@/__generated__/softwareListTableQuery.graphql';
import { EmptyState, liveColumnMeta, useRetryKey } from '@/app/components/shared';
import { openInNewTab } from '@/lib/open-in-new-tab';
import { routes } from '@/lib/routes';
import { OpenRowButton } from '../shared/open-row-button';
import { SoftwareDevicesCell } from './software-devices-cell';
import { SOFTWARE_LIST_COLUMNS, SOFTWARE_LIST_PAGE_SIZE } from './software-list-columns';
import { SoftwareNameCell } from './software-name-cell';
import { SoftwareVersionCell } from './software-version-cell';
import { SoftwareVulnerabilitiesCell } from './software-vulnerabilities-cell';

/**
 * The fleet-wide `softwares` connection — one row per software title,
 * aggregated across devices. Search and sort are pushed to the server; the
 * pagination fragment drives infinite scroll.
 *
 * No `softwareFilters` facets ride along: the list has no filter funnels (the
 * design's header carries sort toggles only).
 */
const softwareListTableQuery = graphql`
  query softwareListTableQuery($search: String, $sort: SortInput, $first: Int!, $after: String) {
    ...softwareListTable_query @arguments(search: $search, sort: $sort, first: $first, after: $after)
  }
`;

const softwareListTableFragment = graphql`
  fragment softwareListTable_query on Query
  @refetchable(queryName: "softwareListTablePaginationQuery")
  @argumentDefinitions(
    search: { type: "String" }
    sort: { type: "SortInput" }
    first: { type: "Int", defaultValue: 20 }
    after: { type: "String" }
  ) {
    softwares(search: $search, sort: $sort, first: $first, after: $after)
      @connection(key: "softwareListTable_softwares") {
      filteredCount
      edges {
        node {
          id
          ...softwareNameCell_software
          ...softwareVersionCell_software
          ...softwareDevicesCell_software
          ...softwareVulnerabilitiesCell_software
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

type SoftwareRow = NonNullable<softwareListTable_query$data['softwares']>['edges'][number]['node'];

const COLUMNS: ColumnDef<SoftwareRow>[] = [
  {
    id: SOFTWARE_LIST_COLUMNS.name.id,
    header: SOFTWARE_LIST_COLUMNS.name.header,
    cell: ({ row }: { row: Row<SoftwareRow> }) => <SoftwareNameCell software={row.original} />,
    enableSorting: false,
    meta: liveColumnMeta(SOFTWARE_LIST_COLUMNS.name),
  },
  {
    id: SOFTWARE_LIST_COLUMNS.currentVersion.id,
    header: SOFTWARE_LIST_COLUMNS.currentVersion.header,
    cell: ({ row }: { row: Row<SoftwareRow> }) => <SoftwareVersionCell software={row.original} />,
    enableSorting: false,
    meta: liveColumnMeta(SOFTWARE_LIST_COLUMNS.currentVersion),
  },
  {
    // Column ids of the sortable headers ARE the backend sort fields.
    id: SOFTWARE_LIST_COLUMNS.devicesCount.id,
    header: SOFTWARE_LIST_COLUMNS.devicesCount.header,
    cell: ({ row }: { row: Row<SoftwareRow> }) => <SoftwareDevicesCell software={row.original} />,
    enableSorting: false,
    meta: liveColumnMeta(SOFTWARE_LIST_COLUMNS.devicesCount),
  },
  {
    id: SOFTWARE_LIST_COLUMNS.vulnerabilities.id,
    header: SOFTWARE_LIST_COLUMNS.vulnerabilities.header,
    cell: ({ row }: { row: Row<SoftwareRow> }) => <SoftwareVulnerabilitiesCell software={row.original} />,
    enableSorting: false,
    meta: liveColumnMeta(SOFTWARE_LIST_COLUMNS.vulnerabilities),
  },
  {
    id: SOFTWARE_LIST_COLUMNS.open.id,
    cell: ({ row }: { row: Row<SoftwareRow> }) => (
      <OpenRowButton label="Open in new tab" onClick={openInNewTab(routes.software.details(row.original.id))} />
    ),
    enableSorting: false,
    meta: liveColumnMeta(SOFTWARE_LIST_COLUMNS.open),
  },
];

const getRowId = (row: SoftwareRow) => row.id;
const rowHref = (row: SoftwareRow) => routes.software.details(row.id);

interface SoftwareListTableProps {
  debouncedSearch: string;
  /** Deferred sort — feeds the query (lags the live indicator during a refetch). */
  sort: SortInput | null;
  /** Live sort — drives the header indicator so it flips instantly on click. */
  sortState: DataTableSortState | null;
  onSortChange: (columnId: string) => void;
  /**
   * True while the deferred query variables lag the live search/sort state (a
   * refetch is in flight and the rows on screen are the previous result) —
   * guards the empty state so it never flashes on stale data.
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
  sortState,
  onSortChange,
  isPending,
  onEmptyChange,
  stickyHeaderOffset,
  emptyTitle,
  emptyDescription,
}: SoftwareListTableProps) {
  const retryKey = useRetryKey();
  const queryData = useLazyLoadQuery<SoftwareListTableQueryType>(
    softwareListTableQuery,
    { search: debouncedSearch || null, sort, first: SOFTWARE_LIST_PAGE_SIZE, after: null },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );

  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    SoftwareListTablePaginationQueryType,
    softwareListTable_query$key
  >(softwareListTableFragment, queryData);

  const rows = (data.softwares?.edges ?? []).map(edge => edge.node);
  const totalCount = data.softwares?.filteredCount ?? rows.length;

  const fetchNextPage = () => {
    if (hasNext && !isLoadingNext) loadNext(SOFTWARE_LIST_PAGE_SIZE);
  };

  const table = useDataTable<SoftwareRow>({ data: rows, columns: COLUMNS, getRowId, enableSorting: false });

  const showEmptyState = !debouncedSearch && !isPending && rows.length === 0;

  useEffect(() => {
    onEmptyChange(showEmptyState);
  }, [showEmptyState, onEmptyChange]);

  if (showEmptyState) {
    return <EmptyState icon={<Parcel02Icon />} title={emptyTitle} description={emptyDescription} />;
  }

  return (
    // Dim (don't unmount) the stale rows while a deferred refetch is in flight —
    // the subtle fade is the pending feedback. Swapping to skeletons is exactly
    // the flash the deferral avoids.
    <div className={`transition-opacity duration-200 ${isPending ? 'opacity-60' : ''}`}>
      <DataTable table={table}>
        <DataTable.Header
          stickyHeader
          stickyHeaderOffset={stickyHeaderOffset}
          rightSlot={<DataTable.RowCount itemName="result" totalCount={totalCount} />}
          sort={sortState}
          onSortChange={onSortChange}
        />
        <DataTable.Body
          skeletonRows={SOFTWARE_LIST_PAGE_SIZE}
          emptyMessage={
            debouncedSearch
              ? `No software found matching "${debouncedSearch}". Try adjusting your search.`
              : 'No software found.'
          }
          rowClassName="mb-1"
          rowHref={rowHref}
        />
        {/* Zero rows plus a next page: see vulnerability-list-table.tsx. */}
        {rows.length > 0 && (
          <DataTable.InfiniteFooter
            hasNextPage={hasNext}
            isFetchingNextPage={isLoadingNext}
            onLoadMore={fetchNextPage}
            skeletonRows={2}
          />
        )}
      </DataTable>
    </div>
  );
}
