'use client';

import {
  type ColumnFiltersState,
  type SortingState,
  useDataTable,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useState } from 'react';
import { LiveTable } from '@/app/components/shared/live-table';
import { useTableGrid } from '@/app/components/shared/table-layout-scope';
import { CHECK_TABLE_COLUMNS } from './checks-table-columns';
import type { CheckTableRow } from './checks-table-row';

/** The built-in catalog's size: the rows the table holds while it loads. */
const CHECKS_SKELETON_ROWS = 15;

/**
 * Every built-in check with its default for all devices; a click opens its page. In a loading scope (or before its
 * rows) it is the same columns over placeholder rows.
 */
export function ChecksTable({ rows }: { rows?: CheckTableRow[] }) {
  const grid = useTableGrid('insight-checks');
  const loading = useLoadingScope() || !rows;
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const table = useDataTable<CheckTableRow>({
    data: rows ?? [],
    columns: CHECK_TABLE_COLUMNS,
    getRowId: (row: CheckTableRow) => row.id,
    clientSideSorting: true,
    clientSideFiltering: true,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
  });
  if (loading) {
    return <LiveTable columns={CHECK_TABLE_COLUMNS} skeletonRows={CHECKS_SKELETON_ROWS} itemName="check" {...grid} />;
  }
  return (
    <LiveTable
      table={table}
      skeletonRows={CHECKS_SKELETON_ROWS}
      itemName="check"
      onRowClick={(row: CheckTableRow) => row.open?.()}
      {...grid}
    />
  );
}
