'use client';

import { AlertTriangleIcon, ExternalLinkIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { outstandingInvoicesNotice_query$key } from '@/__generated__/outstandingInvoicesNotice_query.graphql';
import { isOutstandingInvoice, toInvoiceRow } from '@/app/(app)/settings/billing-usage/components/shared/invoice-row';
import { byOldestFirst, OutstandingInvoiceRow } from './outstanding-invoice-row';

/** On the root type so the paywall's own query carries it: plans and money owed land in one answer. */
const outstandingInvoicesNoticeFragment = graphql`
  fragment outstandingInvoicesNotice_query on Query {
    subscription {
      id
      pendingInvoices {
        ...invoiceRow_invoice
      }
    }
  }
`;

/**
 * Money still owed, on the paywall: a cancelled subscription's final usage invoice stays open after the app locks,
 * and the paywall is all the tenant can reach. Nothing while loading or when nothing is owed.
 */
export function OutstandingInvoicesNotice({ query }: { query: outstandingInvoicesNotice_query$key | null }) {
  const data = useFragment(outstandingInvoicesNoticeFragment, query);
  const invoices = (data?.subscription?.pendingInvoices ?? [])
    .map(toInvoiceRow)
    .filter(isOutstandingInvoice)
    .sort(byOldestFirst);

  if (invoices.length === 0) return null;

  // The oldest one Stripe has finalized: an invoice without a link cannot be paid yet.
  const payUrl = invoices.find(invoice => invoice.hostedInvoiceUrl)?.hostedInvoiceUrl ?? null;
  const single = invoices.length === 1;

  return (
    <section
      aria-label="Unpaid invoices"
      className="flex flex-col gap-[var(--spacing-system-m)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-m)]"
    >
      <div className="flex flex-col gap-[var(--spacing-system-m)] content-md:flex-row content-md:items-center">
        <AlertTriangleIcon className="size-6 shrink-0 text-ods-warning" />
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="font-bold text-ods-text-primary text-h3">
            {single ? 'You have an unpaid invoice.' : `You have ${invoices.length} unpaid invoices.`}
          </p>
          <p className="text-ods-text-secondary text-h4">
            {single
              ? 'It covers usage from your previous subscription and stays open until it is paid. A new plan does not settle it.'
              : 'They cover usage from your previous subscription and stay open until they are paid. A new plan does not settle them.'}
          </p>
        </div>
        <Button
          variant="outline"
          className="shrink-0"
          {...(payUrl ? { href: payUrl, openInNewTab: true } : { disabled: true })}
          rightIcon={<ExternalLinkIcon />}
        >
          Pay Invoice
        </Button>
      </div>
      {invoices.map(invoice => (
        <OutstandingInvoiceRow key={invoice.id} invoice={invoice} />
      ))}
    </section>
  );
}
