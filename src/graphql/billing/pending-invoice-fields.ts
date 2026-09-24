import { graphql, readInlineData } from 'react-relay';
import type {
  pendingInvoiceFields_invoice$data,
  pendingInvoiceFields_invoice$key,
} from '@/__generated__/pendingInvoiceFields_invoice.graphql';

/**
 * One invoice, as every surface reads it: the Invoices History table on the
 * billing page, the billing summary's "latest pending" pick, and the suspended
 * workspace's lock screen.
 *
 * Three documents select it, and the third is what makes one fragment
 * structural rather than tidy: `updateSubscription` returns the subscription's
 * `pendingInvoices`, and Relay REPLACES the store's list with what the mutation
 * returns. When the mutation selected fewer fields than the page reads, a plan
 * upgrade — the one change that raises a new invoice — left that invoice in the
 * store without `amountDue`, the page re-rendered from the store before its
 * refetch, and `formatCurrency(undefined)` took Billing & Usage into the error
 * boundary right after the success toast. Spreading this in the mutation as well
 * means a field added for the page is returned by the mutation by construction.
 *
 * No `currency` beside `amountDue`: `formatCurrency` prints USD, so carrying the
 * code without reading it only looked like support for others. Select it here
 * when a non-USD tenant is real.
 *
 * `@inline` because the consumers are a table fed by props, a summary hook and
 * plain sort/filter functions — not components of their own.
 */
export const pendingInvoiceFieldsFragment = graphql`
  fragment pendingInvoiceFields_invoice on PendingInvoice @inline {
    id
    invoiceNumber
    status
    amountDue
    dueDate
    createdAt
    hostedInvoiceUrl
  }
`;

/** The generated row shape, minus Relay's brand — what the consumers take. */
export type PendingInvoice = Omit<pendingInvoiceFields_invoice$data, ' $fragmentType'>;

export function toPendingInvoice(ref: pendingInvoiceFields_invoice$key): PendingInvoice {
  return readInlineData(pendingInvoiceFieldsFragment, ref);
}
