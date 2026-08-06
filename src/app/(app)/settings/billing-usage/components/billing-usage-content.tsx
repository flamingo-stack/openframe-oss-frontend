'use client';

import {
  AlertTriangleIcon,
  ExternalLinkIcon,
  InfoCircleIcon,
  PlusCircleIcon,
  Settings02Icon,
  TagPercentIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
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
import { TOKENS_PER_MILLION } from '../hooks/use-ai-spend-limit';
import { useBillingPortalSession } from '../hooks/use-billing-portal-session';
import { useBillingSummary } from '../hooks/use-billing-summary';
import { useCancelSubscription } from '../hooks/use-cancel-subscription';
import { useCancellationImpact } from '../hooks/use-cancellation-impact';
import { useResumeSubscription } from '../hooks/use-resume-subscription';
import { formatCompactCount, formatCount, formatCurrency, formatDateOrDash } from '../lib/format';
import { AiTokensLimitModal } from './ai-tokens-limit-modal';
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
  const [aiLimitModalOpen, setAiLimitModalOpen] = useState(false);
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

  /**
   * The header carries at most one of these two, and the menu carries the other
   * — never both in both places. Repeating an action in the overflow menu that
   * is already a button beside it makes the menu read as a different, second
   * thing to do.
   *
   * The AI limit wins the header whenever one is set: it is the thing most
   * likely to be in the user's way, and the only one of the two a paused
   * assistant depends on. The plan gets the header only when there is something
   * to move UP to — a monthly plan has the annual one; an annual plan has
   * nothing above it, so its plan change (really a device-count change) belongs
   * in the menu.
   */
  const aiLimitInHeader = flags.hasAi && ai.capUsd != null;
  /**
   * A scheduled cancellation drops the plan offer everywhere. The subscription
   * is already on its way out, so a change would be bought into something that
   * ends anyway; renewing is the move that makes the rest meaningful again.
   */
  const planOffered = !flags.isPendingCancellation;
  const planInHeader = planOffered && !aiLimitInHeader && !plan.isAnnual;

  const menuActions: ActionsMenuGroup[] = [
    {
      items: [
        // Only when the header does not already offer it — which is exactly when
        // there is no limit yet, hence the label.
        ...(flags.hasAi && !aiLimitInHeader
          ? [
              {
                id: 'ai-limit',
                label: 'Set AI Limit',
                icon: <Settings02Icon className="w-6 h-6 text-ods-text-secondary" />,
                onClick: () => setAiLimitModalOpen(true),
              },
            ]
          : []),
        ...(planOffered && !planInHeader
          ? [
              {
                id: 'change-plan',
                label: 'Change Plan',
                icon: <TagPercentIcon className="w-6 h-6 text-ods-text-secondary" />,
                onClick: () => setPlanModalOpen(true),
              },
            ]
          : []),
        {
          id: 'customer-portal',
          // Stripe mints the portal session per click, so this runs a mutation
          // and then navigates — there is no stable URL to hang a link on.
          label: 'Customer Portal',
          icon: <ExternalLinkIcon className="w-6 h-6 text-ods-text-secondary" />,
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

  /** The header's second, quieter action — see `aiLimitInHeader` for which one and why. */
  const secondaryAction = aiLimitInHeader
    ? {
        label: 'Expand AI Limit',
        // Secondary, like the menu's icons: the label carries the action, and a
        // white glyph beside a white label reads as two emphases in one button.
        icon: <PlusCircleIcon className="w-6 h-6 text-ods-text-secondary" />,
        onClick: () => setAiLimitModalOpen(true),
        variant: 'outline' as const,
      }
    : planInHeader
      ? {
          // Named for what it does: the only plan above a monthly one is the
          // annual one. Changing the device count is not an upgrade and is
          // offered as "Change Plan" in the menu instead.
          label: 'Upgrade to Annual Plan',
          onClick: () => setPlanModalOpen(true),
          variant: 'outline' as const,
        }
      : null;

  /** Rightmost is the accent one: the status action, when there is something to settle. */
  const actions = [...(secondaryAction ? [secondaryAction] : []), ...(statusAction ? [statusAction] : [])];

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
        {/* Two counters, because AI is metered in two parts: what the period
            gives away, and what is billed past it. Both are server figures — the
            free grant and the tokens beyond it come from `usage`, and the paid
            counter's denominator is the customer's own cap converted at the
            metered rate. With no cap it has none, and none is invented. */}
        {flags.hasAi && (
          <>
            <UsageStatCard
              title="Free AI Tokens"
              value={
                <>
                  {formatCompactCount(ai.freeUsed)}
                  <StatSuffix>/{formatCompactCount(ai.free)}</StatSuffix>
                </>
              }
              caption="Updated monthly"
            />
            <UsageStatCard
              title="Paid AI Tokens"
              tone={ai.tone}
              value={
                <>
                  {formatCompactCount(ai.paid)}
                  {ai.capTokens != null && <StatSuffix>/{formatCompactCount(ai.capTokens)}</StatSuffix>}
                </>
              }
              caption={
                <>
                  <StatEmphasis>{formatCurrency(ai.spendUsd)}</StatEmphasis> on next invoice
                </>
              }
            />
          </>
        )}
      </div>

      {/* The cap the user set is being reached, so AI is about to stop — or has.
          Only the icon carries the colour: the card above already states the
          figure in full, and this block is the sentence explaining it.

          The fix is in the header, where the primary button becomes "Expand AI
          Limit" for exactly these two states. */}
      {ai.tone !== 'default' && ai.capUsd != null && (
        <div className="flex items-start gap-[var(--spacing-system-m)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-m)]">
          <AlertTriangleIcon
            className={cn('size-6 shrink-0', ai.tone === 'error' ? 'text-ods-error' : 'text-ods-warning')}
          />
          <div className="flex min-w-0 flex-col">
            <p className="text-h3 font-bold text-ods-text-primary">
              {ai.capReached ? 'AI agents are paused.' : 'AI agents will pause soon.'}
            </p>
            <p className="text-h4 text-ods-text-secondary">
              {ai.capReached
                ? `You've reached your ${formatCurrency(ai.capUsd)} monthly AI limit. Mingo and Fae stay paused until you raise it.`
                : `You've used ${formatCurrency(ai.spendUsd)} of your ${formatCurrency(ai.capUsd)} monthly AI limit. Mingo and Fae stop responding when it's reached.`}
              {/* Only when the period has a known end — the reset date is that
                  date, not a separate fact this can guess at. */}
              {billing.nextBillingDate && ` Free tokens reset on ${formatDateOrDash(billing.nextBillingDate)}.`}
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
              <p className="text-h3 font-bold text-ods-text-primary">You're over your device package limit</p>
              <p className="text-h4 text-ods-text-secondary">
                Extra devices will be billed at pay-as-you-go rates, charged separately from your plan.
              </p>
            </div>
            <Button variant="accent" onClick={() => setPlanModalOpen(true)}>
              Upgrade Plan
            </Button>
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
          the plan it is changing to, or what its metered AI is costing. On its
          own, Current Plan takes the full width. */}
      <div
        className={cn(
          'grid grid-cols-1 gap-[var(--spacing-system-l)] items-start',
          (flags.hasPendingPlan || ai.paid > 0) && 'md:grid-cols-2',
        )}
      >
        <SectionBlock title="Current Plan">
          <BillingRow label="Billing Cycle" value={plan.isAnnual ? 'Annual' : 'Monthly'} />
          {plan.deviceRate != null && (
            <BillingRow label="Device Rate" value={<MonthlyRate amount={plan.deviceRate} />} />
          )}
          {ai.tokenPrice != null && (
            <BillingRow label="AI Tokens Rate" value={<TokenRate amount={ai.tokenPrice * TOKENS_PER_MILLION} />} />
          )}
          {/* The grant the tenant is actually on this period, served by the
              backend — unlike the Updated Plan's, which has to be derived. */}
          {flags.hasAi && <BillingRow label="Free AI Tokens" value={<MonthlyTokens tokens={ai.free} />} />}
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

        {/* The plan that takes over — a scheduled package, or the metered
            billing a lapsing commitment falls back to. It answers the left
            column's questions in the left column's order, so the two read as one
            comparison; the AI rate is the same either way and is stated on both
            sides rather than left to be assumed unchanged. */}
        {flags.hasPendingPlan && (
          <SectionBlock title="Updated Plan">
            <BillingRow label="Billing Cycle" value={updatedPlan.isAnnual ? 'Annual' : 'Monthly'} />
            {updatedPlan.deviceRate != null && (
              <BillingRow label="Device Rate" value={<MonthlyRate amount={updatedPlan.deviceRate} />} />
            )}
            {ai.tokenPrice != null && (
              <BillingRow label="AI Tokens Rate" value={<TokenRate amount={ai.tokenPrice * TOKENS_PER_MILLION} />} />
            )}
            {flags.hasAi && (
              <BillingRow label="Free AI Tokens" value={<MonthlyTokens tokens={updatedPlan.freeTokens} />} />
            )}
            {updatedPlan.startsOn && (
              <BillingRow label="Plan Starts on" warning value={<WarningDate iso={updatedPlan.startsOn} />} />
            )}
          </SectionBlock>
        )}

        {/* Metered AI, once any of it has actually been billed. Beside the plan
            rather than under the cards: it is the plan's fine print — what the
            surplus costs, what ceiling it is running into, and when the meter
            resets — and the top card states only the count. */}
        {ai.paid > 0 && (
          <SectionBlock title="AI Usage Beyond Free Tokens">
            <div className="flex items-start gap-[var(--spacing-system-xsf)] pb-[var(--spacing-system-xsf)]">
              <InfoCircleIcon className="size-6 shrink-0 text-ods-accent" />
              <p className="text-h4 text-ods-text-primary">
                Extra token usage continues at pay-as-you-go rates and appears on your next invoice.
              </p>
            </div>
            <BillingRow label="Token Overage" value={formatCompactCount(ai.paid)} />
            <BillingRow label="Overage Payment" value={formatCurrency(ai.spendUsd)} />
            {/* Stated in both units, because the limit is chosen in tokens and
                charged in dollars — see the AI Tokens Limit modal. */}
            {ai.capUsd != null && (
              <BillingRow
                label="Spending Limit"
                value={
                  <>
                    {ai.capTokens != null && formatCompactCount(ai.capTokens)}
                    <span className="text-ods-text-secondary">({formatCurrency(ai.capUsd)})</span>
                  </>
                }
              />
            )}
            {billing.nextBillingDate && (
              <BillingRow label="Next Billing" value={formatDateOrDash(billing.nextBillingDate)} />
            )}
          </SectionBlock>
        )}
      </div>

      <InvoicesHistory invoices={data.subscription?.pendingInvoices ?? []} />

      {/* Writes through `updateAiSpendCap`, whose response carries the new cap
          into the same subscription record this page reads — so nothing here
          refetches when it saves. */}
      <AiTokensLimitModal
        isOpen={aiLimitModalOpen}
        onClose={() => setAiLimitModalOpen(false)}
        tokenPrice={ai.tokenPrice}
        capUsd={ai.capUsd}
      />

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
          priceTiers { from upTo unitPrice }
        }
        payAsYouGoOption {
          id
          price
          priceTiers { from upTo unitPrice }
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
        # how much of it is gone, then the tokens billed past it and what they
        # have cost so far. aiSpendUsd is what aiSpendCapUsd is measured against
        # — the page compares those two and nothing else.
        aiTokensFree
        aiTokensFreeUsed
        aiTokensOverage
        aiSpendUsd
      }
      # Customer-set ceiling on the AI overage one period may accrue, in USD.
      # Null means uncapped; 0 is a real cap.
      aiSpendCapUsd
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

/**
 * The AI rate, per million tokens — the unit every AI figure on this page is
 * stated in. The catalog quotes it per token (see `lib/ai-token-price.ts`).
 */
function TokenRate({ amount }: { amount: number }) {
  return (
    <>
      {formatCurrency(amount)}
      <span className="text-ods-text-secondary">/ 1M tokens</span>
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
      <p className="text-h4 text-ods-text-primary">{value}</p>
      <p className="text-h6 text-ods-text-secondary">{label}</p>
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
