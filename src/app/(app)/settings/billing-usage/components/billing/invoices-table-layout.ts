import type { TableSkeletonColumn } from '@/app/components/shared/table-column-layout';

/**
 * Column layout of the Invoices History table — read by the live table and by
 * `BillingUsageSkeleton`, which stands in for it.
 *
 * Declared apart from `invoices-history.tsx` for the reason the shared
 * `table-column-layout` module exists: a skeleton must not import the real table
 * just to learn its widths (that table carries `useDataTable`, the cell
 * renderers and the status-tag mapping). The page skeleton used to hand-roll its
 * own flex rows instead, which is how it ended up laid out unlike every other
 * table's loading state; both sides now read this array and render the same
 * `DataTable`.
 *
 * ## Narrow widths are handled by `hideAt`, like every other table here
 *
 * This table used to be the one exception. It declared no `hideAt` at all and
 * instead took its header widths back below `lg` through `tabletHeaderWidth`
 * (`max-lg:[&&&]:flex-1`), outranking the core's own tablet rule on specificity
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
  // there anyway — the whole header is `hidden md:flex`.
  status: {
    id: 'status',
    header: 'STATUS',
    width: 'flex-1 min-w-0',
    filterable: true,
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

/** Render order, shared by the live table and its skeleton. */
export const INVOICES_TABLE_COLUMNS: readonly TableSkeletonColumn[] = [
  INVOICE_COLUMNS.invoiceNumber,
  INVOICE_COLUMNS.dueDate,
  INVOICE_COLUMNS.amountDue,
  INVOICE_COLUMNS.status,
  INVOICE_COLUMNS.actions,
];
