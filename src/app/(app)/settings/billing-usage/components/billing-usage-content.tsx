'use client';

import { AlertTriangleIcon, ExternalLinkIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { type ActionsMenuGroup, Button, PageLayout } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { useState } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { billingUsageContentQuery as BillingUsageContentQueryType } from '@/__generated__/billingUsageContentQuery.graphql';
import { LockedScreen } from '@/app/components/shared/locked-screen';
import { SubscriptionStatus } from '@/app/components/subscription-lock/subscription-status';
import { useFeatureFlag } from '@/app/hooks/use-feature-flag';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { routes } from '@/lib/routes';
import { useBillingPortalSession } from '../hooks/use-billing-portal-session';
import { useBillingSummary } from '../hooks/use-billing-summary';
import { useCancelSubscription } from '../hooks/use-cancel-subscription';
import { useCancellationImpact } from '../hooks/use-cancellation-impact';
import { useResumeSubscription } from '../hooks/use-resume-subscription';
import { formatCount, formatCurrency, formatDateOrDash } from '../lib/format';
import { BillingRow, SectionBlock, TestModeBanner } from './billing-section';
import { CancelOfferModal } from './cancel-offer-modal';
import { type CancelReason, CancelSubscriptionModal } from './cancel-subscription-modal';
import { InvoicesHistory } from './invoices-history';
import { SubscriptionCancelledModal } from './subscription-cancelled-modal';
import { TestClockPanel } from './test-clock-panel';
import { UpgradePlanModal } from './upgrade-plan-modal';
import { StatEmphasis, StatSuffix, UsageStatCard } from './usage-stat-card';

export function BillingUsageContent() {
  const handleBack = useSafeBack(routes.settings.root());
  // Bumped after a resume so the billing query refetches from the network — the
  // resumeSubscription mutation returns a bare Boolean, so the Relay store can't
  // reflect the new status on its own.
  const [refreshKey, setRefreshKey] = useState(0);
  const data = useLazyLoadQuery<BillingUsageContentQueryType>(
    billingUsageContentQuery,
    {},
    { fetchPolicy: 'store-and-network', fetchKey: refreshKey },
  );
  const cancelSubscription = useCancelSubscription();
  const resumeSubscription = useResumeSubscription();
  const billingPortal = useBillingPortalSession();
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [cancelStep, setCancelStep] = useState<'idle' | 'reason' | 'offer' | 'cancelled'>('idle');
  const [cancelReason, setCancelReason] = useState<CancelReason | null>(null);
  const [cancelComment, setCancelComment] = useState<string>('');

  const { status, flags, device, ai, plan, billing, updatedPlan } = useBillingSummary(data.subscription);
  const { impact, isLoading: isImpactLoading } = useCancellationImpact({ enabled: cancelStep === 'reason' });

  // `Next Payment` comes straight from the backend's server-computed
  // `subscription.nextPayment` (projected next-invoice total). The row is
  // omitted when there's nothing to bill (null / 0) or while the user is on
  // an active trial — instead of rendering a "Free" placeholder.
  const nextPaymentAmount = billing.nextPayment ?? 0;
  const cancelSubscriptionEnabled = useFeatureFlag('cancel-subscription');

  // Nothing to update in place: these three states have no live paid
  // subscription, so a plan change has to go through Stripe Checkout. PAST_DUE
  // and SUSPENDED are deliberately NOT here — those subscriptions still exist.
  const needsCheckout =
    status === SubscriptionStatus.TRIAL ||
    status === SubscriptionStatus.TRIAL_EXPIRED ||
    status === SubscriptionStatus.CANCELED;

  // A committed package is the only thing that gives the device counter a
  // denominator, so the same condition decides the caption — the card cannot end
  // up reading "247/300" over "Pay as you go", or a bare count over "Prepaid".
  const devicePrepaid = !flags.isTrial && device.allocation > 0;

  const menuActions: ActionsMenuGroup[] = [
    {
      items: [
        {
          id: 'customer-portal',
          // Stripe mints the portal session per click, so this runs a mutation
          // and then navigates — there is no stable URL to hang a link on.
          label: 'Customer Portal',
          icon: <ExternalLinkIcon className="w-6 h-6" />,
          onClick: () => billingPortal.mutate(),
          disabled: billingPortal.isPending,
        },
        ...(status === SubscriptionStatus.ACTIVE && cancelSubscriptionEnabled
          ? [
              {
                id: 'cancel-subscription',
                label: 'Cancel Subscription',
                icon: <AlertTriangleIcon className="w-6 h-6 text-ods-error" />,
                onClick: () => {
                  setCancelReason(null);
                  setCancelStep('reason');
                },
                disabled: cancelSubscription.isPending,
              },
            ]
          : []),
      ],
    },
  ];

  /**
   * The state the workspace is in, when that state has its own thing to do:
   * clear a scheduled cancellation, settle an overdue invoice, or turn a trial
   * into a subscription. Rendered alongside the plan change rather than instead
   * of it — a trial can both be activated and have its device plan chosen.
   *
   * All of them end in the same modal — there is no plan page to send anyone to
   * any more. Activation from a trial is the checkout branch of it, which is why
   * the modal folds every other product in as pay-as-you-go: a checkout session
   * describes the whole plan, not just the part the modal edits.
   */
  const statusAction = flags.isPendingCancellation
    ? {
        label: 'Renew Subscription',
        // Still inside the paid period → clear the scheduled cancellation in
        // place via resumeSubscription (no checkout needed), then refetch.
        onClick: () => resumeSubscription.mutate({ onSuccess: () => setRefreshKey(k => k + 1) }),
        variant: 'accent' as const,
        loading: resumeSubscription.isPending,
        disabled: resumeSubscription.isPending,
      }
    : flags.isOverdue
      ? {
          label: 'Pay Overage',
          onClick: () => {
            if (billing.latestPendingInvoice) {
              window.location.href = billing.latestPendingInvoice.hostedInvoiceUrl;
            } else {
              setPlanModalOpen(true);
            }
          },
          variant: 'accent' as const,
        }
      : flags.isTrial
        ? {
            label: 'Activate Subscription',
            onClick: () => setPlanModalOpen(true),
            variant: 'accent' as const,
          }
        : null;

  // Changing the plan no longer leaves the page — see `UpgradePlanModal`. It
  // steps aside to `outline` whenever the state above has an accent action of
  // its own, so exactly one button reads as the thing to press.
  const upgradeAction = {
    label: 'Upgrade Plan',
    onClick: () => setPlanModalOpen(true),
    variant: (statusAction ? 'outline' : 'accent') as 'accent' | 'outline',
  };

  /**
   * Rightmost is the accent one: the status action when there is one.
   *
   * A scheduled cancellation drops "Upgrade Plan" entirely. The subscription is
   * already on its way out, so a plan change would be edited into something that
   * ends anyway — renewing is the one move that makes the rest meaningful again,
   * and offering both invites the user to pick the one that gets discarded.
   */
  const actions = statusAction
    ? flags.isPendingCancellation
      ? [statusAction]
      : [upgradeAction, statusAction]
    : [upgradeAction];

  // No subscription record at all. Every figure below would be a zero or a dash
  // presented as this tenant's plan, and the header would offer to change a plan
  // that does not exist — so the page states the absence instead of dressing it
  // up. `status` is null ONLY in this case (see `useBillingSummary`).
  if (status == null) {
    return (
      <PageLayout
        title="Billing & Usage"
        className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
        backButton={{ label: 'Back to Settings', onClick: handleBack }}
      >
        <LockedScreen
          icon={<AlertTriangleIcon className="size-8" />}
          title="No subscription found"
          description="This workspace has no billing record yet. Contact support if you expected to see a plan here."
        />
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Billing & Usage"
      className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
      backButton={{ label: 'Back to Settings', onClick: handleBack }}
      actionsVariant="menu-primary"
      actions={actions}
      menuActions={menuActions}
    >
      {/* Dev-only; renders nothing (and issues no requests) unless the test-clock env flag is on. */}
      <TestClockPanel onClockChanged={() => setRefreshKey(k => k + 1)} />

      <TestModeBanner />

      <div className={cn('grid gap-[var(--spacing-system-m)]', flags.hasAi ? 'md:grid-cols-2' : 'md:grid-cols-1')}>
        <UsageStatCard
          title="Device Usage"
          warning={device.overLimit}
          value={
            devicePrepaid ? (
              <>
                {formatCount(device.used)}
                <StatSuffix>/{formatCount(device.allocation)}</StatSuffix>
              </>
            ) : (
              formatCount(device.used)
            )
          }
          caption={
            <DeviceUsageCaption
              isTrial={flags.isTrial}
              trialEndsOn={billing.trialExpirationDate}
              prepaid={devicePrepaid}
              isAnnual={plan.isAnnual}
            />
          }
        />
        {/* Plain consumption for the period. Where the design put a purchased
            balance, and then a free-token allowance beside it, the product meters
            instead — so this counts tokens spent, not tokens held. The free-token
            card comes back when the backend serves those figures; nothing here
            derives them. */}
        {flags.hasAi && <UsageStatCard title="AI Usage" value={formatCount(ai.used)} caption="Pay as you go" />}
      </div>

      {/* One block, one condition: the device count has passed what the plan
          covers. It states the fact, what it costs, when it will be charged, and
          puts the fix inside the block rather than making the user hunt for the
          header button.

          Only the border and the icon carry the warning colour — the copy stays
          in the normal text colours, so the block reads as information about the
          bill rather than an error. */}
      {device.overLimit && (
        <div className="flex flex-col overflow-hidden rounded-md border border-ods-warning bg-ods-card">
          <div className="flex flex-wrap items-center gap-[var(--spacing-system-m)] border-b border-ods-border p-[var(--spacing-system-m)]">
            <AlertTriangleIcon className="size-6 shrink-0 text-ods-warning" />
            <div className="flex min-w-[16rem] flex-1 flex-col">
              <p className="text-h3 font-bold text-ods-text-primary">You're over your device package limit</p>
              <p className="text-h4 text-ods-text-secondary">
                Extra devices will be billed at pay-as-you-go rates, charged separately from your plan.
              </p>
            </div>
            <Button variant="accent" onClick={() => setPlanModalOpen(true)}>
              Upgrade Plan
            </Button>
          </div>
          <div className="flex flex-col gap-3 p-[var(--spacing-system-m)]">
            <BillingRow label="Device Overage" value={formatCount(device.overage)} />
            {billing.estimatedOverage != null && (
              <BillingRow label="Overage Payment" value={formatCurrency(billing.estimatedOverage)} />
            )}
            {billing.nextBillingDate && (
              <BillingRow label="Next Billing" value={formatDateOrDash(billing.nextBillingDate)} />
            )}
          </div>
        </div>
      )}

      {/* Side by side once a change is scheduled: the two plans are read against
          each other, and the right column answers the same questions as the left
          in the same order. On its own, Current Plan takes the full width. */}
      <div
        className={cn(
          'grid grid-cols-1 gap-[var(--spacing-system-l)] items-start',
          flags.hasPendingPlan && 'md:grid-cols-2',
        )}
      >
        <SectionBlock title="Current Plan">
          <BillingRow label="Billing Cycle" value={plan.isAnnual ? 'Annual' : 'Monthly'} />
          {plan.deviceRate != null && (
            <BillingRow label="Device Rate" value={<MonthlyRate amount={plan.deviceRate} />} />
          )}
          {!flags.isTrial && nextPaymentAmount > 0 && (
            <BillingRow label="Next Payment" value={formatCurrency(nextPaymentAmount)} />
          )}
          {/* Independent rows, not one slot fought over by several dates: each is
              present exactly when its own field is (see `useBillingSummary`). A
              plan that is ending still has a billing date, and Figma shows both —
              they land on the same day because the subscription runs to the end
              of the paid period and stops there, which is two facts, not one
              repeated. A trial has no `currentPeriodEnd`, so its row simply never
              appears beside "Trial ends on". */}
          {billing.nextBillingDate && (
            <BillingRow label="Next Billing Date" value={formatDateOrDash(billing.nextBillingDate)} />
          )}
          {billing.cancellationEffectiveAt && (
            <BillingRow label="Plan ends on" warning value={<WarningDate iso={billing.cancellationEffectiveAt} />} />
          )}
          {billing.currentPlanEndsOn && (
            <BillingRow label="Plan ends on" warning value={<WarningDate iso={billing.currentPlanEndsOn} />} />
          )}
          {flags.isTrial && billing.trialExpirationDate && (
            <BillingRow label="Trial ends on" warning value={<WarningDate iso={billing.trialExpirationDate} />} />
          )}
        </SectionBlock>

        {flags.hasPendingPlan && (
          <SectionBlock title="Updated Plan">
            <BillingRow label="Billing Cycle" value={updatedPlan.isAnnual ? 'Annual' : 'Monthly'} />
            {updatedPlan.deviceRate != null && (
              <BillingRow label="Device Rate" value={<MonthlyRate amount={updatedPlan.deviceRate} />} />
            )}
            {updatedPlan.startsOn && (
              <BillingRow label="Plan Starts on" warning value={<WarningDate iso={updatedPlan.startsOn} />} />
            )}
          </SectionBlock>
        )}
      </div>

      <InvoicesHistory invoices={data.subscription?.pendingInvoices ?? []} />

      <UpgradePlanModal
        isOpen={planModalOpen}
        needsCheckout={needsCheckout}
        onClose={() => setPlanModalOpen(false)}
        onUpdated={() => {
          setPlanModalOpen(false);
          setRefreshKey(k => k + 1);
        }}
      />

      <CancelSubscriptionModal
        isOpen={cancelStep === 'reason'}
        // Still ACTIVE while this modal is open, so the paid period's end is the
        // date to preview against; the live effective date comes from the modal's
        // own query once it lands.
        endDate={billing.nextBillingDate}
        isStatsLoading={isImpactLoading}
        stats={
          impact
            ? {
                activeDevices: device.active,
                tickets: impact.tickets,
                kbArticles: impact.kbArticles,
                scripts: impact.scripts,
                monitoringPolicies: impact.monitoringPolicies,
                savedQueries: impact.savedQueries,
              }
            : undefined
        }
        onClose={() => setCancelStep('idle')}
        onConfirm={(reason, comment) => {
          setCancelReason(reason);
          setCancelComment(comment);
          setCancelStep('offer');
        }}
      />

      <CancelOfferModal
        isOpen={cancelStep === 'offer'}
        reason={cancelReason}
        isPending={cancelSubscription.isPending}
        onClose={() => setCancelStep('idle')}
        // "Find a Plan that Fits" — the plan picker is right here now, so the
        // offer hands off to it instead of sending the user to another page.
        onCtaClick={() => {
          setCancelStep('idle');
          setPlanModalOpen(true);
        }}
        onConfirm={() => {
          cancelSubscription.mutate({
            reason: cancelReason ?? undefined,
            description: cancelComment || undefined,
            onSuccess: () => {
              setCancelStep('cancelled');
              // Force the mounted billing query to re-request now that the store
              // was invalidated, so the page reflects the pending-cancellation state.
              setRefreshKey(k => k + 1);
            },
          });
        }}
      />

      <SubscriptionCancelledModal
        isOpen={cancelStep === 'cancelled'}
        // Populated once the successful cancel invalidates the store and the
        // query refetches. Null until then, and the modal renders that as an
        // em dash rather than borrowing another field's date.
        endDate={billing.cancellationEffectiveAt}
        onClose={() => setCancelStep('idle')}
      />
    </PageLayout>
  );
}

const billingUsageContentQuery = graphql`
  query billingUsageContentQuery {
    subscription {
      id
      status
      currentPeriodEnd
      cancellationEffectiveAt
      trialExpirationDate
      products {
        name
        packageOptions {
          id
          billingPeriod
          quantity
          price
          status
          startDate
          endDate
        }
        payAsYouGoOption {
          id
          price
        }
      }
      pendingInvoices {
        id
        invoiceNumber
        status
        hostedInvoiceUrl
        amountDue
        createdAt
        dueDate
      }
      usage {
        devicesUsed
        activeDevices
        aiTokensUsed
      }
      currentInvoice {
        estimatedOverage
      }
      # Projected next-invoice total, computed server-side (PAYG overage accrued
      # so far + package charges due next cycle). This is the SSOT for the
      # "Next Payment" row — the UI no longer re-derives it from product prices.
      nextPayment
    }
  }
`;

interface DeviceUsageCaptionProps {
  isTrial: boolean;
  trialEndsOn: string | null;
  /** A committed package backs the count — the same condition that gives it a denominator. */
  prepaid: boolean;
  isAnnual: boolean;
}

/**
 * The line under the device count: what the count is measured against, or how it
 * is billed.
 *
 * A trial is neither — its count has no allocation to sit against (which is why
 * the figure above is bare), so the line answers the question a trial actually
 * raises: when it runs out. Without a `trialExpirationDate` from the server
 * there is nothing to date it with, and nothing here invents one; the line falls
 * back to stating the trial, not to another date.
 */
function DeviceUsageCaption({ isTrial, trialEndsOn, prepaid, isAnnual }: DeviceUsageCaptionProps) {
  if (isTrial) {
    if (!trialEndsOn) return <>Included in trial</>;
    return (
      <>
        Trial Period ends <StatEmphasis>{formatDateOrDash(trialEndsOn)}</StatEmphasis>
      </>
    );
  }
  if (prepaid) return <>{isAnnual ? 'Annual Prepaid' : 'Monthly Prepaid'}</>;
  return <>Pay as you go</>;
}

/** A per-device price with its cadence trailing in secondary text. */
function MonthlyRate({ amount }: { amount: number }) {
  return (
    <>
      {formatCurrency(amount)}
      <span className="text-ods-text-secondary">/ month</span>
    </>
  );
}

/** A date the user should notice: something starts or stops on it. */
function WarningDate({ iso }: { iso: string }) {
  return (
    <>
      {formatDateOrDash(iso)}
      <AlertTriangleIcon className="size-4 text-ods-warning" />
    </>
  );
}
