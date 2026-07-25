'use client';

import {
  type ColumnDef,
  DataTable,
  multiSelectFilterFn,
  useDataTable,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useMemo } from 'react';

/**
 * Loading fallback for `LogsTable` — an empty `DataTable` carrying the real
 * table's base columns, so the header row and column widths are identical to
 * the loaded table.
 *
 * Lives in its own module (rather than inside `logs-table.tsx`) because it is
 * reused as a loading state by consumers that must NOT pull in the Relay
 * queries, generated artifacts and drawer machinery of the real table — the
 * device-details skeleton and the route-level logs skeleton.
 */

const EMPTY_LOG_ROWS: unknown[] = [];

export function LogsTableSkeleton() {
  const columns = useMemo<ColumnDef<unknown>[]>(
    () => [
      {
        id: 'logId',
        header: 'Log ID',
        enableSorting: false,
        meta: { width: 'w-[200px]', alwaysShowHeader: true },
      },
      {
        id: 'status',
        header: 'Status',
        enableSorting: false,
        filterFn: multiSelectFilterFn,
        meta: { width: 'w-[120px]', filter: { options: [] } },
      },
      {
        id: 'tool',
        header: 'Tool',
        enableSorting: false,
        filterFn: multiSelectFilterFn,
        meta: { width: 'w-[150px]', hideAt: 'md', filter: { options: [] } },
      },
      {
        id: 'source',
        header: 'SOURCE',
        enableSorting: false,
        filterFn: multiSelectFilterFn,
        meta: { width: 'w-[120px]', hideAt: 'md', filter: { options: [] } },
      },
      {
        id: 'description',
        header: 'Log Details',
        enableSorting: false,
        meta: { width: 'flex-1', hideAt: 'lg' },
      },
      {
        id: 'copy',
        enableSorting: false,
        meta: { width: 'w-12 shrink-0 flex-none ml-auto', align: 'right' },
      },
      {
        id: 'quickView',
        enableSorting: false,
        meta: { width: 'w-12 shrink-0 flex-none', align: 'right' },
      },
      {
        id: 'open',
        enableSorting: false,
        meta: { width: 'w-12 shrink-0 flex-none', hideAt: 'md', align: 'right' },
      },
    ],
    [],
  );

  const table = useDataTable<unknown>({
    data: EMPTY_LOG_ROWS,
    columns,
    getRowId: () => '',
    enableSorting: false,
  });

  return (
    <DataTable table={table}>
      <DataTable.Header stickyHeader stickyHeaderOffset="top-[96px]" />
      <DataTable.Body loading={true} skeletonRows={10} emptyMessage="" rowClassName="mb-1" />
    </DataTable>
  );
}
