import type { TableSkeletonColumn } from '@/app/components/shared/table-column-layout';

/**
 * Column layout for the ticket tables.
 *
 * Data-only on purpose (see `table-column-layout.ts`): `getTicketTableColumns`
 * builds the live table on `/tickets` from it, and the device Tickets tab reads
 * its widths (`DEVICE_TICKET_COLUMNS`), so both tables, loading and loaded, are
 * laid out from one declaration.
 *
 * SOURCE, ASSIGNEE and STATUS carry no width in the fleet-wide table: they share
 * the row's leftover space. An empty `width` reproduces that — `DataTable` falls
 * back to `flex-1 min-w-0` for a blank width exactly as it does for a missing
 * one — and keeps the field required, so a new column can't forget to state it.
 */

/**
 * `sortable` is deliberately NOT declared on TITLE here. Only the /tickets list
 * wires a server sort (`TicketsTable`); the device and customer tabs render the
 * same columns without a handler, and an arrow there would be inert. The live
 * builder adds the flag per consumer (`getTicketTableColumns({ sortable })`).
 * The tabs reading this layout (the device tab's `DEVICE_TICKET_COLUMNS`, the
 * customer tab's header labels) never sort, so their headers carry no arrow in
 * either state.
 */
const TICKET_COLUMNS = {
  // Header reads TICKET (Figma tickets 8002-256659): the cell carries the title
  // and, under it, the ticket number with the relative creation time.
  title: { id: 'title', header: 'TICKET', width: 'w-[60%] content-md:flex-1 min-w-0' },
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
