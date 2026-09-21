'use client';

import {
  AlertTriangleIcon,
  ExternalLinkIcon,
  InfoCircleIcon,
  Refresh02VrIcon,
  TagPercentIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { type ActionsMenuGroup, Button, PageLayout } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useApiParams } from '@flamingo-stack/openframe-frontend-core/hooks';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { useState } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { billingUsageContentQuery as BillingUsageContentQueryType } from '@/__generated__/billingUsageContentQuery.graphql';
import { LockedScreen } from '@/app/components/shared/locked-screen';
import { resolveSubscriptionStatus, SubscriptionStatus } from '@/app/components/subscription-lock/subscription-status';
import { useFeatureFlag } from '@/app/hooks/use-feature-flag';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { isBillingReadOnly, openBillingInBrowser } from '@/lib/billing-visibility';
import { MANAGE_AI_BALANCE_ACTION, routes } from '@/lib/routes';
import { useBillingPortalSession } from '../hooks/use-billing-portal-session';
import { type AiAlert, useBillingSummary } from '../hooks/use-billing-summary';
import { useCancelSubscription } from '../hooks/use-cancel-subscription';
import { useCancellationImpact } from '../hooks/use-cancellation-impact';
import { useResumeSubscription } from '../hooks/use-resume-subscription';
import { AUTO_TOP_UP } from '../lib/auto-top-up';
import { formatCompactCount, formatCount, formatCurrency, formatDateOrDash } from '../lib/format';
import { openExternalTab } from '../lib/stripe-window';
import { ActivateSubscriptionModal } from '../subscription/components/activate-subscription-modal';
import { ModelTokenRatesPopover } from '../subscription/components/model-token-rates';
import { BillingRow, SectionBlock, TestModeBanner } from './billing-section';
import { CancelOfferModal } from './cancel-offer-modal';
import { type CancelReason, CancelSubscriptionModal } from './cancel-subscription-modal';
import { InvoicesHistory } from './invoices-history';
import { ManageAiBalanceModal } from './manage-ai-balance-modal';
import { SubscriptionCancelledModal } from './subscription-cancelled-modal';
import { TestClockPanel } from './test-clock-panel';
import { UpgradePlanModal } from './upgrade-plan-modal';
import { StatEmphasis, StatSuffix, UsageStatCard } from './usage-stat-card';

