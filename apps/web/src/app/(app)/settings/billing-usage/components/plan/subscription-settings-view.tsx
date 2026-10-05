'use client';

import { ErrorBoundary } from '@flamingo-stack/openframe-frontend-core/components/features';
import { PageLayout } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useRouter } from 'next/navigation';
import { Suspense } from 'react';
import { graphql, useFragment, useLazyLoadQuery } from 'react-relay';
import type { subscriptionSettingsView_query$key } from '@/__generated__/subscriptionSettingsView_query.graphql';
import type { subscriptionSettingsViewQuery as SubscriptionSettingsViewQueryType } from '@/__generated__/subscriptionSettingsViewQuery.graphql';
import { PaywallHeader } from '@/app/components/subscription-lock/paywall-header';
import { useSubscriptionLock } from '@/app/components/subscription-lock/subscription-guard';
import {
  getPaywallCopy,
  type PaywallCopy,
  PLANS_UNAVAILABLE_COPY,
} from '@/app/components/subscription-lock/subscription-lock-copy';
import { SubscriptionStatus } from '@/app/components/subscription-lock/subscription-status';
import { WorkspaceInactiveScreen } from '@/app/components/subscription-lock/workspace-inactive-screen';
import { routes } from '@/lib/routes';
import { PlanCheckoutCards } from './plan-checkout-cards';
import { PlanTotalSummary } from './plan-total-summary';
import { SubscriptionSubmitButton } from './subscription-submit-button';
import { usePlanCheckout } from './use-plan-checkout';

const subscriptionSettingsViewQuery = graphql`
  query subscriptionSettingsViewQuery {
    ...subscriptionSettingsView_query
  }
`;

/**
 * Billing data ONLY — the form's fragment and the cards' (see each). Nothing
 * here is app data a locked workspace would have refused.
 *
 * On the root type rather than in the query, so the body below is typed by
 * what it reads and not by whichever query feeds it: the billing page's
 * Activate Subscription modal draws the same form from a query of its own.
 */
const paywallBodyFragment = graphql`
  fragment subscriptionSettingsView_query on Query {
    ...usePlanCheckout_query
    ...planCheckoutCards_query
  }
`;

const PAGE_CLASS_NAME = 'px-[var(--spacing-system-l)] pb-28 md:pb-[var(--spacing-system-l)]';

/**
 * The paywall.
 *
 * There is no skeleton component beside this one: the page renders ITSELF while
 * the catalog loads. `PaywallBody` is the single layout, and it draws the same
 * heading, notes, cards and footer whether or not the data has landed — with
 * `null` refs the cards show their own pending rows (see `DeviceManagementCard`).
 * A parallel skeleton file is what this page used to have, and it drifted from
 * the real thing every time either was touched.
 *
 * The form itself — the choices, what the button sends — is `usePlanCheckout`,
 * shared with the billing page's Activate Subscription modal. This file is the
 * page around it, and the query that feeds it.
 */
export function SubscriptionSettingsView() {
  const { status } = useSubscriptionLock();
  // Resolved here rather than carried on the context, so the plan-lock wording
  // lives only in the modules that render plans (see subscription-lock-copy.ts).
  const copy = getPaywallCopy(status);

  return (
    <PageLayout className={PAGE_CLASS_NAME} showHeader={false}>
      {/* This screen is what a locked workspace gets INSTEAD of the app, so a throw
          here has nowhere to land but the root — where it replaces the lock with
          Next's generic failure page and the user is left with no way out at all.
          A refused or failed catalog query degrades to the same screen the
          payment-free builds show: it needs no data, and it still offers a
          re-check and a sign-out. */}
      <ErrorBoundary fallback={<WorkspaceInactiveScreen {...PLANS_UNAVAILABLE_COPY} />}>
        <Suspense fallback={<PaywallBody copy={copy} query={null} />}>
          <SubscriptionSettingsContent copy={copy} />
        </Suspense>
      </ErrorBoundary>
    </PageLayout>
  );
}

