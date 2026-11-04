'use client';

import { ExternalLinkIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button, Tag, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { InvoiceRow } from '@/app/(app)/settings/billing-usage/components/shared/invoice-row';
import { formatCurrency } from '@/lib/format-currency';
import { formatDate } from '@/lib/format-date';
import { InfoCell } from '../shared/info-cell';

const INVOICE_ROW_CLASS =
  'flex w-full flex-col gap-[var(--spacing-system-m)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-m)] content-sm:h-20 content-sm:flex-row content-sm:items-center content-sm:py-0';

/**
 * One outstanding invoice, as the lock screens list them (the unpaid-invoices screen, the paywall's notice); `null`
 * while it is read, when the row draws its own loading state (captions real).
 */
export function OutstandingInvoiceRow({ invoice }: { invoice: InvoiceRow | null }) {
  const loading = useLoadingScope() || !invoice;
  const overdue = invoice ? isOverdue(invoice) : false;
  const name = invoice?.invoiceNumber ? `invoice ${invoice.invoiceNumber}` : 'invoice';
  const payUrl = invoice?.hostedInvoiceUrl;

  return (
    <div data-loading-item className={INVOICE_ROW_CLASS}>
      {/* The identifier over the date it was issued — an em dash when a legacy
          entry has no number, the same reading the Invoices History table uses. */}
      <InfoCell
        loading={loading}
        value={invoice?.invoiceNumber}
        label={invoice ? formatDate(invoice.createdAt) : ''}
        skeletonWidth="w-24"
        labelSkeletonWidth="w-20"
      />
      <InfoCell
        loading={loading}
        value={invoice && formatDate(invoice.dueDate)}
        label="Due Date"
        skeletonWidth="w-24"
      />
      <InfoCell
        loading={loading}
        value={invoice && formatCurrency(invoice.amountDue)}
        label="Amount"
        skeletonWidth="w-24"
      />
      <InfoCell
        loading={loading}
        // No label while the invoice loads: the tag draws its own skeleton in the cell's scope.
        value={
          <Tag variant={overdue ? 'error' : 'warning'} label={invoice ? (overdue ? 'Overdue' : 'Unpaid') : null} />
        }
        label="Status"
      />
      {/* No link before Stripe finalizes the invoice: the control stays, disabled, so the row keeps its shape. */}
      <Button
        variant="outline"
        size="icon"
        {...(payUrl ? { href: payUrl, openInNewTab: true } : { disabled: true })}
        aria-label={loading ? 'Invoice link' : payUrl ? `Open ${name}` : `This ${name} has no payment link yet`}
      >
        <ExternalLinkIcon />
      </Button>
    </div>
  );
}

/** Past its due date. An invoice Stripe auto-charges carries no due date, so it is simply unpaid. */
function isOverdue(invoice: InvoiceRow): boolean {
  if (!invoice.dueDate) return false;
  const due = new Date(invoice.dueDate).getTime();
  return Number.isFinite(due) && due < Date.now();
}

/**
 * Oldest first, by due date and then by issue date.
 *
 * An invoice with no due date sorts by when it was issued, which is the only
 * other thing known about it — never last, because "Stripe charges this one
 * automatically" does not make it less overdue than one with a printed date.
 */
export function byOldestFirst(a: InvoiceRow, b: InvoiceRow): number {
  return dateValue(a.dueDate ?? a.createdAt) - dateValue(b.dueDate ?? b.createdAt);
}

function dateValue(iso: string | null | undefined): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const time = new Date(iso).getTime();
  return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY;
}
