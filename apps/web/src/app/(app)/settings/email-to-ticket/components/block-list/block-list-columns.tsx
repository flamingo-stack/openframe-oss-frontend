'use client';

import type { ColumnDef, Row } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { liveColumnMeta } from '@/app/components/shared';
import type { TableSkeletonColumn } from '@/app/components/shared/table-column-layout';
import { AddedByCell, AddedByGridCell, DroppedCell, SenderCell, SenderGridCell } from './block-list-cells';
import type { BlockListEntryRow } from './block-list-entry-row';

export const BLOCK_LIST_COLUMNS = {
  sender: { id: 'sender', header: 'Email or Domain', width: 'flex-1 min-w-0' },
  addedBy: { id: 'addedBy', header: 'Added By', width: 'flex-1 min-w-0', hideAt: 'md' },
  // Three even columns (Figma 4678-121984): the last one leaves the header's results count its own room.
  dropped: { id: 'dropped', header: 'Dropped for 30 days', width: 'flex-none content-md:min-w-0 content-md:flex-1' },
} satisfies Record<string, TableSkeletonColumn>;

type CellProps = { row: Row<BlockListEntryRow> };

/** The columns of a mailbox's Block list (Figma 4678-121984). Read-only: entries are changed in Edit Mailbox. */
export const BLOCK_LIST_TABLE_COLUMNS: ColumnDef<BlockListEntryRow>[] = [
  {
    id: BLOCK_LIST_COLUMNS.sender.id,
    header: BLOCK_LIST_COLUMNS.sender.header,
    cell: ({ row }: CellProps) => <SenderCell row={row.original} />,
    enableSorting: false,
    size: 320,
    meta: liveColumnMeta(BLOCK_LIST_COLUMNS.sender, {
      gridCell: ({ row }: CellProps) => <SenderGridCell row={row.original} />,
    }),
  },
  {
    id: BLOCK_LIST_COLUMNS.addedBy.id,
    header: BLOCK_LIST_COLUMNS.addedBy.header,
    cell: ({ row }: CellProps) => <AddedByCell row={row.original} />,
    enableSorting: false,
    size: 260,
    meta: liveColumnMeta(BLOCK_LIST_COLUMNS.addedBy, {
      gridCell: ({ row }: CellProps) => <AddedByGridCell row={row.original} />,
    }),
  },
  {
    id: BLOCK_LIST_COLUMNS.dropped.id,
    header: BLOCK_LIST_COLUMNS.dropped.header,
    cell: ({ row }: CellProps) => <DroppedCell row={row.original} />,
    enableSorting: false,
    size: 200,
    meta: liveColumnMeta(BLOCK_LIST_COLUMNS.dropped),
  },
];
