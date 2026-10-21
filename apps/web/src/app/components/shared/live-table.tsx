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
import { NO_ITEMS } from './no-next-page';

/** The gap under every row of a live list, its skeleton rows included. */
const ROW_GAP_CLASS = 'mb-1';

interface LiveTableShellProps<T> {
  /** The list's own page size: the body (and the next page's footer) draw that many skeleton rows. */
  pageSize: number;
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
   * A refetch is in flight and the rows on screen are the previous result: they are dimmed, never unmounted (swapping
   * them for skeletons is the flash the deferred query avoids). The one place a live list draws that dim.
   */
  isPending?: boolean;
  /** What the body says when the answer has no rows. */
  emptyState?: DataTableBodyProps<T>['emptyState'];
  /** Where a row links to. */
  rowHref?: (row: T) => string | null | undefined;
  /** Click on a row (a list that opens a drawer rather than a page). Wins over `rowHref`. */
  onRowClick?: (row: T) => void;
  /**
   * A row's own classes beside the row gap (an open row's ground). The gap itself is the table's (`mb-1`, on its
   * skeleton rows too); the body skips a function on skeleton rows.
   */
  rowClassName?: (row: T) => string;
  /** Content attached below a row, inside the same card (the body's `renderSubRow`). */
  renderSubRow?: DataTableBodyProps<T>['renderSubRow'];
  /** The design row height, when the list's rows are not the default (the body's `rowHeightClassName`). */
  rowHeightClassName?: string;
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
 * THE live-list table shell: the pending dim, the sticky column header with its row count, the body and the
 * infinite-scroll footer. The loaded list hands it its table; its loading form hands it the same columns with no
 * table, so the loading table and the loaded one are the same markup and cannot lay out differently.
 */
export function LiveTable<T>(props: LiveTableProps<T>) {
  if (props.table) return <LiveTableShell {...props} table={props.table} />;
  return <EmptyRowsLiveTable {...props} columns={props.columns} />;
}

function EmptyRowsLiveTable<T>({ columns, ...shell }: LiveTableShellProps<T> & { columns: ColumnDef<T>[] }) {
  const table = useDataTable<T>({ data: NO_ITEMS, columns, enableSorting: false });
  return <LiveTableShell {...shell} table={table} />;
}

function LiveTableShell<T>({
  table,
  pageSize,
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
}: LiveTableShellProps<T> & { table: DataTableInstance<T> }) {
  return (
    <div className={cn('transition-opacity duration-200', isPending && 'opacity-60')}>
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
          skeletonRows={pageSize}
          emptyState={emptyState}
          rowClassName={rowClassName ? (row: T) => cn(ROW_GAP_CLASS, rowClassName(row)) : ROW_GAP_CLASS}
          rowHref={rowHref}
          onRowClick={onRowClick}
          renderSubRow={renderSubRow}
          rowHeightClassName={rowHeightClassName}
        />
        {footer && <DataTable.InfiniteFooter {...footer} skeletonRows={pageSize} />}
      </DataTable>
    </div>
  );
}
