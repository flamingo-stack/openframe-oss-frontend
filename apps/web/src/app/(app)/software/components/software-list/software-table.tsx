'use client';

import {
  type ColumnDef,
  type DataTableSortState,
  FilterModal,
  type Row,
  useDataTable,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { type ReactNode, useEffect } from 'react';
import { graphql, useFragment } from 'react-relay';
import type {
  softwareTable_software$data,
  softwareTable_software$key,
} from '@/__generated__/softwareTable_software.graphql';
import { type InfiniteScroll, liveColumnMeta, oneLineEmptyState } from '@/app/components/shared';
import { LiveTable } from '@/app/components/shared/live-table';
import { OpenRowButton } from '@/app/components/shared/open-row-button';
import { openInNewTab } from '@/lib/open-in-new-tab';
import { routes } from '@/lib/routes';
import { multiColumnFilter } from '../shared/column-filters';
import type { ListSelections } from '../shared/software-list-frame';
import { SoftwareAutoUpdateCell } from './software-auto-update-cell';
import { SoftwareEngineCell } from './software-engine-cell';
import { SOFTWARE_LIST_COLUMNS, SOFTWARE_LIST_PAGE_SIZE } from './software-list-columns';
import {
  NO_SOFTWARE_LIST_FILTER_OPTIONS,
  SOFTWARE_LIST_FILTER_KEYS,
  type SoftwareListFilterOptions,
  softwareListFilterGroups,
} from './software-list-filters';
import { SoftwareNameCell } from './software-name-cell';
import { SoftwareOsCell } from './software-os-cell';
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
    ...softwareVulnerabilitiesCell_software
    ...softwareOsCell_software
    ...softwareEngineCell_software
    ...softwareAutoUpdateCell_software
  }
