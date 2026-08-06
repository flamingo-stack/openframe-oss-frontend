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
 */
const INVOICE_COLUMNS = {
  invoiceNumber: { id: 'invoiceNumber', header: 'INVOICE', width: 'flex-1 min-w-0' },
  dueDate: { id: 'dueDate', header: 'DUE DATE', width: 'flex-1 min-w-0' },
  amountDue: { id: 'amountDue', header: 'AMOUNT', width: 'flex-1 min-w-0' },
  status: { id: 'status', header: 'STATUS', width: 'flex-1 min-w-0' },
  // Fixed width reserved in BOTH header and body so the flex-1 columns line up
  // (an empty `w-auto` header cell would collapse to 0 and shift every column).
  actions: { id: 'actions', width: 'w-14 shrink-0 flex-none', align: 'right' },
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
