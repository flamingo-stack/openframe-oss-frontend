'use client';

import { type ColumnDef, GRID_MIN_WIDTH, type Row } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { liveColumnMeta } from '@/app/components/shared';
import { openRowColumn } from '@/app/components/shared/open-row-column';
import type { TableSkeletonColumn } from '@/app/components/shared/table-column-layout';
import { multiSelectFilterFn } from '@/lib/table-filters';
import { RECEIVING_FILTER_OPTIONS } from '../../utils/mailbox-presentation';
import { MailboxCell, MailboxGridCell, StatusCell, TicketsCell } from './mailbox-cells';
import { type MailboxRow, mailboxRowHref } from './mailbox-row';

export const MAILBOX_COLUMNS = {
  mailbox: { id: 'mailbox', header: 'Mailbox', width: 'flex-1 min-w-0' },
  // A phone keeps the mailbox and its status (Figma 4527-131708).
  tickets: { id: 'tickets', header: 'Tickets', width: 'w-40 shrink-0', hideAt: 'md', sortable: true },
  status: { id: 'status', header: 'Status', width: 'flex-none content-md:w-56 content-md:shrink-0' },
  open: { id: 'open', width: 'w-12 shrink-0 flex-none', align: 'right' },
} satisfies Record<string, TableSkeletonColumn>;

type CellProps = { row: Row<MailboxRow> };

/**
 * The columns of the Mailboxes list (Figma 4527-132165): TICKETS sorts on the server (`ticketsCreated`, the last 30
 * days), STATUS filters on the server by receiving state.
 */
export const MAILBOX_TABLE_COLUMNS: ColumnDef<MailboxRow>[] = [
  {
    id: MAILBOX_COLUMNS.mailbox.id,
    header: MAILBOX_COLUMNS.mailbox.header,
    cell: ({ row }: CellProps) => <MailboxCell row={row.original} />,
    enableSorting: false,
    size: 360,
    minSize: GRID_MIN_WIDTH.icon,
    meta: liveColumnMeta(MAILBOX_COLUMNS.mailbox, {
      gridCell: ({ row }: CellProps) => <MailboxGridCell row={row.original} />,
    }),
  },
  {
    id: MAILBOX_COLUMNS.tickets.id,
    header: MAILBOX_COLUMNS.tickets.header,
    cell: ({ row }: CellProps) => <TicketsCell row={row.original} />,
    enableSorting: false,
    size: 160,
    meta: liveColumnMeta(MAILBOX_COLUMNS.tickets),
  },
  {
    id: MAILBOX_COLUMNS.status.id,
    header: MAILBOX_COLUMNS.status.header,
    accessorFn: (row: MailboxRow) => row.receivingState,
    cell: ({ row }: CellProps) => <StatusCell row={row.original} withLine />,
    enableSorting: false,
    filterFn: multiSelectFilterFn,
    size: 220,
    meta: liveColumnMeta(MAILBOX_COLUMNS.status, {
      filter: { options: RECEIVING_FILTER_OPTIONS },
      gridCell: ({ row }: CellProps) => <StatusCell row={row.original} withLine={false} />,
    }),
  },
  openRowColumn<MailboxRow>(MAILBOX_COLUMNS.open, row => ({
    label: `Open ${row.supportAddress ?? 'mailbox'} in new tab`,
    href: mailboxRowHref(row) ?? undefined,
  })),
];