`;

type SoftwareRow = softwareTable_software$data[number];

const NAME_COLUMN: ColumnDef<SoftwareRow> = {
  id: SOFTWARE_LIST_COLUMNS.name.id,
  header: SOFTWARE_LIST_COLUMNS.name.header,
  cell: ({ row }: { row: Row<SoftwareRow> }) => <SoftwareNameCell software={row.original} />,
  enableSorting: false,
  meta: liveColumnMeta(SOFTWARE_LIST_COLUMNS.name),
};

const VERSION_COLUMN: ColumnDef<SoftwareRow> = {
  id: SOFTWARE_LIST_COLUMNS.currentVersion.id,
  header: SOFTWARE_LIST_COLUMNS.currentVersion.header,
  cell: ({ row }: { row: Row<SoftwareRow> }) => <SoftwareVersionCell software={row.original} />,
  enableSorting: false,
  meta: liveColumnMeta(SOFTWARE_LIST_COLUMNS.currentVersion),
};

const OPEN_COLUMN: ColumnDef<SoftwareRow> = {
  id: SOFTWARE_LIST_COLUMNS.open.id,
  cell: ({ row }: { row: Row<SoftwareRow> }) => (
    <OpenRowButton label="Open in new tab" onClick={openInNewTab(routes.software.details(row.original.id))} />
  ),
  enableSorting: false,
  meta: liveColumnMeta(SOFTWARE_LIST_COLUMNS.open),
};

/**
 * Which list the table is: the fleet-wide inventory (All Software, design 1076:16413) or a device's own. The fleet's
 * says where each title runs and how it is managed — its OS, engine and auto-update, each with a funnel; a device's
 * keeps the CVE count of the copy it has. The design's Adoption column is not drawn: there is no Adopt yet, and the
 * count is never filled.
 */
export type SoftwareTableSurface = 'fleet' | 'device';

const DEVICE_COLUMNS: ColumnDef<SoftwareRow>[] = [
  NAME_COLUMN,
  VERSION_COLUMN,
  {
    id: SOFTWARE_LIST_COLUMNS.vulnerabilities.id,
    header: SOFTWARE_LIST_COLUMNS.vulnerabilities.header,
    cell: ({ row }: { row: Row<SoftwareRow> }) => <SoftwareVulnerabilitiesCell software={row.original} />,
    enableSorting: false,
    meta: liveColumnMeta(SOFTWARE_LIST_COLUMNS.vulnerabilities),
  },
  OPEN_COLUMN,
];

/** The surface's columns; the fleet's funnels offer `filterOptions` (`useSoftwareListFilters`). */
function columnsFor(surface: SoftwareTableSurface, filterOptions: SoftwareListFilterOptions): ColumnDef<SoftwareRow>[] {
  if (surface === 'device') return DEVICE_COLUMNS;
  return [
    NAME_COLUMN,
    VERSION_COLUMN,
    {
      id: SOFTWARE_LIST_COLUMNS.os.id,
      header: SOFTWARE_LIST_COLUMNS.os.header,
      cell: ({ row }: { row: Row<SoftwareRow> }) => <SoftwareOsCell software={row.original} />,
      enableSorting: false,
      meta: liveColumnMeta(SOFTWARE_LIST_COLUMNS.os, { filter: { options: filterOptions.os } }),
    },
    {
      id: SOFTWARE_LIST_COLUMNS.engine.id,
      header: SOFTWARE_LIST_COLUMNS.engine.header,
      cell: ({ row }: { row: Row<SoftwareRow> }) => <SoftwareEngineCell software={row.original} />,
      enableSorting: false,
      meta: liveColumnMeta(SOFTWARE_LIST_COLUMNS.engine, { filter: { options: filterOptions.engine } }),
    },
    {
      id: SOFTWARE_LIST_COLUMNS.autoUpdate.id,
      header: SOFTWARE_LIST_COLUMNS.autoUpdate.header,
      cell: ({ row }: { row: Row<SoftwareRow> }) => <SoftwareAutoUpdateCell software={row.original} />,
      enableSorting: false,
      meta: liveColumnMeta(SOFTWARE_LIST_COLUMNS.autoUpdate, { filter: { options: filterOptions.autoUpdate } }),
    },
    OPEN_COLUMN,
  ];
}

const getRowId = (row: SoftwareRow) => row.id;
const rowHref = (row: SoftwareRow) => routes.software.details(row.id);

export interface SoftwareTableProps {
  surface: SoftwareTableSurface;
  /** The current page of nodes, whichever connection they came from. */
  rows: softwareTable_software$key;
  /** The server's total for the CURRENT narrowing (`filteredCount`), not the rows fetched so far. */
  totalCount: number;
  debouncedSearch: string;
  /** True while a refetch is in flight — dims the stale rows and guards the empty state. */
  isPending: boolean;
  /** Drawn for a list with nothing in it at all (not a search miss). */
  emptyState: ReactNode;
  /** Nothing in the list at all — the caller drops its toolbar. */
  onEmptyChange: (isEmpty: boolean) => void;
  stickyHeaderOffset: string;
  infiniteScroll: InfiniteScroll;
  /** The fleet's funnels: what they draw as ticked, and their changes out. A surface without funnels leaves them out. */
  selections?: ListSelections;
  onSelectionsChange?: (next: Partial<Record<string, string[]>>) => void;
  /** The fleet's funnel options, from the backend's facets. */
  filterOptions?: SoftwareListFilterOptions;
  /** A device's Vulns sort (the header's toggle); the fleet's list is not sorted. */
  sortState?: DataTableSortState | null;
  onSortChange?: (columnId: string) => void;
  /** The fleet's filter window for a narrow content area (the frame's button opens it), with the same options. */
  filtersOpen?: boolean;
  onFiltersClose?: () => void;
}

const NO_SELECTIONS: ListSelections = {};
const IGNORE_SELECTIONS = () => {};

function LoadedSoftwareTable({
  surface,
  rows: rowRefs,
  totalCount,
  debouncedSearch,
  isPending,
  emptyState,
  onEmptyChange,
  stickyHeaderOffset,
  infiniteScroll,
  selections = NO_SELECTIONS,
  onSelectionsChange = IGNORE_SELECTIONS,
  filterOptions = NO_SOFTWARE_LIST_FILTER_OPTIONS,
  filtersOpen = false,
  onFiltersClose = IGNORE_SELECTIONS,
  sortState = null,
  onSortChange,
}: SoftwareTableProps) {
  // The rows have not answered yet: the table draws its own loading state, never the empty one.
  const loading = useLoadingScope();
  const rows = useFragment(softwareTableFragment, rowRefs);
  const { columnFilters, onColumnFiltersChange } = multiColumnFilter(selections, onSelectionsChange);
  const filtered = Object.values(selections).some(values => values.length > 0);

  const table = useDataTable<SoftwareRow>({
    // The fragment reads back a readonly page; the table only ever reads it too.
    data: rows as SoftwareRow[],
    columns: columnsFor(surface, filterOptions),
    getRowId,
    enableSorting: false,
    state: { columnFilters },
    onColumnFiltersChange,
  });

  // A search or a funnel that finds nothing keeps the table (its own "no match"
  // row); a list with nothing in it at all gets the surface's empty state instead.
  const showEmptyState = !loading && !debouncedSearch && !filtered && !isPending && rows.length === 0;

  useEffect(() => {
    onEmptyChange(showEmptyState);
  }, [showEmptyState, onEmptyChange]);

  if (showEmptyState) {
    return emptyState;
  }

  return (
    <>
      <LiveTable
        table={table}
        pageSize={SOFTWARE_LIST_PAGE_SIZE}
        stickyHeaderOffset={stickyHeaderOffset}
        itemName="result"
        totalCount={totalCount}
        sort={sortState}
        onSortChange={onSortChange}
        isPending={isPending}
        emptyState={oneLineEmptyState(
          debouncedSearch
            ? `No software found matching "${debouncedSearch}". Try adjusting your search.`
            : filtered
              ? 'No software matches these filters.'
              : 'No software found.',
        )}
        rowHref={rowHref}
        // Zero rows plus a next page: see vulnerability-table.tsx.
        footer={rows.length > 0 ? infiniteScroll : null}
      />
      {surface === 'fleet' && (
        <FilterModal
          isOpen={filtersOpen}
          onClose={onFiltersClose}
          filterGroups={softwareListFilterGroups(filterOptions)}
          currentFilters={Object.fromEntries(Object.entries(selections).map(([key, values]) => [key, [...values]]))}
          onFilterChange={filters =>
            onSelectionsChange(
              Object.fromEntries(
                SOFTWARE_LIST_FILTER_KEYS.map(key => [key, (filters[key] as string[] | undefined) ?? []]),
              ),
            )
          }
        />
      )}
    </>
  );
}

function SoftwareTableLoading({
  surface,
  stickyHeaderOffset,
}: {
  surface: SoftwareTableSurface;
  stickyHeaderOffset: string;
}) {
  return (
    <LiveTable
      columns={columnsFor(surface, NO_SOFTWARE_LIST_FILTER_OPTIONS)}
      pageSize={SOFTWARE_LIST_PAGE_SIZE}
      stickyHeaderOffset={stickyHeaderOffset}
      itemName="result"
    />
  );
}

/**
 * The software table. Without `rows` (its first page not read yet, the caller's loading scope) it draws its
 * own loading form: the same table over one page of placeholder rows with their real cells, each in its own loading
 * form, and the count its own. Every surface that lists these renders this one component in both states.
 */
export function SoftwareTable(
  props: SoftwareTableProps | { surface: SoftwareTableSurface; stickyHeaderOffset: string },
) {
  if (!('rows' in props)) return <SoftwareTableLoading {...props} />;
  return <LoadedSoftwareTable {...props} />;
}
