'use client';

import { type ColumnDef, DataTable, useDataTable } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useMemo } from 'react';
import { DateColumnHeader } from '@/app/components/shared/date-column-header';
import { multiSelectFilterFn } from '@/lib/table-filters';

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

/**
 * A filterable column while the facets are still in flight: no options, plus the
 * flag saying they are coming. The flag is what keeps the funnel drawn (inert) —
 * an empty filter WITHOUT it means "there is nothing to filter by", and the table
 * hides the funnel for that column. Same contract as `skeletonColumnMeta`.
 */
const PENDING_FILTER = { options: [] as never[], pending: true };

export function LogsTableSkeleton() {
  const columns = useMemo<ColumnDef<unknown>[]>(
    () => [
      {
        id: 'logId',
        // The live table's date control is a custom header, not a `meta.filter`,
        // so `pending` cannot draw it — the same component is rendered here
        // WITHOUT a `filter`, which is its inert form. Present for the same reason
        // the funnels are: an icon that arrives with the data shoves the label
        // sideways.
        header: () => <DateColumnHeader label="Log ID" />,
        enableSorting: false,
        meta: { width: 'w-[200px]', alwaysShowHeader: true },
      },
      {
        id: 'status',
        header: 'Status',
        enableSorting: false,
        filterFn: multiSelectFilterFn,
        meta: { width: 'w-[120px]', filter: PENDING_FILTER },
      },
      {
        id: 'tool',
        header: 'Tool',
        enableSorting: false,
        filterFn: multiSelectFilterFn,
        meta: { width: 'w-[150px]', hideAt: 'md', filter: PENDING_FILTER },
      },
      {
        id: 'source',
        header: 'SOURCE',
        enableSorting: false,
        filterFn: multiSelectFilterFn,
        meta: { width: 'w-[120px]', hideAt: 'md', filter: PENDING_FILTER },
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