const billingUsageContentQuery = graphql`
  query billingUsageContentQuery {
    # The catalog, for the two things the subscription does not state itself:
    #
    #  - what a price is quoted per. AI is priced by the block of tokens, so
    #    without unitSize the metered rate cannot be turned into a per-token one
    #    (see lib/ai-token-price.ts).
    #  - what a billing period costs per device. A committed option on the
    #    subscription leaves its own price empty, and this is where the plan
    #    picker has always read the rate from (see useDevicePlanSelection).
    billingPlan {
      id
      products {
        id
        name
        unitSize
        # The same two fields on both, so one helper can read either: an option
        # states its rate as a flat price or as a price band, and which one is
        # filled depends on the option (see catalogDeviceRate).
        packageOptions {
          id
          billingPeriod
          price
          priceTiers {
            from
            upTo
            unitPrice
          }
        }
        payAsYouGoOption {
          id
          price
          priceTiers {
            from
            upTo
            unitPrice
          }
        }
      }
    }
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
          # Empty on a committed option, which is why the rate is read from the
          # catalog above. Kept because a negotiated rate, if one is ever stated
          # here, is what this tenant actually pays and must win.
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
        # The AI counters the top row is built from: the period's free grant and
        # how much of it is gone, then the prepaid balance AI draws from once
        # the grant is spent — in tokens, and what those are worth.
        aiTokensFree
        aiTokensFreeUsed
        purchasedTokensRemaining
        purchasedTokensRemainingUsd
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

/**
 * The block under the AI cards, by what it is about. Titles are the mockups'
 * verbatim; the reset date is appended by the page when the period has one.
 */
const AI_ALERT_COPY: Record<NonNullable<AiAlert>, { title: string; description: string }> = {
  'trial-exhausted': {
    title: 'AI agents are paused.',
    description: 'Activate your subscription to keep Mingo and Fae running.',
  },
  low: {
    title: 'AI agents will pause soon.',
    description: 'Your AI balance is running low. Mingo and Fae stop responding when it hits zero.',
  },
  empty: {
    title: 'AI agents are paused. Your AI balance is empty.',
    description: 'Mingo and Fae stopped responding until you top up.',
  },
};

export function BillingUsageContent() {
  const handleBack = useSafeBack(routes.settings.root());
  // The desktop build: every figure below renders, and nothing that changes one
  // does — the header's single action leaves for the web app instead (see
  // `billing-visibility.ts`).
  const readOnly = isBillingReadOnly();
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
  const [activateModalOpen, setActivateModalOpen] = useState(false);
  /**
   * The Manage AI Balance modal's open state IS the URL (`?action=`): the
   * app-wide balance bar deep-links to it from any page, and one owner of the
   * state is what keeps that link and the header button from disagreeing.
   * Closing clears the param, so a reload does not reopen a dismissed dialog.
   */
  const { params: pageParams, setParam: setPageParam } = useApiParams({ action: { type: 'string', default: '' } });
  const openAiBalanceModal = () => setPageParam('action', MANAGE_AI_BALANCE_ACTION);
  const closeAiBalanceModal = () => setPageParam('action', '');
  const [cancelStep, setCancelStep] = useState<'idle' | 'reason' | 'offer' | 'cancelled'>('idle');
  const [cancelReason, setCancelReason] = useState<CancelReason | null>(null);
  const [cancelComment, setCancelComment] = useState<string>('');

  const { status, flags, device, ai, plan, billing, updatedPlan } = useBillingSummary(
    data.subscription,
    data.billingPlan,
  );
  const { impact, isLoading: isImpactLoading } = useCancellationImpact({ enabled: cancelStep === 'reason' });

  // `Next Payment` comes straight from the backend's server-computed
  // `subscription.nextPayment` (projected next-invoice total). The row is
  // omitted when there's nothing to bill (null / 0) or while the user is on
  // an active trial — instead of rendering a "Free" placeholder.
  const nextPaymentAmount = billing.nextPayment ?? 0;
  const cancelSubscriptionEnabled = useFeatureFlag('cancel-subscription');

  // Nothing to update in place: these three states have no live paid
  // subscription, so the plan is STARTED, through Stripe Checkout — the
  // Activate Subscription modal, not the plan change. PAST_DUE and SUSPENDED
  // are deliberately NOT here — those subscriptions still exist.
  const needsCheckout =
    status === SubscriptionStatus.TRIAL ||
    status === SubscriptionStatus.TRIAL_EXPIRED ||
    status === SubscriptionStatus.CANCELED;

  /**
   * A trial has no balance to manage: its AI runs on the grant, and what a
   * paused assistant needs is the subscription, not a top-up. So the modal is
   * not offered — and not reachable through the URL either, which the app-wide
   * bar never writes on a trial. The read-only build buys nothing at all, so
   * the same `?action=` must not open a purchase there.
   */
  const aiBalanceOffered = flags.hasAi && !flags.isTrial && !readOnly;
  const aiBalanceModalOpen = aiBalanceOffered && pageParams.action === MANAGE_AI_BALANCE_ACTION;

  // A committed package is the only thing that gives the device counter a
  // denominator, so the same condition decides the caption — the card cannot end
  // up reading "247/300" over "Pay as you go", or a bare count over "Prepaid".
  const devicePrepaid = !flags.isTrial && device.allocation > 0;

  /**
   * A scheduled cancellation drops the plan offer everywhere. The subscription
   * is already on its way out, so a change would be bought into something that
   * ends anyway; renewing is the move that makes the rest meaningful again.
   * Nor is there a plan to change before one has been bought: on a trial the
   * header's Activate Subscription is the whole offer.
   */
  const planOffered = !flags.isPendingCancellation && !needsCheckout;

  const menuActions: ActionsMenuGroup[] = [
    {
      items: [
        // The plan change lives in the menu whatever the plan: the header's
        // quieter slot is the AI balance, which is the thing most likely to be
        // in the user's way (see `secondaryAction`).
        ...(planOffered
          ? [
              {
                id: 'change-plan',
                label: 'Change Plan',
                icon: <TagPercentIcon className="h-6 w-6 text-ods-text-secondary" />,
                onClick: () => setPlanModalOpen(true),
              },
            ]
          : []),
        {
          id: 'customer-portal',
          // Stripe mints the portal session per click, so this runs a mutation
          // and then navigates — there is no stable URL to hang a link on.
          label: 'Customer Portal',
          icon: <ExternalLinkIcon className="h-6 w-6 text-ods-text-secondary" />,
          onClick: () => billingPortal.mutate(),
          disabled: billingPortal.isPending,
        },
        ...(status === SubscriptionStatus.ACTIVE && cancelSubscriptionEnabled
          ? [
              {
                id: 'cancel-subscription',
                label: 'Cancel Subscription',
                icon: <AlertTriangleIcon className="h-6 w-6 text-ods-error" />,
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
   * There is no plan page to send anyone to any more: a live plan is changed in
   * the Upgrade Plan modal, and a trial is turned into a subscription in the
   * Activate Subscription modal — the paywall's form, which buys the whole plan
   * (devices, the AI product and the first top-up) on one checkout.
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
              // Stripe hosts the invoice; this page stays where it is behind it.
              openExternalTab(billing.latestPendingInvoice.hostedInvoiceUrl);
            } else {
              setPlanModalOpen(true);
            }
          },
          variant: 'accent' as const,
        }
      : flags.isTrial
        ? {
            label: 'Activate Subscription',
            onClick: () => setActivateModalOpen(true),
            variant: 'accent' as const,
          }
        : null;

  /**
   * The header's second, quieter action: the balance, not the plan. It is the
   * one of the two a paused assistant depends on, and it is what the app-wide
   * balance bar deep-links to. Absent without the AI product — there is no
   * balance to manage — and on a trial, where Activate Subscription stands alone.
   */
  const secondaryAction = aiBalanceOffered
    ? {
        label: 'Manage AI Balance',
        onClick: openAiBalanceModal,
        variant: 'outline' as const,
      }
    : null;

  /** Rightmost is the accent one: the status action, when there is something to settle. */
  const actions = readOnly
    ? [
        {
          label: 'Manage Billing',
          icon: <ExternalLinkIcon className="h-6 w-6" />,
          onClick: openBillingInBrowser,
          variant: 'accent' as const,
        },
      ]
    : [...(secondaryAction ? [secondaryAction] : []), ...(statusAction ? [statusAction] : [])];

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
      menuActions={readOnly ? [] : menuActions}
    >
      {/* Said out loud, because a billing page with no way to change anything
          otherwise reads as a broken build. */}
      {readOnly && (
        <div className="flex items-center gap-[var(--spacing-system-xsf)]">
          <InfoCircleIcon className="size-6 shrink-0 text-ods-accent" />
          <p className="text-ods-text-secondary text-h4">
            Billing and payments are managed in the browser. Manage Billing opens your workspace's billing page there.
          </p>
        </div>
      )}

      {/* Dev-only; renders nothing (and issues no requests) unless the test-clock env flag is on. */}
      <TestClockPanel onClockChanged={() => setRefreshKey(k => k + 1)} />

      <TestModeBanner />

      <div className={cn('grid gap-[var(--spacing-system-m)]', flags.hasAi ? 'md:grid-cols-3' : 'md:grid-cols-1')}>
        <UsageStatCard
          title="Device Usage"
          tone={device.overLimit ? 'warning' : 'default'}
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
        {/* Two counters, because AI runs on two figures: what the period gives
            away, and the balance it draws from once that is spent. Both are
            server figures from `usage`; the paid card's colour is the balance's
            state, the free card's is a trial's (which has no balance to colour). */}
        {flags.hasAi && (
          <>
            <UsageStatCard
              title="Free AI Tokens"
              tone={ai.freeTone}
              value={
                <>
                  {formatCompactCount(ai.freeUsed)}
                  <StatSuffix>/{formatCompactCount(ai.free)}</StatSuffix>
                </>
              }
              caption={flags.isTrial ? 'Included with trial' : 'Updated monthly'}
            />
            <UsageStatCard
              title="Paid AI Tokens"
              tone={ai.paidTone}
              value={
                <>
                  {formatCompactCount(ai.paid)}
                  {/* The mockup's mark for a balance that refills itself; the
                      popover beside it spells the same state out in words. */}
                  {AUTO_TOP_UP.enabled && (
                    <Refresh02VrIcon
                      role="img"
                      aria-label="Auto top-up enabled"
                      className="ml-[var(--spacing-system-xsf)] inline-block size-6 align-middle text-ods-success"
                    />
                  )}
                </>
              }
              caption={
                <>
                  <StatEmphasis>{formatCurrency(ai.paidUsd)}</StatEmphasis> balance
                </>
              }
              trailing={<ModelTokenRatesPopover autoTopUp={AUTO_TOP_UP} />}
            />
          </>
        )}
      </div>

      {/* The one sentence the page owes about AI right now: the balance is
          running low, it is empty, or a trial has spent its grant. Only the icon
          carries the colour — the card above already states the figure in full,
          and this block is the sentence explaining it. The fix is in the header:
          Manage AI Balance, or Activate Subscription on a trial. */}
      {ai.alert && (
        <div className="flex items-center gap-[var(--spacing-system-m)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-m)]">
          <AlertTriangleIcon
            className={cn('size-6 shrink-0', ai.alert === 'empty' ? 'text-ods-error' : 'text-ods-warning')}
          />
          <div className="flex min-w-0 flex-col">
            <p className="font-bold text-ods-text-primary text-h3">{AI_ALERT_COPY[ai.alert].title}</p>
            <p className="text-ods-text-secondary text-h4">
              {AI_ALERT_COPY[ai.alert].description}
              {/* Only when the period has a known end — the reset date is that
                  date, not a separate fact this can guess at. A trial resets
                  nothing: activation is what refills it. */}
              {ai.alert !== 'trial-exhausted' &&
                billing.nextBillingDate &&
                ` Free tokens reset on ${formatDateOrDash(billing.nextBillingDate)}.`}
            </p>
          </div>
        </div>
      )}

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
              <p className="font-bold text-ods-text-primary text-h3">You're over your device package limit</p>
              <p className="text-ods-text-secondary text-h4">
                Extra devices will be billed at pay-as-you-go rates, charged separately from your plan.
              </p>
            </div>
            {!readOnly && (
              <Button variant="accent" onClick={() => setPlanModalOpen(true)}>
                Upgrade Plan
              </Button>
            )}
          </div>
          {/* Figure over label, side by side — not the label-dash-value rows of
              the plan blocks below. These three are read together as the size of
              one problem, and a row layout buries each number at the end of its
              own line. */}
          <div className="flex flex-wrap gap-[var(--spacing-system-xl)] p-[var(--spacing-system-m)]">
            <OverageStat value={`${formatCount(device.overage)} Devices`} label="Device Overage" />
            {billing.estimatedOverage != null && (
              <OverageStat value={formatCurrency(billing.estimatedOverage)} label="Overage Payment" />
            )}
            {billing.nextBillingDate && (
              <OverageStat value={formatDateOrDash(billing.nextBillingDate)} label="Next Billing" />
            )}
          </div>
        </div>
      )}

      {/* Side by side once there is a second block to read against the plan —
          the plan it is changing to. On its own, Current Plan takes the full
          width. A trial has no plan to state: its one date is on the device
          card, and the header offers activation. */}
      {!flags.isTrial && (
        <div
          className={cn(
            'grid grid-cols-1 items-start gap-[var(--spacing-system-l)]',
            flags.hasPendingPlan && 'md:grid-cols-2',
          )}
        >
          <SectionBlock title="Current Plan">
            <BillingRow label="Billing Cycle" value={plan.isAnnual ? 'Annual' : 'Monthly'} />
            {plan.deviceRate != null && (
              <BillingRow label="Device Rate" value={<MonthlyRate amount={plan.deviceRate} />} />
            )}
            {/* The grant the tenant is actually on this period, served by the
                backend — unlike the Updated Plan's, which has to be derived. */}
            {flags.hasAi && <BillingRow label="Free AI Tokens" value={<MonthlyTokens tokens={ai.free} />} />}
            {nextPaymentAmount > 0 && <BillingRow label="Next Payment" value={formatCurrency(nextPaymentAmount)} />}
            {/* Independent rows, not one slot fought over by several dates: each is
                present exactly when its own field is (see `useBillingSummary`). A
                plan that is ending still has a billing date, and Figma shows both —
                they land on the same day because the subscription runs to the end
                of the paid period and stops there, which is two facts, not one
                repeated. */}
            {billing.nextBillingDate && (
              <BillingRow label="Next Billing Date" value={formatDateOrDash(billing.nextBillingDate)} />
            )}
            {billing.cancellationEffectiveAt && (
              <BillingRow label="Plan ends on" warning value={<WarningDate iso={billing.cancellationEffectiveAt} />} />
            )}
            {billing.currentPlanEndsOn && (
              <BillingRow label="Plan ends on" warning value={<WarningDate iso={billing.currentPlanEndsOn} />} />
            )}
          </SectionBlock>

          {/* The plan that takes over — a scheduled package, or the metered
              billing a lapsing commitment falls back to. It answers the left
              column's questions in the left column's order, so the two read as
              one comparison. */}
          {flags.hasPendingPlan && (
            <SectionBlock title="Updated Plan">
              <BillingRow label="Billing Cycle" value={updatedPlan.isAnnual ? 'Annual' : 'Monthly'} />
              {updatedPlan.deviceRate != null && (
                <BillingRow label="Device Rate" value={<MonthlyRate amount={updatedPlan.deviceRate} />} />
              )}
              {flags.hasAi && (
                <BillingRow label="Free AI Tokens" value={<MonthlyTokens tokens={updatedPlan.freeTokens} />} />
              )}
              {updatedPlan.startsOn && (
                <BillingRow label="Plan Starts on" warning value={<WarningDate iso={updatedPlan.startsOn} />} />
              )}
            </SectionBlock>
          )}
        </div>
      )}

      <InvoicesHistory invoices={data.subscription?.pendingInvoices ?? []} />

      {/* Raises an invoice and opens it; the balance moves once that is paid,
          which is when the page's next fetch reads it. Nothing to refetch here. */}
      <ManageAiBalanceModal isOpen={aiBalanceModalOpen} onClose={closeAiBalanceModal} tokenPrice={ai.tokenPrice} />

      <UpgradePlanModal
        isOpen={planModalOpen}
        onClose={() => setPlanModalOpen(false)}
        onUpdated={() => {
          setPlanModalOpen(false);
          setRefreshKey(k => k + 1);
        }}
      />

      {/* Leaves for Stripe in a new tab; the subscription it activates lands on
          the page's next fetch, not through this modal. */}
      <ActivateSubscriptionModal
        isOpen={activateModalOpen}
        // Narrowed from the widened Relay enum the page reads: the heading it
        // names is the trial's, and an unknown status falls back to the default.
        status={resolveSubscriptionStatus(status)}
        onClose={() => setActivateModalOpen(false)}
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
                kbFolders: impact.kbFolders,
                scripts: impact.scripts,
                activeSchedules: impact.activeSchedules,
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

/** A monthly token grant: the count, with its cadence trailing. */
function MonthlyTokens({ tokens }: { tokens: number }) {
  return (
    <>
      {formatCompactCount(tokens)}
      <span className="text-ods-text-secondary">/ month</span>
    </>
  );
}

/** One figure of an overage, stated above what it counts. */
function OverageStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col">
      <p className="text-ods-text-primary text-h4">{value}</p>
      <p className="text-ods-text-secondary text-h6">{label}</p>
    </div>
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
