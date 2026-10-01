'use client';

import {
  type ColumnDef,
  DataTable,
  type DataTableSortState,
  type Row,
  useDataTable,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { type ReactNode, useEffect } from 'react';
import { graphql, useFragment } from 'react-relay';
import type {
  softwareTable_software$data,
  softwareTable_software$key,
} from '@/__generated__/softwareTable_software.graphql';
import { liveColumnMeta, type TableSkeletonColumn } from '@/app/components/shared';
import { openInNewTab } from '@/lib/open-in-new-tab';
import { routes } from '@/lib/routes';
import { FLEET_LIST_SKELETON_ROWS } from '../shared/fleet-list-paging';
import { OpenRowButton } from '../shared/open-row-button';
import { SoftwareDevicesCell } from './software-devices-cell';
import { SOFTWARE_LIST_COLUMNS } from './software-list-columns';
import { SoftwareNameCell } from './software-name-cell';
import { SoftwareVersionCell } from './software-version-cell';
import { SoftwareVulnerabilitiesCell } from './software-vulnerabilities-cell';

/**
 * The software table — one row per `Software` title, the same on every surface
 * that lists them: the fleet-wide inventory (`softwares`) and a device's own
 * (`deviceSoftware`). Plural, because a surface hands over a page of nodes at a
 * time: each caller spreads this on its connection's node and owns the query,
 * the pagination and the narrowing; this module owns what a row looks like.
 */
const softwareTableFragment = graphql`
  fragment softwareTable_software on Software @relay(plural: true) {
    id
    ...softwareNameCell_software
    ...softwareVersionCell_software
    ...softwareDevicesCell_software
    ...softwareVulnerabilitiesCell_software
  }
`;

type SoftwareRow = softwareTable_software$data[number];

/**
 * The layout says which headers CAN carry a sort toggle; the surface says which
 * DO — a toggle the connection cannot honour is worse than none.
 */
function columnMeta<const T extends object>(column: TableSkeletonColumn, sortableIds: readonly string[], extra?: T) {
  return liveColumnMeta({ ...column, sortable: sortableIds.includes(column.id) }, extra);
}

function buildColumns(sortableIds: readonly string[]): ColumnDef<SoftwareRow>[] {
  return [
    {
      id: SOFTWARE_LIST_COLUMNS.name.id,
      header: SOFTWARE_LIST_COLUMNS.name.header,
      cell: ({ row }: { row: Row<SoftwareRow> }) => <SoftwareNameCell software={row.original} />,
      enableSorting: false,
      meta: columnMeta(SOFTWARE_LIST_COLUMNS.name, sortableIds),
    },
    {
      id: SOFTWARE_LIST_COLUMNS.currentVersion.id,
      header: SOFTWARE_LIST_COLUMNS.currentVersion.header,
      cell: ({ row }: { row: Row<SoftwareRow> }) => <SoftwareVersionCell software={row.original} />,
      enableSorting: false,
      meta: columnMeta(SOFTWARE_LIST_COLUMNS.currentVersion, sortableIds),
    },
    {
      // Column ids of the sortable headers ARE the backend sort fields.
      id: SOFTWARE_LIST_COLUMNS.devicesCount.id,
      header: SOFTWARE_LIST_COLUMNS.devicesCount.header,
      cell: ({ row }: { row: Row<SoftwareRow> }) => <SoftwareDevicesCell software={row.original} />,
      enableSorting: false,
      meta: columnMeta(SOFTWARE_LIST_COLUMNS.devicesCount, sortableIds),
    },
    {
      id: SOFTWARE_LIST_COLUMNS.vulnerabilities.id,
      header: SOFTWARE_LIST_COLUMNS.vulnerabilities.header,
      cell: ({ row }: { row: Row<SoftwareRow> }) => <SoftwareVulnerabilitiesCell software={row.original} />,
      enableSorting: false,
      meta: columnMeta(SOFTWARE_LIST_COLUMNS.vulnerabilities, sortableIds),
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
}

const getRowId = (row: SoftwareRow) => row.id;
const rowHref = (row: SoftwareRow) => routes.software.details(row.id);

export interface SoftwareTableProps {
  /** The current page of nodes, whichever connection they came from. */
  rows: softwareTable_software$key;
  /** The server's total for the CURRENT narrowing (`filteredCount`), not the rows fetched so far. */
  totalCount: number;
  debouncedSearch: string;
  /** Column ids the surface's connection sorts by — the toggles drawn. */
  sortableIds: readonly string[];
  /** Live sort — drives the header indicator so it flips instantly on click. */
  sortState: DataTableSortState | null;
  onSortChange: (columnId: string) => void;
  /** True while a refetch is in flight — dims the stale rows and guards the empty state. */
  isPending: boolean;
  /** Drawn for a list with nothing in it at all (not a search miss). */
  emptyState: ReactNode;
  /** Nothing in the list at all — the caller drops its toolbar. */
  onEmptyChange: (isEmpty: boolean) => void;
  stickyHeaderOffset: string;
  infiniteScroll: {
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    onLoadMore: () => void;
  };
}

export function SoftwareTable({
  rows: rowRefs,
  totalCount,
  debouncedSearch,
  sortableIds,
  sortState,
  onSortChange,
  isPending,
  emptyState,
  onEmptyChange,
  stickyHeaderOffset,
  infiniteScroll,
}: SoftwareTableProps) {
  const rows = useFragment(softwareTableFragment, rowRefs);

  const table = useDataTable<SoftwareRow>({
    // The fragment reads back a readonly page; the table only ever reads it too.
    data: rows as SoftwareRow[],
    columns: buildColumns(sortableIds),
    getRowId,
    enableSorting: false,
  });

  // A search that finds nothing keeps the table (its own "no match" row); a list
  // with nothing in it at all gets the surface's empty state instead.
  const showEmptyState = !debouncedSearch && !isPending && rows.length === 0;

  useEffect(() => {
    onEmptyChange(showEmptyState);
  }, [showEmptyState, onEmptyChange]);

  if (showEmptyState) {
    return emptyState;
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
          skeletonRows={FLEET_LIST_SKELETON_ROWS}
          emptyState={{
            title: debouncedSearch
              ? `No software found matching "${debouncedSearch}". Try adjusting your search.`
              : 'No software found.',
          }}
          rowClassName="mb-1"
          rowHref={rowHref}
        />
        {/* Zero rows plus a next page: see vulnerability-list-table.tsx. */}
        {rows.length > 0 && (
          <DataTable.InfiniteFooter
            hasNextPage={infiniteScroll.hasNextPage}
            isFetchingNextPage={infiniteScroll.isFetchingNextPage}
            onLoadMore={infiniteScroll.onLoadMore}
            skeletonRows={2}
          />
        )}
      </DataTable>
    </div>
  );
}
