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
import type { SoftwareVersionStatus } from '@/generated/schema-enums';
import type { SoftwareFilterOptions } from '@/graphql/software/software-facets-fields';
import { openInNewTab } from '@/lib/open-in-new-tab';
import { routes } from '@/lib/routes';
import { multiSelectFilterFn } from '@/lib/table-filters';
import { multiColumnFilter } from '../shared/column-filters';
import { OpenRowButton } from '../shared/open-row-button';
import type { ListSelections } from '../shared/software-list-frame';
import { SoftwareDevicesCell } from './software-devices-cell';
import { SOFTWARE_LIST_COLUMNS, SOFTWARE_LIST_PAGE_SIZE } from './software-list-columns';
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
    # What the funnel narrows the rows on screen by, while the refetch it
    # triggered is still in flight.
    versionStatus
    ...softwareNameCell_software
    ...softwareVersionCell_software
    ...softwareDevicesCell_software
    ...softwareVulnerabilitiesCell_software
  }
`;

type SoftwareRow = softwareTable_software$data[number];

/**
 * The funnel's selection as `SoftwareFilterInput` takes it — declared here
 * rather than imported from a Relay artifact, which relay-compiler owns and
 * prunes, with the enums from the generated SDL enums per the project rule.
 */
export interface SoftwareFilterSelection {
  versionStatuses?: SoftwareVersionStatus[];
}

/**
 * The selection as the connection's `filter` — null when nothing is ticked,
 * so the query and the empty-state guard read "unfiltered" off one value.
 */
export function toSoftwareFilterInput(selections: ListSelections): SoftwareFilterSelection | null {
  const versionStatuses = selections[SOFTWARE_LIST_COLUMNS.currentVersion.id] ?? [];
  if (versionStatuses.length === 0) return null;
  return { versionStatuses: [...versionStatuses] as SoftwareVersionStatus[] };
}

/**
 * The layout says which headers CAN carry a sort toggle; the surface says which
 * DO — a toggle the connection cannot honour is worse than none.
 */
function columnMeta<const T extends object>(column: TableSkeletonColumn, sortableIds: readonly string[], extra?: T) {
  return liveColumnMeta({ ...column, sortable: sortableIds.includes(column.id) }, extra);
}

function buildColumns(
  sortableIds: readonly string[],
  filterOptions: SoftwareFilterOptions,
  linksEnabled: boolean,
): ColumnDef<SoftwareRow>[] {
  const columns: ColumnDef<SoftwareRow>[] = [
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
      accessorFn: (row: SoftwareRow) => row.versionStatus ?? '',
      cell: ({ row }: { row: Row<SoftwareRow> }) => <SoftwareVersionCell software={row.original} />,
      enableSorting: false,
      filterFn: multiSelectFilterFn,
      meta: columnMeta(SOFTWARE_LIST_COLUMNS.currentVersion, sortableIds, {
        filter: { options: filterOptions.versionStatuses },
      }),
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
  ];

  if (linksEnabled) {
    columns.push({
      id: SOFTWARE_LIST_COLUMNS.open.id,
      cell: ({ row }: { row: Row<SoftwareRow> }) => (
        <OpenRowButton label="Open in new tab" onClick={openInNewTab(routes.software.details(row.original.id))} />
      ),
      enableSorting: false,
      meta: liveColumnMeta(SOFTWARE_LIST_COLUMNS.open),
    });
  }

  return columns;
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
  /** The funnel's options, from the surface's own facet query. */
  filterOptions: SoftwareFilterOptions;
  /** Live funnel selection by column id — what the headers draw as ticked, so a tick lands instantly. */
  selections: ListSelections;
  onSelectionsChange: (next: Record<string, string[]>) => void;
  /** The rows answer a narrowed query (a funnel is ticked), so an empty page is a miss, not an empty list. */
  isFiltered: boolean;
  /** True while a refetch is in flight — dims the stale rows and guards the empty state. */
  isPending: boolean;
  /** Rows lead into the title's page. Off where the tenant has no Software module to open. */
  linksEnabled?: boolean;
  /** Drawn for a list with nothing in it at all (not a search or funnel miss). */
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
  filterOptions,
  selections,
  onSelectionsChange,
  isFiltered,
  isPending,
  linksEnabled = true,
  emptyState,
  onEmptyChange,
  stickyHeaderOffset,
  infiniteScroll,
}: SoftwareTableProps) {
  const rows = useFragment(softwareTableFragment, rowRefs);

  const { columnFilters, onColumnFiltersChange } = multiColumnFilter(selections, onSelectionsChange);

  const table = useDataTable<SoftwareRow>({
    // The fragment reads back a readonly page; the table only ever reads it too.
    data: rows as SoftwareRow[],
    columns: buildColumns(sortableIds, filterOptions, linksEnabled),
    getRowId,
    enableSorting: false,
    state: { columnFilters },
    onColumnFiltersChange,
  });

  // A search or a funnel that finds nothing keeps the table (its own "no match"
  // row); a list with nothing in it at all gets the surface's empty state instead.
  const showEmptyState = !debouncedSearch && !isFiltered && !isPending && rows.length === 0;

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
          skeletonRows={SOFTWARE_LIST_PAGE_SIZE}
          emptyState={{
            title: debouncedSearch
              ? `No software found matching "${debouncedSearch}". Try adjusting your search.`
              : 'No software matches the selected filters. Try adjusting your filters.',
          }}
          rowClassName="mb-1"
          rowHref={linksEnabled ? rowHref : undefined}
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
