'use client';

import {
  type ColumnDef,
  GRID_ACTION_COLUMN_SIZE,
  type Row,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { openInNewTab } from '@/lib/open-in-new-tab';
import { OpenRowButton } from './open-row-button';
import { liveColumnMeta, type TableSkeletonColumn } from './table-column-layout';

/** What a row's ↗ opens: its accessible name, and the address (none: the button is drawn inert). */
interface OpenRowTarget {
  label: string;
  href: string | null | undefined;
}

/**
 * The trailing "open in a new tab" column of a list table, in both layouts. In card rows it is the outlined button in
 * the row's last cell, with the layout the list declares (`column`: its width, where it hides). In the grid it is an
 * action column: 56px, pinned right, never hidden and not in the settings menu. It is kept by hand rather than built
 * with the lib's `actionColumn()`, which sets no `hideAt` and would show the button in card rows that hide it.
 *
 * `target` answers what the row opens; `null` for a row that has nothing to open, which draws no button at all.
 */
export function openRowColumn<T>(column: TableSkeletonColumn, target: (row: T) => OpenRowTarget | null): ColumnDef<T> {
  const button = (row: T, grid: boolean) => {
    const opens = target(row);
    // A row with nothing behind it to open (not a row whose address is unknown yet) draws no button.
    if (!opens) return null;
    const { label, href } = opens;
    return <OpenRowButton grid={grid} label={label} onClick={openInNewTab(href ?? '')} disabled={!href} />;
  };
  return {
    id: column.id,
    cell: ({ row }: { row: Row<T> }) => button(row.original, false),
    size: GRID_ACTION_COLUMN_SIZE,
    enableSorting: false,
    enableHiding: false,
    meta: liveColumnMeta(column, {
      gridKind: 'action',
      gridCell: ({ row }: { row: Row<T> }) => button(row.original, true),
    }),
  };
}
