import { graphql, readInlineData } from 'react-relay';
import type { invoiceRow_invoice$data, invoiceRow_invoice$key } from '@/__generated__/invoiceRow_invoice.graphql';
import { InvoiceStatus } from '@/generated/schema-enums';

/**
 * One invoice, as every list of them reads it: the Invoices History table on
 * the billing page, and the lock screen a suspended workspace gets. One
 * selection, so a field one list learns to show is fetched for the other by
 * construction — and so the two can never normalise one `PendingInvoice` two
 * ways in the store.
 *
 * The row is the generated shape, not a hand-written mirror of it: an interface
 * here once promised `amountDue: number` for a store record the update mutation
 * had left without one, and the page went into its error boundary on
 * `formatCurrency(undefined)` right after a plan change.
 *
 * No `currency` beside `amountDue`: `formatCurrency` prints USD, so carrying the
 * code without reading it only looked like support for others.
 */
export const invoiceRowFragment = graphql`
  fragment invoiceRow_invoice on PendingInvoice @inline {
    id
    invoiceNumber
    status
    amountDue
    dueDate
    createdAt
    hostedInvoiceUrl
  }
`;

export type InvoiceRow = Omit<invoiceRow_invoice$data, ' $fragmentType'>;

/** The row as plain data — what a table or a list keys and sorts on. */
export function toInvoiceRow(ref: invoiceRow_invoice$key): InvoiceRow {
  const { id, invoiceNumber, status, amountDue, dueDate, createdAt, hostedInvoiceUrl } = readInlineData(
    invoiceRowFragment,
    ref,
  );
  return { id, invoiceNumber, status, amountDue, dueDate, createdAt, hostedInvoiceUrl };
}

/**
 * Still owed. `OPEN` is Stripe's own "finalized and awaiting payment"; `null` is
 * a legacy entry not yet reconciled, which both lists read as unpaid. Everything
 * else — DRAFT, PAID, VOID, UNCOLLECTIBLE — is either not payable or already
 * settled, and offering to pay it would be a dead link.
 */
export function isOutstandingInvoice(invoice: Pick<InvoiceRow, 'status'>): boolean {
  return invoice.status == null || invoice.status === InvoiceStatus.OPEN;
}
