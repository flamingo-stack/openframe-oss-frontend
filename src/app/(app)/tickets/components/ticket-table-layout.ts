import type { TableSkeletonColumn } from '@/app/components/shared/table-column-layout';

/**
 * Column layout for the ticket tables.
 *
 * Data-only on purpose (see `table-column-layout.ts`). Three renderers read it:
 * `getTicketTableColumns` (the live table on `/tickets` and, minus SOURCE, the
 * device Tickets tab), `TicketsPageSkeleton`, and `DeviceDetailsSkeleton`. The
 * skeletons can't import the live builder — it carries the cells, the avatar and
 * the status tag — which is why they used to re-declare these widths and had
 * drifted (a missing `filterable` on STATUS, and on the device tab a missing
 * `hideAt` on ASSIGNEE plus a missing `align` on the trailing button).
 *
 * SOURCE, ASSIGNEE and STATUS carry no width in the fleet-wide table: they share
 * the row's leftover space. An empty `width` reproduces that — `DataTable` falls
 * back to `flex-1 min-w-0` for a blank width exactly as it does for a missing
 * one — and keeps the field required, so a new column can't forget to state it.
 */

const TICKET_COLUMNS = {
  title: { id: 'title', header: 'TITLE', width: 'w-[60%] md:flex-1 min-w-0' },
  source: { id: 'source', header: 'SOURCE', width: '', hideAt: 'md' },
  assignee: { id: 'assignee', header: 'ASSIGNEE', width: '', hideAt: 'lg' },
  status: { id: 'status', header: 'STATUS', width: '' },
  open: { id: 'open', width: 'w-12 shrink-0 flex-none', hideAt: 'md', align: 'right' },
} satisfies Record<string, TableSkeletonColumn>;

export { TICKET_COLUMNS };

interface TicketColumnLayoutOptions {
  /**
   * Archived tickets have no status filter, so their STATUS header renders a
   * plain label and does NOT survive below `lg` the way a filterable one does.
   */
  isArchived?: boolean;
  /** Drop SOURCE — redundant on the device-scoped list, which is device-scoped already. */
  withSource?: boolean;
  /** Trailing open-in-new-tab column (`getTicketOpenColumn`). */
  withOpen?: boolean;
  /**
   * Widths the caller pins per column id. The device tab fixes ASSIGNEE and
   * STATUS because dropping SOURCE lets the shared flex widths drift.
   */
  widths?: Partial<Record<keyof typeof TICKET_COLUMNS, string>>;
}

/** Ordered layout for a ticket table, as the live builder and its skeletons render it. */
export function ticketTableColumns({
  isArchived = false,
  withSource = true,
  withOpen = true,
  widths,
}: TicketColumnLayoutOptions = {}): TableSkeletonColumn[] {
  const columns: TableSkeletonColumn[] = [
    TICKET_COLUMNS.title,
    ...(withSource ? [TICKET_COLUMNS.source] : []),
    TICKET_COLUMNS.assignee,
    { ...TICKET_COLUMNS.status, filterable: !isArchived },
    ...(withOpen ? [TICKET_COLUMNS.open] : []),
  ];

  if (!widths) return columns;
  return columns.map(column => {
    const width = widths[column.id as keyof typeof TICKET_COLUMNS];
    return width ? { ...column, width } : column;
  });
}

/** The device Tickets tab: no SOURCE, and ASSIGNEE/STATUS pinned to fixed widths. */
export const DEVICE_TICKET_COLUMNS: readonly TableSkeletonColumn[] = ticketTableColumns({
  withSource: false,
  widths: { assignee: 'w-[280px]', status: 'w-[160px]' },
});