/** The page while its gates (feature flag, role) are still resolving. */
export function SubscriptionSettingsLoading() {
  const { status } = useSubscriptionLock();

  return (
    <PageLayout className={PAGE_CLASS_NAME} showHeader={false}>
      <PaywallBody copy={getPaywallCopy(status)} query={null} />
    </PageLayout>
  );
}

function SubscriptionSettingsContent({ copy }: { copy: PaywallCopy }) {
  const data = useLazyLoadQuery<SubscriptionSettingsViewQueryType>(
    subscriptionSettingsViewQuery,
    {},
    {
      fetchPolicy: 'store-and-network',
      // This IS the lock screen's data. Gating it behind the subscription gate
      // would park the paywall on the very state it exists to get the user out of.
      networkCacheConfig: { metadata: { skipSubscriptionGate: true } },
    },
  );
  return <PaywallBody copy={copy} query={data} />;
}

interface PaywallBodyProps {
  copy: PaywallCopy;
  /** `null` while the catalog is on its way — every slot below handles that itself. */
  query: subscriptionSettingsView_query$key | null;
}

function PaywallBody({ copy, query }: PaywallBodyProps) {
  const data = useFragment(paywallBodyFragment, query) ?? null;
  const { status } = useSubscriptionLock();
  const router = useRouter();
  // No active paid subscription → create a new one via Stripe Checkout instead
  // of an update (no diff/validation gating in that flow).
  const needsCheckout =
    status === SubscriptionStatus.TRIAL ||
    status === SubscriptionStatus.TRIAL_EXPIRED ||
    status === SubscriptionStatus.CANCELED;

  const form = usePlanCheckout(data);

  // Paid from the lock screen: the mutation's response carries the subscription's
  // new status into the Relay store, which is what unlocks the app — and Billing
  // & Usage is where the plan just bought is worth looking at.
  const handleUpdated = () => router.push(routes.settings.billingUsage());

  const submitButton = (className?: string) => (
    <SubscriptionSubmitButton
      needsCheckout={needsCheckout}
      packageUpdates={form.packageUpdates}
      checkoutProducts={form.checkoutProducts}
      hasInvalidCustom={form.hasInvalidCustom}
      tokenAmountUsd={form.tokenAmountUsd}
      autoTopUpEnabled={form.autoTopUp}
      validateTopUp={form.topUp.validate}
      onUpdated={handleUpdated}
      className={className}
    />
  );

  return (
    <>
      <PaywallHeader copy={copy} deviceCount={form.deviceCount} />

      <PlanCheckoutCards query={data} form={form} />

      {/* The mobile submit bar is fixed to the viewport, so the total it applies
          to rides in the page flow above it rather than inside it. */}
      <PlanTotalSummary
        total={form.selectionTotal}
        topUpUsd={form.tokenAmountUsd}
        showAiNote={form.showAiCard}
        loading={form.loading}
        className="md:hidden"
      />

      <div className="hidden flex-row items-center gap-6 md:flex">
        <PlanTotalSummary
          total={form.selectionTotal}
          topUpUsd={form.tokenAmountUsd}
          showAiNote={form.showAiCard}
          loading={form.loading}
          className="max-w-[500px] flex-1"
        />
        <div className="flex flex-1 justify-end">{submitButton()}</div>
      </div>

      {/* Fixed (not sticky) so the bar always pins to the bottom of the viewport,
          even when the page is shorter than the screen — sticky only engages while
          scrolling, leaving the bar stranded mid-page on short content. The room
          it needs is reserved by this page's own `pb-28` below `md` rather than by
          `<main>`: the shell's bottom padding is per-route (`getMainClassNameOverride`
          gives `/settings` and `/tickets` `pb-0`), and as a lock screen this renders
          under whatever route the user was on. Its own reservation is the only one
          that holds on all of them. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-ods-border bg-ods-card p-[var(--spacing-system-l)] md:hidden">
        <div className="flex">{submitButton('w-full')}</div>
      </div>
    </>
  );
}
