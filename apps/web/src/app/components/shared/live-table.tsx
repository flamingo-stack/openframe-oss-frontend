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
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { type ReactNode, useMemo } from 'react';

/**
 * The gap under every row of a list table, its skeleton rows included. Every table that gaps its rows uses this one
 * class (a `DataTable.Body` outside `LiveTable` passes it as its `rowClassName`).
 */
export const LIVE_ROW_GAP_CLASS = 'mb-1';

/**
 * A refetch is in flight and the rows inside are the previous result: they are dimmed, never unmounted (swapping them
 * for skeletons is the flash the deferred query avoids). The one place a list draws that dim; `LiveTable` wraps its
 * table in it, and a list table that is not a `LiveTable` wraps itself.
 */
export function PendingDim({ isPending, children }: { isPending: boolean; children: ReactNode }) {
  return <div className={cn('transition-opacity duration-200', isPending && 'opacity-60')}>{children}</div>;
}

/**
 * One page of rows still being read: an id each and nothing a cell can show. A table holds them while it loads and its
 * body draws them with their REAL cells (`DataTable.Body`'s `loadingCells`): every part of a cell switches itself in
 * the body's loading scope, so a loading row is the loaded row's own layout. A cell must therefore read its row's
 * fields as possibly absent and draw them through parts that switch (`TruncateText`, `Tag`, a cell's own switch).
 */
export function loadingPlaceholderRows<T>(count: number): T[] {
  return Array.from({ length: count }, (_, index) => ({ id: `loading-${index}` }) as T);
}

/**
 * How many skeleton rows the body draws while it loads: a paged list's `pageSize` (one full page; the next page's
 * footer draws the same), or a list read whole's `skeletonRows` (its typical row count; such a list has no footer).
 */
export type LiveTableRows =
  | {
      /** The list's own page size: the body (and the next page's footer) draw that many skeleton rows. */
      pageSize: number;
      skeletonRows?: never;
    }
  | {
      /** The typical row count of a list read whole (no paging): the body's skeleton rows. */
      skeletonRows: number;
      pageSize?: never;
    };

interface LiveTableShellProps<T> {
  /** `false` lets the column header scroll with the rows (a table embedded in a scrolling section). Default `true`. */
  stickyHeader?: boolean;
  /** Pins the column header below the page's sticky toolbar. */
  stickyHeaderOffset?: string;
  /** `false` hides the column header (a list embedded under its own heading). Default `true`. */
  showHeader?: boolean;
  /** `false` leaves the row count out of the header (a list whose count says nothing). Default `true`. */
  showRowCount?: boolean;
  /** What a row is called in the header's count ("result", "article"). The count's own default otherwise. */
  itemName?: string;
  /** The server's total, when the list knows it (the row count otherwise counts the loaded rows). */
  totalCount?: number;
  /** Server-side sort shown on the header. */
  sort?: DataTableSortState | null;
  onSortChange?: (columnId: string) => void;
  /**
   * A refetch is in flight and the rows on screen are the previous result: they are dimmed (`PendingDim`), never
   * unmounted.
   */
  isPending?: boolean;
  /** What the body says when the answer has no rows. */
  emptyState?: DataTableBodyProps<T>['emptyState'];
  /** Where a row links to. */
  rowHref?: (row: T) => string | null | undefined;
  /** Click on a row (a list that opens a drawer rather than a page). Wins over `rowHref`. */
  onRowClick?: (row: T) => void;
  /**
   * A row's own classes beside the row gap (an open row's ground). The gap itself is the table's
   * (`LIVE_ROW_GAP_CLASS`, on its skeleton rows too); the body skips a function on skeleton rows.
   */
  rowClassName?: (row: T) => string;
  /** Content attached below a row, inside the same card (the body's `renderSubRow`). */
  renderSubRow?: DataTableBodyProps<T>['renderSubRow'];
  /** The design row height, when the list's rows are not the default (the body's `rowHeightClassName`). */
  rowHeightClassName?: string;
  /** The next page's infinite-scroll sentinel; `null` (or omitted) draws none. */
  footer?: Omit<DataTableInfiniteFooterProps, 'skeletonRows'> | null;
  /**
   * The table holds placeholder rows while it loads (`loadingPlaceholderRows`, one page): the body draws them with
   * their real cells in its loading scope. Set by the `columns` form itself; a list that builds its own table over
   * placeholder rows while loading sets it too.
   */
  loadingCells?: boolean;
}

export type LiveTableProps<T> = LiveTableShellProps<T> &
  LiveTableRows &
  (
    | {
        /** The loaded table, built by the list's Relay container. */
        table: DataTableInstance<T>;
        columns?: never;
      }
    | {
        /**
         * Before the first page answers: the live table's own columns, from the same builder the loaded table calls
         * (funnels pending, no row actions). The table is built here over one page of placeholder rows
         * (`loadingPlaceholderRows`) and drawn in the caller's loading scope, where every cell and the row count draw
         * their own loading form.
         */
        columns: ColumnDef<T>[];
        table?: never;
      }
  );

/**
 * THE live-list table shell: the pending dim, the sticky column header with its row count, the body and the
 * infinite-scroll footer. The loaded list hands it its table; its loading form hands it the same columns with no
 * table, so the loading table and the loaded one are the same markup and cannot lay out differently.
 */
export function LiveTable<T>(props: LiveTableProps<T>) {
  if (props.table) return <LiveTableShell {...props} table={props.table} />;
  return <LoadingRowsLiveTable {...props} columns={props.columns} />;
}

function LoadingRowsLiveTable<T>({
  columns,
  ...shell
}: LiveTableShellProps<T> & LiveTableRows & { columns: ColumnDef<T>[] }) {
  const count = shell.pageSize ?? shell.skeletonRows;
  const data = useMemo(() => loadingPlaceholderRows<T>(count), [count]);
  const table = useDataTable<T>({ data, columns, enableSorting: false });
  return <LiveTableShell {...shell} table={table} loadingCells />;
}

function LiveTableShell<T>({
  table,
  pageSize,
  skeletonRows,
  stickyHeader = true,
  stickyHeaderOffset,
  showHeader = true,
  showRowCount = true,
  itemName,
  totalCount,
  sort,
  onSortChange,
  isPending = false,
  emptyState,
  rowHref,
  onRowClick,
  rowClassName,
  renderSubRow,
  rowHeightClassName,
  footer,
  loadingCells = false,
}: LiveTableShellProps<T> & LiveTableRows & { table: DataTableInstance<T> }) {
  const rows = pageSize ?? skeletonRows;
  return (
    <PendingDim isPending={isPending}>
      <DataTable table={table}>
        {showHeader && (
          <DataTable.Header
            stickyHeader={stickyHeader}
            stickyHeaderOffset={stickyHeaderOffset}
            rightSlot={showRowCount && <DataTable.RowCount itemName={itemName} totalCount={totalCount} />}
            sort={sort}
            onSortChange={onSortChange}
          />
        )}
        <DataTable.Body
          loadingCells={loadingCells}
          skeletonRows={rows}
          emptyState={emptyState}
          rowClassName={rowClassName ? (row: T) => cn(LIVE_ROW_GAP_CLASS, rowClassName(row)) : LIVE_ROW_GAP_CLASS}
          rowHref={rowHref}
          onRowClick={onRowClick}
          renderSubRow={renderSubRow}
          rowHeightClassName={rowHeightClassName}
        />
        {footer && <DataTable.InfiniteFooter {...footer} skeletonRows={rows} />}
      </DataTable>
    </PendingDim>
  );
}
