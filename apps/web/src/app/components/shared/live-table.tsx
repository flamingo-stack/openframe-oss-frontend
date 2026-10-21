'use client';

import {
  type ColumnDef,
  DataTable,
  type DataTableBodyProps,
  type DataTableInfiniteFooterProps,
  type DataTableInstance,
  type DataTableSortState,
  useDataTable,
} from '@flamingo-stack/openframe-frontend-core/components/ui';

/** The one empty row set: a module constant, so the loading table's row model is built once. */
const NO_ROWS: never[] = [];

interface LiveTableShellProps<T> {
  /** The list's own page size: the body (and the next page's footer) draw that many skeleton rows. */
  pageSize: number;
  /** Pins the column header below the page's sticky toolbar. */
  stickyHeaderOffset?: string;
  /** `false` hides the column header (a list embedded under its own heading). Default `true`. */
  showHeader?: boolean;
  /** The server's total, when the list knows it (the row count otherwise counts the loaded rows). */
  totalCount?: number;
  /** Server-side sort shown on the header. */
  sort?: DataTableSortState | null;
  onSortChange?: (columnId: string) => void;
  /** What the body says when the answer has no rows. */
  emptyState?: DataTableBodyProps<T>['emptyState'];
  /** Where a row links to. */
  rowHref?: (row: T) => string | null | undefined;
  /** The next page's infinite-scroll sentinel; `null` (or omitted) draws none. */
  footer?: Omit<DataTableInfiniteFooterProps, 'skeletonRows'> | null;
}

export type LiveTableProps<T> = LiveTableShellProps<T> &
  (
    | {
        /** The loaded table, built by the list's Relay container. */
        table: DataTableInstance<T>;
        columns?: never;
      }
    | {
        /**
         * Before the first page answers: the live table's own columns, from the same builder the loaded table calls
         * (funnels pending, no row actions). The table is built here with no rows and drawn in the caller's loading
         * scope, where the body and the row count draw their own skeletons.
         */
        columns: ColumnDef<T>[];
        table?: never;
      }
  );

/**
 * THE live-list table shell: the sticky column header with its row count, the body and the infinite-scroll footer.
 * The loaded list hands it its table; its Suspense fallback hands it the same columns with no table, so the loading
 * table and the loaded one are the same markup and cannot lay out differently.
 */
export function LiveTable<T>(props: LiveTableProps<T>) {
  if (props.table) return <LiveTableShell {...props} table={props.table} />;
  return <EmptyRowsLiveTable {...props} columns={props.columns} />;
}

function EmptyRowsLiveTable<T>({ columns, ...shell }: LiveTableShellProps<T> & { columns: ColumnDef<T>[] }) {
  const table = useDataTable<T>({ data: NO_ROWS, columns, enableSorting: false });
  return <LiveTableShell {...shell} table={table} />;
}

function LiveTableShell<T>({
  table,
  pageSize,
  stickyHeaderOffset,
  showHeader = true,
  totalCount,
  sort,
  onSortChange,
  emptyState,
  rowHref,
  footer,
}: LiveTableShellProps<T> & { table: DataTableInstance<T> }) {
  return (
    <DataTable table={table}>
      {showHeader && (
        <DataTable.Header
          stickyHeader
          stickyHeaderOffset={stickyHeaderOffset}
          rightSlot={<DataTable.RowCount totalCount={totalCount} />}
          sort={sort}
          onSortChange={onSortChange}
        />
      )}
      <DataTable.Body skeletonRows={pageSize} emptyState={emptyState} rowClassName="mb-1" rowHref={rowHref} />
      {footer && <DataTable.InfiniteFooter {...footer} skeletonRows={pageSize} />}
    </DataTable>
  );
}
