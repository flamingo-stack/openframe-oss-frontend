'use client';

import { LoadingFallback } from '@flamingo-stack/openframe-frontend-core/components';
import { AlertTriangleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useApiParams } from '@flamingo-stack/openframe-frontend-core/hooks';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { Suspense, useState } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type {
  billingUsageContentQuery as BillingUsageContentQueryType,
  billingUsageContentQuery$data,
} from '@/__generated__/billingUsageContentQuery.graphql';
import { LockedScreen } from '@/app/components/shared/locked-screen';
import { resolveSubscriptionStatus, SubscriptionStatus } from '@/app/components/subscription-lock/subscription-status';
import { OpenframeProduct } from '@/generated/schema-enums';
import { isBillingReadOnly } from '@/lib/billing-visibility';
import { MANAGE_AI_BALANCE_ACTION } from '@/lib/routes';
import { AutoTopUpIsland } from '../ai-balance/auto-top-up-island';
import { AutoTopUpNotice } from '../ai-balance/auto-top-up-notice';
import { ManageAiBalanceModal } from '../ai-balance/manage-ai-balance-modal';
import { CancelSubscriptionFlow } from '../cancel/cancel-subscription-flow';
import { ActivateSubscriptionModal } from '../plan/activate-subscription-modal';
import { UpgradePlanModal } from '../plan/upgrade-plan-modal';
import { BillingReadOnlyNotice, TestModeBanner } from '../shared/billing-section';
import { TestClockPanel } from '../test-clock/test-clock-panel';
import { AiBalanceAlert } from './ai-balance-alert';
import { BillingPageFrame } from './billing-page-frame';
import { DeviceOverageBlock } from './device-overage-block';
import { DeviceUsageCard } from './device-usage-card';
import { FreeAiTokensCard } from './free-ai-tokens-card';
import { InvoicesHistory } from './invoices-history';
import { PaidAiTokensCard } from './paid-ai-tokens-card';
import { PlanSections } from './plan-sections';
import { useBillingPageActions } from './use-billing-page-actions';

/**
 * What the page decides its layout on, and a spread per part for everything a
 * part reads itself. A field only the page reads sits here; a field a card or
 * the header reads sits on that card or the header's hook, which is what lets
 * the unused-fields rule judge each file.
 */
const billingUsageContentQuery = graphql`
  query billingUsageContentQuery {
    billingPlan {
      id
      ...planSections_billingPlan
    }
    subscription {
      id
      status
      # Which products the plan carries decides the row of cards and whether
      # there is an AI balance to manage at all.
      products {
        name
      }
      ...useBillingPageActions_subscription
      ...deviceUsageCard_subscription
      ...freeAiTokensCard_subscription
      ...paidAiTokensCard_subscription
      ...aiBalanceAlert_subscription
      ...deviceOverageBlock_subscription
      ...planSections_subscription
      ...invoicesHistory_subscription
      ...cancelSubscriptionFlow_subscription
    }
  }
`;

const NO_REFETCH = () => {};

/**
 * The billing page. While anything it waits on has not answered (the page's flag and role gates: `loading`; the
 * query: the Suspense boundary), it is the same page drawn in a loading scope, where every part draws its own
 * skeleton.
 */
export function BillingUsageContent({ loading = false }: { loading?: boolean }) {
  const fallback = (
    <LoadingFallback label="Loading billing and usage">
      <BillingUsageScreen data={null} onRefetch={NO_REFETCH} />
    </LoadingFallback>
  );
  if (loading) return fallback;
  return (
    <Suspense fallback={fallback}>
      <BillingUsageQuery />
    </Suspense>
  );
}

