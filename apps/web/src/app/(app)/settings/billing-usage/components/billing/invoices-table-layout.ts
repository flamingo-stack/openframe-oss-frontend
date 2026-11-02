import type { TableSkeletonColumn } from '@/app/components/shared/table-column-layout';

/**
 * Column layout of the Invoices History table, read by its column builder (`invoices-table-columns.tsx`). While the
 * history is read the table holds `INVOICES_SKELETON_ROWS` placeholder rows and the body draws them with these same
 * cells (`DataTable.Body loadingCells`), each cell its own loading form.
 *
 * ## Narrow widths are handled by `hideAt`, like every other table here
 *
 * This table used to be the one exception. It declared no `hideAt` at all and
 * instead took its header widths back below `lg` through `tabletHeaderWidth`
 * (`content-max-lg:[&&&]:flex-1`), outranking the core's own tablet rule on specificity
 * — the only use of that escape hatch in the app. The result was five columns
 * still fighting for ~760px of tablet, every value under `TruncateText`, and a
 * row-count slot whose only slack was the 56px actions column.
 *
 * Now it does what tickets, scripts, schedules and the device tabs do: below
 * `lg` the header IS the core's compact filter toolbar (only STATUS, which is
 * the one control a user acts on, survives there), and the row sheds columns on
 * the way down. The accepted cost is the same one every other table already
 * pays — sorting by DUE DATE / AMOUNT is a `lg`-and-up affordance, because
 * their header cells are what carry the arrows.
 */
const INVOICE_COLUMNS = {
  // Not sortable: the identifier answers "which invoice", and ordering by it is
  // ordering by issue date with an extra step — which DUE DATE already does
  // honestly. The design shows no arrows here either.
  //
  // Never hidden: it is what the row IS.
  invoiceNumber: {
    id: 'invoiceNumber',
    header: 'INVOICE',
    width: 'flex-1 min-w-0',
  },
  // First to go on the way down, and the only date that can be: the invoice
  // cell already prints the issue date under the number, so a narrow row keeps
  // a date either way. Everything else in the row answers a different question.
  dueDate: {
    id: 'dueDate',
    header: 'DUE DATE',
    width: 'flex-1 min-w-0',
    sortable: true,
    hideAt: 'lg',
  },
  // Kept at every width. An invoice list exists to say what is owed; a phone row
  // that dropped the amount would be a list of identifiers.
  amountDue: {
    id: 'amountDue',
    header: 'AMOUNT',
    width: 'flex-1 min-w-0',
    sortable: true,
  },
  // Filterable rather than sortable: the lifecycle statuses have no order a user
  // would expect ("is Void above or below Draft?"), but "show me only the unpaid
  // ones" is the question the history is actually read with.
  //
  // Dropped below `md`, where the row is down to two columns plus the link and
  // the tag would be squeezing the amount. The filter it belongs to is gone
  // there anyway — the whole header is `hidden content-md:flex`.
  status: {
    id: 'status',
    header: 'STATUS',
    width: 'flex-1 min-w-0',
    hideAt: 'md',
  },
  // Never hidden: this is the link that pays the invoice, and it is the only
  // thing on a phone row that can be acted on.
  actions: {
    id: 'actions',
    width: 'w-14 shrink-0 flex-none',
    align: 'right',
  },
} satisfies Record<string, TableSkeletonColumn>;

export { INVOICE_COLUMNS };

/**
 * Placeholder rows the invoices table holds (and draws with its real cells) while it loads. The history is not paged (Stripe's whole list arrives at once), so
 * there is no page size to draw: this is the typical count, short because a workspace's invoice history is short.
 */
export const INVOICES_SKELETON_ROWS = 3;
