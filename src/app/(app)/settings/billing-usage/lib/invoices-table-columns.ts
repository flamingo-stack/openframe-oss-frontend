import type { TableSkeletonColumn } from '@/app/components/shared/table-column-layout';

/**
 * Header width taken back below `lg`, so the tablet header is the table's own
 * labels rather than the core's compact filter toolbar — see `tabletHeaderWidth`
 * in `table-column-layout.ts` for why this is spelled out as literal classes.
 */
const TABLET_HEADER_FLEX = 'max-lg:[&&&]:flex-1';
const TABLET_HEADER_ACTIONS = 'max-lg:[&&&]:w-14 max-lg:[&&&]:flex-none';

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
  // Not sortable: the identifier answers "which invoice", and ordering by it is
  // ordering by issue date with an extra step — which DUE DATE already does
  // honestly. The design shows no arrows here either.
  invoiceNumber: {
    id: 'invoiceNumber',
    header: 'INVOICE',
    width: 'flex-1 min-w-0',
    tabletHeaderWidth: TABLET_HEADER_FLEX,
  },
  dueDate: {
    id: 'dueDate',
    header: 'DUE DATE',
    width: 'flex-1 min-w-0',
    sortable: true,
    tabletHeaderWidth: TABLET_HEADER_FLEX,
  },
  amountDue: {
    id: 'amountDue',
    header: 'AMOUNT',
    width: 'flex-1 min-w-0',
    sortable: true,
    tabletHeaderWidth: TABLET_HEADER_FLEX,
  },
  // Filterable rather than sortable: the lifecycle statuses have no order a user
  // would expect ("is Void above or below Draft?"), but "show me only the unpaid
  // ones" is the question the history is actually read with.
  status: {
    id: 'status',
    header: 'STATUS',
    width: 'flex-1 min-w-0',
    filterable: true,
    tabletHeaderWidth: TABLET_HEADER_FLEX,
  },
  // Fixed width reserved in BOTH header and body so the flex-1 columns line up
  // (an empty `w-auto` header cell would collapse to 0 and shift every column).
  actions: {
    id: 'actions',
    width: 'w-14 shrink-0 flex-none',
    align: 'right',
    tabletHeaderWidth: TABLET_HEADER_ACTIONS,
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
