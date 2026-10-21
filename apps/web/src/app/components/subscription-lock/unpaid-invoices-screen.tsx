'use client';

import { ErrorBoundary } from '@flamingo-stack/openframe-frontend-core/components/features';
import { ExternalLinkIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button, LoadingItems, Tag, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { type ReactNode, useMemo } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { unpaidInvoicesScreenQuery as UnpaidInvoicesScreenQueryType } from '@/__generated__/unpaidInvoicesScreenQuery.graphql';
import {
  type InvoiceRow,
  isOutstandingInvoice,
  toInvoiceRow,
} from '@/app/(app)/settings/billing-usage/components/shared/invoice-row';
import { SubscriptionStatus } from '@/generated/schema-enums';
import { formatCurrency } from '@/lib/format-currency';
import { formatDate } from '@/lib/format-date';
import { routes } from '@/lib/routes';
import { GatedSuspense } from '../shared/gated-suspense';
import { InfoCell } from '../shared/info-cell';
import { CheckAgainButton, LockScreenActions } from './lock-screen-actions';
import { WorkspaceInactiveScreen } from './workspace-inactive-screen';

/**
 * The invoices the workspace still owes, and nothing else.
 *
 * `pendingInvoices` is the tenant's full Stripe history, so the screen filters
 * it down itself (see `isOutstanding`) rather than asking for a subset the
 * schema does not offer. The row is the one the billing page's table reads
 * (`invoice-row.ts`), so the two lists select one shape.
 */
const unpaidInvoicesScreenQuery = graphql`
  query unpaidInvoicesScreenQuery {
    subscription {
      id
      pendingInvoices {
        ...invoiceRow_invoice
      }
    }
  }
`;

/** The two steps of one unpaid invoice this screen is for — see `subscription-status.ts`. */
type DebtStatus = typeof SubscriptionStatus.PAST_DUE | typeof SubscriptionStatus.SUSPENDED;

interface DebtCopy {
  title: string;
  description: string;
  /** The backend says money is owed, but there is no open invoice to pay. */
  nothingOutstanding: string;
}

const DEBT_COPY: Record<DebtStatus, DebtCopy> = {
  [SubscriptionStatus.PAST_DUE]: {
    title: 'Your Invoice Is Overdue',
    description:
      "An invoice is past its due date, so the dashboard is locked until it's paid. Your agents keep working in the meantime. Pay the outstanding balance to restore access instantly.",
    nothingOutstanding:
      "The dashboard is locked over an overdue invoice, and we can't find an open one to settle. Contact support and we'll sort it out.",
  },
  [SubscriptionStatus.SUSPENDED]: {
    title: 'Your Organization Has Been Suspended',
    description:
      "The invoice wasn't paid within 30 days, so access to OpenFrame has been paused. Pay the outstanding balance to restore access instantly.",
    nothingOutstanding:
      "This workspace's access is paused and we can't find an open invoice to settle. Contact support and we'll sort it out.",
  },
};

/**
 * How many invoice rows the list draws while it is read (the outstanding invoices are not paged): one, because at
 * least one is why the workspace is locked.
 */
const UNPAID_INVOICES_SKELETON_ROWS = 1;

/** Shown when the invoices themselves cannot be loaded — the one thing this screen is for. */
const INVOICES_UNAVAILABLE_DESCRIPTION =
  "We couldn't load the outstanding invoices for this workspace. Try again in a moment, or contact support to have access restored.";

interface UnpaidInvoicesScreenProps {
  status: DebtStatus;
}

/**
 * The lock screen for a workspace that owes an invoice: `PAST_DUE` (the
 * dashboard is locked, the agents still run) or `SUSPENDED` (everything is
 * paused).
 *
 * Unlike the other locks this one has a remedy that is neither a plan nor a
 * checkout: an invoice that already exists and is waiting to be paid. So this
 * screen replaces the plan picker rather than decorating it — picking a plan is
 * not what gets this workspace back.
 *
 * Every outstanding invoice is listed, each openable on its own, because a
 * workspace can fall behind by more than one and only the customer knows which
 * one their finance team is asking about. The primary CTA opens the OLDEST —
 * the one the lock is actually counting from.
 *
 * Reached only on builds where payments may be shown: `SubscriptionLockContent`
 * routes the native builds to `WorkspaceInactiveScreen` before this module is
 * even fetched, and it must stay that way — amounts and a "Pay Invoice" CTA are
 * precisely what App Store Guideline 3.1.1 forbids there (see
 * `billing-visibility.ts`).
 */
export function UnpaidInvoicesScreen({ status, loading = false }: UnpaidInvoicesScreenProps & { loading?: boolean }) {
  return (
    // Same reasoning as the paywall's: this screen IS what a locked workspace
    // gets instead of the app, so a throw here would land on the root error page
    // and leave the user with no way out at all. The degraded screen still
    // carries the sign-out, the self-deletion and the support form.
    <ErrorBoundary
      fallback={
        <WorkspaceInactiveScreen title={DEBT_COPY[status].title} description={INVOICES_UNAVAILABLE_DESCRIPTION} />
      }
    >
      <UnpaidInvoicesShell>
        {/* One body for every wait: a gate above it (the role check: `loading`, its query not sent yet) and the
            invoice query. */}
        <GatedSuspense
          gated={loading}
          label="Loading invoices"
          view={<UnpaidInvoicesMain status={status} invoices={null} />}
        >
          <UnpaidInvoicesContent status={status} />
        </GatedSuspense>
      </UnpaidInvoicesShell>
    </ErrorBoundary>
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
function UnpaidInvoicesShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col gap-[var(--spacing-system-xl)] p-[var(--spacing-system-l)]">
      {children}
      {/* "Check Again" leads: paying happens in the Stripe tab, and the lock
          lifts here only once the status is read again. */}
      <LockScreenActions leading={<CheckAgainButton />} />
    </div>
  );
}

function UnpaidInvoicesContent({ status }: UnpaidInvoicesScreenProps) {
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

  // `null` when the subscription answered without its invoices (Stripe could
  // not be reached): the workspace is still locked, but there is nothing to
  // list and nothing to open — which is a different screen from "none owed".
  const pendingInvoices = data.subscription?.pendingInvoices ?? null;
  const invoices = useMemo(
    () => (pendingInvoices ? pendingInvoices.map(toInvoiceRow).filter(isOutstandingInvoice).sort(byOldestFirst) : null),
    [pendingInvoices],
  );

  if (invoices == null) return <UnpaidInvoicesMain status={status} invoices={null} unavailable />;
  return <UnpaidInvoicesMain status={status} invoices={invoices} />;
}

interface UnpaidInvoicesMainProps extends UnpaidInvoicesScreenProps {
  /**
   * `null` while the invoices are on their way (rendered in a loading scope) — the copy is already true then,
   * the rows draw their own loading state and the CTA renders as itself, disabled.
   */
  invoices: readonly InvoiceRow[] | null;
  /** The invoices could not be loaded at all: say so, and offer the support form the shell carries. */
  unavailable?: boolean;
}

function UnpaidInvoicesMain({ status, invoices, unavailable = false }: UnpaidInvoicesMainProps) {
  const copy = DEBT_COPY[status];
  const loading = useLoadingScope() || (invoices == null && !unavailable);
  // The oldest outstanding invoice with a payment link — the lock counts from
  // the oldest, and an invoice Stripe has not finalized has no link yet,
  // so the single big CTA opens the oldest one that can actually be paid. Every
  // other one is still reachable from its own row.
  const payUrl = invoices?.find(invoice => invoice.hostedInvoiceUrl)?.hostedInvoiceUrl ?? null;
  const nothingOutstanding = invoices != null && invoices.length === 0;
  const nothingPayable = invoices != null && invoices.length > 0 && payUrl == null;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-[var(--spacing-system-xl)]">
      <div className="flex w-full max-w-[960px] flex-col gap-[var(--spacing-system-xs)] text-center">
        <h1 className="text-ods-text-primary text-h2">{copy.title}</h1>
        <p className="text-ods-text-secondary text-h4">
          {unavailable
            ? INVOICES_UNAVAILABLE_DESCRIPTION
            : nothingOutstanding
              ? copy.nothingOutstanding
              : copy.description}
        </p>
      </div>

      {!unavailable && !nothingOutstanding && (
        <>
          <div className="flex w-full max-w-[960px] flex-col gap-[var(--spacing-system-xs)]">
            {loading || invoices == null ? (
              <LoadingItems count={UNPAID_INVOICES_SKELETON_ROWS}>
                {() => <OutstandingInvoiceRow invoice={null} />}
              </LoadingItems>
            ) : (
              invoices.map(invoice => <OutstandingInvoiceRow key={invoice.id} invoice={invoice} />)
            )}
          </div>

          <div className="relative flex flex-wrap justify-center gap-[var(--spacing-system-m)]">
            {/* PAST_DUE leaves Billing & Usage open (`isRouteOpenWhileLocked`),
                and the nav is disabled under the lock, so this is the way there. */}
            {status === SubscriptionStatus.PAST_DUE && (
              <Button variant="outline" href={routes.settings.billingUsage()}>
                Open Billing & Usage
              </Button>
            )}
            <Button
              {...(payUrl ? { href: payUrl, openInNewTab: true } : { disabled: true })}
              rightIcon={<ExternalLinkIcon />}
            >
              Pay Invoice
            </Button>
            {/* Under the actions and out of the flow: it appears only once the invoices answer, so it must move
                nothing on this vertically centred screen. */}
            {nothingPayable && (
              <p className="absolute inset-x-0 top-full mt-[var(--spacing-system-xs)] text-center text-ods-error text-h6">
                These invoices have no payment link yet. Contact support to settle them.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

const INVOICE_ROW_CLASS =
  'flex w-full flex-col gap-[var(--spacing-system-m)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-m)] content-sm:h-20 content-sm:flex-row content-sm:items-center content-sm:py-0';

/** One outstanding invoice; `null` while it is read, when the row draws its own loading state (captions real). */
function OutstandingInvoiceRow({ invoice }: { invoice: InvoiceRow | null }) {
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
        aria-label={loading || payUrl ? `Open ${name}` : `This ${name} has no payment link yet`}
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
function byOldestFirst(a: InvoiceRow, b: InvoiceRow): number {
  return dateValue(a.dueDate ?? a.createdAt) - dateValue(b.dueDate ?? b.createdAt);
}

function dateValue(iso: string | null | undefined): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const time = new Date(iso).getTime();
  return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY;
}
