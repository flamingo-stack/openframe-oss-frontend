'use client';

import { AlertTriangleIcon, ExternalLinkIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { type ActionsMenuGroup, PageLayout } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { billingUsageContentQuery as BillingUsageContentQueryType } from '@/__generated__/billingUsageContentQuery.graphql';
import { SubscriptionStatus } from '@/app/components/subscription-lock/subscription-status';
import { useFeatureFlag } from '@/app/hooks/use-feature-flag';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { routes } from '@/lib/routes';
import { useBillingPortalSession } from '../hooks/use-billing-portal-session';
import { useBillingSummary } from '../hooks/use-billing-summary';
import { useCancelSubscription } from '../hooks/use-cancel-subscription';
import { useCancellationImpact } from '../hooks/use-cancellation-impact';
import { useResumeSubscription } from '../hooks/use-resume-subscription';
import { formatCompactCount, formatCount, formatCurrency, formatDateOrDash } from '../lib/format';
import { BillingRow, SectionBlock, TestModeBanner } from './billing-section';
import { CancelOfferModal } from './cancel-offer-modal';
import { type CancelReason, CancelSubscriptionModal } from './cancel-subscription-modal';
import { InvoicesHistory } from './invoices-history';
import { SubscriptionCancelledModal } from './subscription-cancelled-modal';
import { TestClockPanel } from './test-clock-panel';
import { UpgradePlanModal } from './upgrade-plan-modal';
import { StatSuffix, UsageStatCard } from './usage-stat-card';

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

  const { status, flags, device, ai, plan, ui, billing, updatedPlan } = useBillingSummary(data.subscription);
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
  const devicePlanCaption = flags.isTrial
    ? 'Included in trial'
    : devicePrepaid
      ? plan.isAnnual
        ? 'Annual Prepaid'
        : 'Monthly Prepaid'
      : 'Pay as you go';

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

  // Rightmost is the accent one: the status action when there is one.
  const actions = statusAction ? [upgradeAction, statusAction] : [upgradeAction];

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

      <div className={cn('grid gap-[var(--spacing-system-m)]', flags.hasAi ? 'md:grid-cols-3' : 'md:grid-cols-1')}>
        <UsageStatCard
          title="Device Usage"
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
          caption={devicePlanCaption}
        />
        {flags.hasAi && (
          <>
            {/* What is LEFT of the allowance, not what was spent — the card is
                labelled with the tokens themselves, so the figure has to be the
                ones still available. */}
            <UsageStatCard
              title="Free AI Tokens"
              value={
                <>
                  {formatCompactCount(ai.freeRemaining)}
                  <StatSuffix>/{formatCompactCount(ai.freeAllowance)}</StatSuffix>
                </>
              }
              caption="Updated monthly"
            />
            {/* Plain consumption for the period. Where the design put a purchased
                balance, the product meters instead — so this counts tokens spent,
                not tokens held. */}
            <UsageStatCard title="AI Usage" value={formatCount(ai.used)} caption="Pay as you go" />
          </>
        )}
      </div>

      {(ui.warnings.length > 0 || ui.showOverageBlock) && (
        <div className={cn('flex flex-col rounded-md border overflow-hidden bg-ods-card', ui.accentBorderClass)}>
          {ui.warnings.map((w, idx) => (
            <div
              key={w.title}
              className={cn(
                'flex gap-[var(--spacing-system-m)] p-[var(--spacing-system-m)] items-start',
                idx > 0 && cn('border-t', ui.accentBorderClass),
              )}
            >
              <AlertTriangleIcon className={cn('size-6 shrink-0', ui.accentClass)} />
              <div className="flex flex-col gap-1">
                <p className={cn('text-h3 font-bold', ui.accentClass)}>{w.title}</p>
                <p className={cn('text-h4', ui.accentClass)}>{w.description}</p>
              </div>
            </div>
          ))}
          {ui.showOverageBlock && (
            <div
              className={cn(
                'flex flex-col gap-[var(--spacing-system-m)] p-[var(--spacing-system-m)]',
                ui.warnings.length > 0 && cn('border-t', ui.accentBorderClass),
              )}
            >
              <BillingRow label="Device Overage" value={formatCount(device.overage)} />
            </div>
          )}
        </div>
      )}

      <SectionBlock title="Current Plan">
        <BillingRow label="Billing Cycle" value={plan.isAnnual ? 'Annual' : 'Monthly'} />
        {plan.deviceRate != null && (
          <BillingRow
            label="Device Rate"
            value={
              <>
                {formatCurrency(plan.deviceRate)}
                <span className="text-ods-text-secondary">/ month</span>
              </>
            }
          />
        )}
        {flags.hasAi && (
          <BillingRow
            label="Free AI Tokens"
            value={
              <>
                {formatCompactCount(ai.freeAllowance)}
                <span className="text-ods-text-secondary">/ month</span>
              </>
            }
          />
        )}
        {!flags.isTrial && nextPaymentAmount > 0 && (
          <BillingRow label="Next Payment" value={formatCurrency(nextPaymentAmount)} />
        )}
        {flags.isPendingCancellation ? (
          <BillingRow
            label="Plan ends on"
            warning
            value={
              <>
                {formatDateOrDash(billing.nextBilling)}
                <AlertTriangleIcon className="size-4 text-ods-warning" />
              </>
            }
          />
        ) : flags.isTrial ? (
          <BillingRow
            label="Trial ends on"
            warning
            value={
              <>
                {formatDateOrDash(billing.trialExpirationDate)}
                <AlertTriangleIcon className="size-4 text-ods-warning" />
              </>
            }
          />
        ) : (
          <BillingRow label="Next Billing Date" value={formatDateOrDash(billing.nextBilling)} />
        )}
      </SectionBlock>

      {flags.hasPendingPlan && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--spacing-system-l)] items-start">
          <SectionBlock title="Updated Plan">
            <BillingRow label="Device Package" value={formatCount(updatedPlan.deviceQuantity)} />
            <BillingRow
              label="Plan Starts on"
              warning
              value={
                <>
                  {formatDateOrDash(updatedPlan.startDate)}
                  <AlertTriangleIcon className="size-4 text-ods-warning" />
                </>
              }
            />
          </SectionBlock>
        </div>
      )}

      <InvoicesHistory invoices={data.subscription?.pendingInvoices ?? []} />

      <UpgradePlanModal isOpen={planModalOpen} needsCheckout={needsCheckout} onClose={() => setPlanModalOpen(false)} />

      <CancelSubscriptionModal
        isOpen={cancelStep === 'reason'}
        endDate={billing.nextBilling}
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
        // After the successful cancel invalidates the store and the query
        // refetches, cancellationEffectiveAt is populated; fall back to the
        // period end until that lands.
        endDate={billing.cancellationEffectiveAt ?? billing.nextBilling}
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
        currency
        createdAt
        dueDate
      }
      usage {
        devicesUsed
        activeDevices
        inactiveDevices
        aiTokensUsed
      }
      # Projected next-invoice total, computed server-side (PAYG overage accrued
      # so far + package charges due next cycle). This is the SSOT for the
      # "Next Payment" row — the UI no longer re-derives it from product prices.
      nextPayment
    }
  }
`;