/** The page's query; everything it draws is `BillingUsageScreen`'s. */
function BillingUsageQuery() {
  // Bumped after a change the store cannot reflect on its own: resume and cancel
  // answer with a bare Boolean, a plan change does not return the packages it
  // altered, and the test clock rewrites everything server-side.
  const [refreshKey, setRefreshKey] = useState(0);
  const data = useLazyLoadQuery<BillingUsageContentQueryType>(
    billingUsageContentQuery,
    {},
    {
      fetchPolicy: 'store-and-network',
      fetchKey: refreshKey,
      // PAST_DUE leaves this page open while the subscription gate stays shut
      // for the rest of the app — see `subscription-gate.ts`.
      networkCacheConfig: { metadata: { skipSubscriptionGate: true } },
    },
  );
  return <BillingUsageScreen data={data} onRefetch={() => setRefreshKey(k => k + 1)} />;
}

interface BillingUsageScreenProps {
  /** `null` while the page loads: it draws itself in a loading scope. */
  data: billingUsageContentQuery$data | null;
  onRefetch: () => void;
}

/** The page drawn from its query's answer (props only, so it can draw itself while that answer is on its way). */
export function BillingUsageScreen({ data, onRefetch: refetch }: BillingUsageScreenProps) {
  const loading = useLoadingScope() || data == null;
  // The desktop build: every figure below renders, and nothing that changes one
  // does — the header's single action leaves for the web app instead (see
  // `billing-visibility.ts`).
  const readOnly = isBillingReadOnly();
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [activateModalOpen, setActivateModalOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  /**
   * The Manage AI Balance modal's open state IS the URL (`?action=`): the
   * app-wide balance bar deep-links to it from any page, and one owner of the
   * state is what keeps that link and the header button from disagreeing.
   * Closing clears the param, so a reload does not reopen a dismissed dialog.
   */
  const { params: pageParams, setParam: setPageParam } = useApiParams({ action: { type: 'string', default: '' } });
  const openAiBalanceModal = () => setPageParam('action', MANAGE_AI_BALANCE_ACTION);
  const closeAiBalanceModal = () => setPageParam('action', '');

  const subscription = data?.subscription ?? null;
  const status = resolveSubscriptionStatus(subscription?.status);
  // Carrying the AI product at all is what makes its usage worth showing; it is
  // metered, so there is no package to check for.
  const hasAi = subscription?.products.some(p => p.name === OpenframeProduct.AI_ASSISTANCE) ?? false;
  const isTrial = status === SubscriptionStatus.TRIAL;
  /**
   * A trial has no balance to manage: its AI runs on the grant, and what a
   * paused assistant needs is the subscription, not a top-up. So the modal is
   * not offered — and not reachable through the URL either, which the app-wide
   * bar never writes on a trial. The read-only build buys nothing at all, so
   * the same `?action=` must not open a purchase there.
   */
  const aiBalanceOffered = hasAi && !isTrial && !readOnly;
  // A trial has no card to charge and no balance to refill, so its arrangement
  // is not worth a request — the card draws without the mark.
  const autoTopUpOffered = hasAi && !isTrial;

  const header = useBillingPageActions({
    subscription,
    readOnly,
    onChangePlan: () => setPlanModalOpen(true),
    onActivate: () => setActivateModalOpen(true),
    onManageAiBalance: aiBalanceOffered ? openAiBalanceModal : null,
    onCancel: () => setCancelling(true),
    onRenewed: refetch,
  });

  // No subscription record at all. Every figure below would be a zero or a dash
  // presented as this tenant's plan, and the header would offer to change a plan
  // that does not exist — so the page states the absence instead of dressing it
  // up. (`SubscriptionGuard` reads the same absence as CANCELED and locks the app.)
  if (!loading && subscription == null) {
    return (
      <BillingPageFrame>
        <LockedScreen
          icon={<AlertTriangleIcon className="size-8" />}
          title="No subscription found"
          description="This workspace has no billing record yet. Contact support if you expected to see a plan here."
        />
      </BillingPageFrame>
    );
  }

  const aiBalanceModalOpen = aiBalanceOffered && pageParams.action === MANAGE_AI_BALANCE_ACTION;
  const openPlanModal = () => setPlanModalOpen(true);

  // The same card with the mark missing: what the wait shows, and what a
  // failed arrangement query degrades to. Never a grey bar where a figure is.
  const paidCardWithoutAutoTopUp = <PaidAiTokensCard subscription={subscription} autoTopUp={null} />;
  // While it loads, the row is all three cards: the AI pair is dropped only for a subscription that does not carry
  // the AI product, which the response has not said yet, and two cards reflowing into three is the larger jump.
  const showAiCards = loading || hasAi;

  return (
    <BillingPageFrame actions={header.actions} menuActions={header.menuActions}>
      {readOnly && <BillingReadOnlyNotice />}

      {/* Dev-only; renders nothing (and issues no requests) unless the test-clock flag is on. In the page's loading
          scope it draws itself without its query. */}
      <TestClockPanel onClockChanged={refetch} />

      <TestModeBanner />

      {/* Two AI counters, because AI runs on two figures: what the period gives
          away, and the balance it draws from once that is spent. */}
      <div
        className={cn(
          'grid gap-[var(--spacing-system-m)]',
          showAiCards ? 'content-md:grid-cols-3' : 'content-md:grid-cols-1',
        )}
      >
        <DeviceUsageCard subscription={subscription} />
        {showAiCards && (
          <>
            <FreeAiTokensCard subscription={subscription} />
            {autoTopUpOffered && subscription ? (
              <AutoTopUpIsland label="AutoTopUp" fallback={paidCardWithoutAutoTopUp}>
                {autoTopUp => <PaidAiTokensCard subscription={subscription} autoTopUp={autoTopUp} />}
              </AutoTopUpIsland>
            ) : (
              paidCardWithoutAutoTopUp
            )}
          </>
        )}
      </div>

      {hasAi && subscription && <AiBalanceAlert subscription={subscription} />}

      {/* The system switched the refill off over a declined card: said here,
          under the balance it stopped refilling. Nothing while it loads, and
          nothing if it cannot be loaded — a notice is not worth an error. */}
      {autoTopUpOffered && (
        <AutoTopUpIsland
          label="AutoTopUpNotice"
          fallback={null} // loading-standard-ok: an optional notice (a refill switched off), nothing while it loads
        >
          {autoTopUp => <AutoTopUpNotice status={autoTopUp} onManage={aiBalanceOffered ? openAiBalanceModal : null} />}
        </AutoTopUpIsland>
      )}

      {subscription && <DeviceOverageBlock subscription={subscription} onUpgrade={readOnly ? null : openPlanModal} />}

      <PlanSections subscription={subscription} billingPlan={data?.billingPlan ?? null} />

      <InvoicesHistory subscription={subscription} />

      {/* Raises an invoice and opens it, or saves the refill arrangement; the
          balance moves once an invoice is paid, which is when the page's next
          fetch reads it. Nothing to refetch here. */}
      <ManageAiBalanceModal isOpen={aiBalanceModalOpen} onClose={closeAiBalanceModal} />

      <UpgradePlanModal
        isOpen={planModalOpen}
        onClose={() => setPlanModalOpen(false)}
        onUpdated={() => {
          setPlanModalOpen(false);
          refetch();
        }}
      />

      {/* Leaves for Stripe in a new tab; the subscription it activates lands on
          the page's next fetch, not through this modal. */}
      <ActivateSubscriptionModal
        isOpen={activateModalOpen}
        status={status}
        onClose={() => setActivateModalOpen(false)}
      />

      {cancelling && subscription && (
        <CancelSubscriptionFlow
          subscription={subscription}
          onClose={() => setCancelling(false)}
          // "Find a Plan that Fits" — the plan picker is right here now, so the
          // offer hands off to it instead of sending the user to another page.
          onChangePlan={() => {
            setCancelling(false);
            openPlanModal();
          }}
          onCancelled={refetch}
        />
      )}
    </BillingPageFrame>
  );
}
