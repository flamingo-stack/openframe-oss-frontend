'use client';

import {
  type ColumnDef,
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
    ...softwareNameCell_software
    ...softwareVersionCell_software
    ...softwareVulnerabilitiesCell_software
  }
`;

type SoftwareRow = softwareTable_software$data[number];

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

export interface SoftwareTableProps {
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
}

function LoadedSoftwareTable({
  rows: rowRefs,
  totalCount,
  debouncedSearch,
  isPending,
  emptyState,
  onEmptyChange,
  stickyHeaderOffset,
  infiniteScroll,
}: SoftwareTableProps) {
  // The rows have not answered yet: the table draws its own loading state, never the empty one.
  const loading = useLoadingScope();
  const rows = useFragment(softwareTableFragment, rowRefs);

  const table = useDataTable<SoftwareRow>({
    // The fragment reads back a readonly page; the table only ever reads it too.
    data: rows as SoftwareRow[],
    columns: COLUMNS,
    getRowId,
    enableSorting: false,
  });

  // A search that finds nothing keeps the table (its own "no match" row); a list
  // with nothing in it at all gets the surface's empty state instead.
  const showEmptyState = !loading && !debouncedSearch && !isPending && rows.length === 0;

  useEffect(() => {
    onEmptyChange(showEmptyState);
  }, [showEmptyState, onEmptyChange]);

  if (showEmptyState) {
    return emptyState;
  }

  return (
    <LiveTable
      table={table}
      pageSize={SOFTWARE_LIST_PAGE_SIZE}
      stickyHeaderOffset={stickyHeaderOffset}
      itemName="result"
      totalCount={totalCount}
      isPending={isPending}
      emptyState={oneLineEmptyState(
        debouncedSearch
          ? `No software found matching "${debouncedSearch}". Try adjusting your search.`
          : 'No software found.',
      )}
      rowHref={rowHref}
      // Zero rows plus a next page: see vulnerability-table.tsx.
      footer={rows.length > 0 ? infiniteScroll : null}
    />
  );
}

function SoftwareTableLoading({ stickyHeaderOffset }: { stickyHeaderOffset: string }) {
  return (
    <LiveTable
      columns={COLUMNS}
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
export function SoftwareTable(props: SoftwareTableProps | { stickyHeaderOffset: string }) {
  if (!('rows' in props)) return <SoftwareTableLoading {...props} />;
  return <LoadedSoftwareTable {...props} />;
}
