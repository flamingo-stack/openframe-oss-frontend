'use client';

import { ErrorBoundary } from '@flamingo-stack/openframe-frontend-core/components/features';
import { ExternalLinkIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button, Tag } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { type ReactNode, Suspense, useMemo } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { unpaidInvoicesScreenQuery as UnpaidInvoicesScreenQueryType } from '@/__generated__/unpaidInvoicesScreenQuery.graphql';
import { formatCurrency, formatDateOrDash } from '@/app/(app)/settings/billing-usage/lib/format';
import { InvoiceStatus } from '@/generated/schema-enums';
import { LockScreenActions } from './lock-screen-actions';
import { WorkspaceInactiveScreen } from './workspace-inactive-screen';

/**
 * The invoices the workspace still owes, and nothing else.
 *
 * `pendingInvoices` is the tenant's full Stripe history, so the screen filters
 * it down itself (see `isOutstanding`) rather than asking for a subset the
 * schema does not offer.
 */
const unpaidInvoicesScreenQuery = graphql`
  query unpaidInvoicesScreenQuery {
    subscription {
      id
      pendingInvoices {
        id
        invoiceNumber
        status
        amountDue
        dueDate
        createdAt
        hostedInvoiceUrl
      }
    }
  }
`;

type PendingInvoice = NonNullable<UnpaidInvoicesScreenQueryType['response']['subscription']>['pendingInvoices'][number];

const TITLE = 'Your Organization Has Been Suspended';

/** Shown when the invoices themselves cannot be loaded — the one thing this screen is for. */
const INVOICES_UNAVAILABLE_COPY = {
  title: TITLE,
  description:
    "We couldn't load the outstanding invoices for this workspace. Try again in a moment, or contact support to have access restored.",
};

/**
 * The lock screen for a workspace suspended over unpaid invoices.
 *
 * SUSPENDED is a locking status (see `subscription-status.ts`), and unlike the
 * other two it has a remedy that is neither a plan nor a checkout: an invoice
 * that already exists and is waiting to be paid. So this screen replaces the
 * plan picker rather than decorating it — picking a plan is not what gets this
 * workspace back.
 *
 * Every outstanding invoice is listed, each openable on its own, because a
 * workspace can fall behind by more than one and only the customer knows which
 * one their finance team is asking about. The primary CTA opens the OLDEST —
 * the one the suspension is actually counting from.
 *
 * Reached only on builds where payments may be shown: `SubscriptionLockContent`
 * routes the native builds to `WorkspaceInactiveScreen` before this module is
 * even fetched, and it must stay that way — amounts and a "Pay Invoice" CTA are
 * precisely what App Store Guideline 3.1.1 forbids there (see
 * `billing-visibility.ts`).
 */
export function UnpaidInvoicesScreen() {
  return (
    // Same reasoning as the paywall's: this screen IS what a locked workspace
    // gets instead of the app, so a throw here would land on the root error page
    // and leave the user with no way out at all. The degraded screen still
    // carries the sign-out, the self-deletion and the support form.
    <ErrorBoundary fallback={<WorkspaceInactiveScreen {...INVOICES_UNAVAILABLE_COPY} />}>
      <SuspendedWorkspaceShell>
        <Suspense fallback={<SuspendedWorkspaceMain invoices={null} />}>
          <UnpaidInvoicesContent />
        </Suspense>
      </SuspendedWorkspaceShell>
    </ErrorBoundary>
  );
}

/**
 * The same screen while a gate ABOVE it is still resolving (today: the role
 * check). Its own query has not been issued yet, so there is nothing to suspend
 * on — this is the body in its unfilled shape, which is also what the `Suspense`
 * fallback above shows, so the two waits read as one.
 */
export function UnpaidInvoicesLoading() {
  return (
    <SuspendedWorkspaceShell>
      <SuspendedWorkspaceMain invoices={null} />
    </SuspendedWorkspaceShell>
  );
}

/**
 * Page frame plus the actions row.
 *
 * The actions sit OUTSIDE the `Suspense` boundary on purpose: they own the
 * support and delete-account dialogs, and a boundary resolving under an open
 * dialog unmounts the fallback — closing whatever the user had started typing
 * into it.
 */
function SuspendedWorkspaceShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col gap-[var(--spacing-system-xl)] p-[var(--spacing-system-l)]">
      {children}
      <LockScreenActions />
    </div>
  );
}

function UnpaidInvoicesContent() {
  const data = useLazyLoadQuery<UnpaidInvoicesScreenQueryType>(
    unpaidInvoicesScreenQuery,
    {},
    {
      fetchPolicy: 'store-and-network',
      // This IS the lock screen. Gating it behind the subscription gate would
      // park the one query that shows the way out of the lock.
      networkCacheConfig: { metadata: { skipSubscriptionGate: true } },
    },
  );

  const invoices = useMemo(() => {
    const all = data.subscription?.pendingInvoices ?? [];
    return all.filter(isOutstanding).slice().sort(byOldestFirst);
  }, [data]);

  return <SuspendedWorkspaceMain invoices={invoices} />;
}

