'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { AlertTriangleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useApiParams } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useState } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type {
  billingUsageContentQuery as BillingUsageContentQueryType,
  billingUsageContentQuery$data,
} from '@/__generated__/billingUsageContentQuery.graphql';
import { LockedScreen } from '@/app/components/shared/locked-screen';
import { noop } from '@/app/components/shared/no-next-page';
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
import { AiBalanceAlert } from './ai-balance-alert';
import { BillingPageFrame } from './billing-page-frame';
import { BillingSections } from './billing-sections';
import { DeviceOverageBlock } from './device-overage-block';
import { PaidAiTokensCard } from './paid-ai-tokens-card';
import { PurchasedTokenPacks } from './purchased-token-packs';
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
      ...billingSections_billingPlan
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
      ...billingSections_subscription
      ...paidAiTokensCard_subscription
      ...aiBalanceAlert_subscription
      ...purchasedTokenPacks_subscription
      ...deviceOverageBlock_subscription
      ...cancelSubscriptionFlow_subscription
    }
  }
`;

/**
 * The billing page. While anything it waits on has not answered (the page's flag and role gates: `loading`; the
 * query: the Suspense boundary), it is the same page drawn in a loading scope, where every part draws its own
 * skeleton.
 */
export function BillingUsageContent({ loading = false }: { loading?: boolean }) {
  return (
    <LoadingSuspense gated={loading} label="Loading billing and usage">
      <BillingUsageReader />
    </LoadingSuspense>
  );
}

function BillingUsageReader() {
  // In a loading scope (its boundary's fallback, or the page's gates) it draws the page with no data and runs no read.
  if (useLoadingScope()) return <BillingUsageScreen data={null} onRefetch={noop} />;
  return <BillingUsageQuery />;
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

  // While it loads, the row is all three cards: the typical case. Whether the AI pair shows is known only from the
  // subscription's own products (no flag or catalog says it before this read), and a subscription typically carries
  // the AI product; two cards reflowing into three would be the larger jump anyway.
  const showAiCards = loading || hasAi;

  return (
    <BillingPageFrame
      actions={header.actions}
      menuActions={header.menuActions}
      // The actions are the subscription's; the read-only build's one action is stated before it answers.
      loadingActions={loading && !readOnly}
    >
      <BillingSections
        readOnly={readOnly}
        subscription={subscription}
        billingPlan={data?.billingPlan ?? null}
        showAiCards={showAiCards}
        onClockChanged={refetch}
        // The same card with the mark missing is what the wait shows, and what a failed arrangement query degrades
        // to. Never a grey bar where a figure is.
        paidAiCard={
          autoTopUpOffered && subscription ? (
            <AutoTopUpIsland
              label="AutoTopUp"
              fallback={<PaidAiTokensCard subscription={subscription} autoTopUp={null} />}
            >
              {autoTopUp => <PaidAiTokensCard subscription={subscription} autoTopUp={autoTopUp} />}
            </AutoTopUpIsland>
          ) : undefined
        }
        notices={
          <>
            {hasAi && subscription && (
              <div data-loading-optional className="contents">
                <AiBalanceAlert subscription={subscription} />
              </div>
            )}

            {/* The system switched the refill off over a declined card: said here,
                after the page it stopped refilling. Nothing while it loads, and
                nothing if it cannot be loaded — a notice is not worth an error. */}
            {autoTopUpOffered && (
              <div data-loading-optional className="contents">
                <AutoTopUpIsland label="AutoTopUpNotice" fallback={null}>
                  {autoTopUp => (
                    <AutoTopUpNotice status={autoTopUp} onManage={aiBalanceOffered ? openAiBalanceModal : null} />
                  )}
                </AutoTopUpIsland>
              </div>
            )}

            {hasAi && subscription && (
              <div data-loading-optional className="contents">
                <PurchasedTokenPacks subscription={subscription} />
              </div>
            )}

            {subscription && (
              <div data-loading-optional className="contents">
                <DeviceOverageBlock subscription={subscription} onUpgrade={readOnly ? null : openPlanModal} />
              </div>
            )}
          </>
        }
      />

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
