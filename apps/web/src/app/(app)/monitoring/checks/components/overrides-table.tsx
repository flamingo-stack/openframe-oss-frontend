'use client';

import { type ColumnFiltersState, useDataTable } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useState } from 'react';
import { LiveTable } from '@/app/components/shared/live-table';
import { useTableGrid } from '@/app/components/shared/table-layout-scope';
import { OVERRIDE_TABLE_COLUMNS } from './overrides-table-columns';
import type { OverrideTableRow } from './overrides-table-row';

/** The rows an Exceptions table holds while it has none to draw. */
const OVERRIDES_SKELETON_ROWS = 3;

/** A check's exceptions, the most specific first (the API's order); a click edits one. */
export function OverridesTable({ rows }: { rows: OverrideTableRow[] }) {
  const grid = useTableGrid('insight-check-exceptions');
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const table = useDataTable<OverrideTableRow>({
    data: rows,
    columns: OVERRIDE_TABLE_COLUMNS,
    getRowId: (row: OverrideTableRow) => row.id,
    clientSideFiltering: true,
    enableSorting: false,
    state: { columnFilters },
    onColumnFiltersChange: setColumnFilters,
  });
  return (
    <LiveTable
      table={table}
      skeletonRows={OVERRIDES_SKELETON_ROWS}
      itemName="exception"
      // The section's own header says what the table is; the design draws no count above it.
      showRowCount={false}
      onRowClick={(row: OverrideTableRow) => row.actions?.edit()}
      {...grid}
    />
  );
}
