'use client';

import { type ColumnDef, DataTable, useDataTable } from '@flamingo-stack/openframe-frontend-core/components/ui';

/** The one empty row set: a module constant, so the table's row model is built once. */
const NO_ROWS: never[] = [];

export interface EmptyLiveTableProps<T> {
  /** The live table's own columns, from the same builder the loaded table calls (funnels pending, no row actions). */
  columns: ColumnDef<T>[];
  /** The list's own page size: the body draws that many skeleton rows. */
  pageSize: number;
  /** Pins the column header below the page's sticky toolbar, as the loaded table does. */
  stickyHeaderOffset?: string;
}

/**
 * A live table before its first page answers: the real columns and header (row count included) with no rows, rendered
 * in a loading scope, where the body and the row count draw their own skeletons. The Suspense fallback of a list whose
 * table is built inside its Relay container renders this with that container's column builder, so the loading table
 * and the loaded one cannot lay out differently.
 */
export function EmptyLiveTable<T>({ columns, pageSize, stickyHeaderOffset }: EmptyLiveTableProps<T>) {
  const table = useDataTable<T>({ data: NO_ROWS, columns, enableSorting: false });

  return (
    <DataTable table={table}>
      <DataTable.Header stickyHeader stickyHeaderOffset={stickyHeaderOffset} rightSlot={<DataTable.RowCount />} />
      <DataTable.Body skeletonRows={pageSize} rowClassName="mb-1" />
    </DataTable>
  );
}