/**
 * `null` while the invoices are on their way — the copy is already true then,
 * and the CTA renders as itself, disabled. Reusing the real controls rather than
 * grey bars is the app-wide loading convention.
 */
function SuspendedWorkspaceMain({ invoices }: { invoices: readonly PendingInvoice[] | null }) {
  const loading = invoices == null;
  // The oldest outstanding invoice — the one the suspension counts from, and so
  // the one the single big CTA opens. Every other one is still reachable from
  // its own row.
  const oldest = invoices?.[0] ?? null;
  const nothingOutstanding = !loading && invoices.length === 0;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-[var(--spacing-system-xl)]">
      <div className="flex w-full max-w-[960px] flex-col gap-[var(--spacing-system-xs)] text-center">
        <h1 className="text-ods-text-primary text-h2">{TITLE}</h1>
        <p className="text-ods-text-secondary text-h4">
          {nothingOutstanding
            ? "This workspace's access is paused and we can't find an open invoice to settle. Contact support and we'll sort it out."
            : "The invoice wasn't paid within 30 days, so access to OpenFrame has been paused. Pay the outstanding balance to restore access instantly."}
        </p>
      </div>

      {!nothingOutstanding && (
        <>
          <div className="flex w-full max-w-[960px] flex-col gap-[var(--spacing-system-xs)]">
            {loading ? (
              <InvoiceRowPlaceholder />
            ) : (
              invoices.map(invoice => <InvoiceRow key={invoice.id} invoice={invoice} />)
            )}
          </div>

          <Button
            {...(oldest ? { href: oldest.hostedInvoiceUrl, openInNewTab: true } : { disabled: true })}
            rightIcon={<ExternalLinkIcon />}
          >
            Pay Invoice
          </Button>
        </>
      )}
    </div>
  );
}

function InvoiceRow({ invoice }: { invoice: PendingInvoice }) {
  const overdue = isOverdue(invoice);

  return (
    <div className="flex w-full flex-col gap-[var(--spacing-system-m)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-m)] sm:h-20 sm:flex-row sm:items-center sm:py-0">
      {/* The identifier over the date it was issued — an em dash when a legacy
          entry has no number, the same reading the Invoices History table uses. */}
      <InvoiceCell caption={formatDateOrDash(invoice.createdAt)}>{invoice.invoiceNumber ?? '—'}</InvoiceCell>
      <InvoiceCell caption="Due Date">{formatDateOrDash(invoice.dueDate)}</InvoiceCell>
      <InvoiceCell caption="Amount">{formatCurrency(invoice.amountDue)}</InvoiceCell>
      <InvoiceCell caption="Status">
        <Tag variant={overdue ? 'error' : 'warning'} label={overdue ? 'Overdue' : 'Unpaid'} />
      </InvoiceCell>
      <Button
        variant="outline"
        size="icon"
        href={invoice.hostedInvoiceUrl}
        openInNewTab
        aria-label={`Open invoice ${invoice.invoiceNumber ?? ''}`.trim()}
      >
        <ExternalLinkIcon />
      </Button>
    </div>
  );
}

/** The row's shape with nothing in it — one row, because at least one is why we are here. */
function InvoiceRowPlaceholder() {
  return <div className="h-20 w-full animate-pulse rounded-md border border-ods-border bg-ods-skeleton" />;
}

function InvoiceCell({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col justify-center">
      {typeof children === 'string' ? (
        <span className="truncate text-ods-text-primary text-h4">{children}</span>
      ) : (
        <span className="flex items-center">{children}</span>
      )}
      <span className="truncate text-ods-text-secondary text-h6">{caption}</span>
    </div>
  );
}

/**
 * Still owed. `OPEN` is Stripe's own "finalized and awaiting payment"; `null` is
 * a legacy entry not yet reconciled, which the Invoices History table also reads
 * as unpaid. Everything else — DRAFT, PAID, VOID, UNCOLLECTIBLE — is either not
 * payable or already settled, and offering to pay it would be a dead link.
 */
function isOutstanding(invoice: PendingInvoice): boolean {
  return invoice.status == null || invoice.status === InvoiceStatus.OPEN;
}

/** Past its due date. An invoice Stripe auto-charges carries no due date, so it is simply unpaid. */
function isOverdue(invoice: PendingInvoice): boolean {
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
function byOldestFirst(a: PendingInvoice, b: PendingInvoice): number {
  return dateValue(a.dueDate ?? a.createdAt) - dateValue(b.dueDate ?? b.createdAt);
}

function dateValue(iso: string | null | undefined): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const time = new Date(iso).getTime();
  return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY;
}
