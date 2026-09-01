'use client';

import { ErrorBoundary } from '@flamingo-stack/openframe-frontend-core/components/features';
import { PageLayout } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useRouter } from 'next/navigation';
import { Suspense, useCallback, useMemo, useState } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { subscriptionSettingsViewQuery as SubscriptionSettingsViewQueryType } from '@/__generated__/subscriptionSettingsViewQuery.graphql';
import { PaywallHeader } from '@/app/components/subscription-lock/paywall-header';
import { useSubscriptionLock } from '@/app/components/subscription-lock/subscription-guard';
import { getPaywallCopy, type PaywallCopy } from '@/app/components/subscription-lock/subscription-lock-copy';
import { SubscriptionStatus } from '@/app/components/subscription-lock/subscription-status';
import { WorkspaceInactiveScreen } from '@/app/components/subscription-lock/workspace-inactive-screen';
import { OpenframeProduct } from '@/generated/schema-enums';
import { routes } from '@/lib/routes';
import { useAiSpendLimit } from '../../hooks/use-ai-spend-limit';
import { aiTokenPrice } from '../../lib/ai-token-price';
import type { ProductCheckoutInput } from '../hooks/use-create-checkout-session';
import type { ProductUpdates } from '../types/subscription.types';
import { AiAssistantsIncludedNote } from './ai-assistants-included-note';
import { AiTokensUsageCard } from './ai-tokens-usage-card';
import { DeviceManagementCard } from './device-management-card';
import { PlanTotalSummary } from './plan-total-summary';
import { SubscriptionSubmitButton } from './subscription-submit-button';

/**
 * Billing data ONLY.
 *
 * The fleet size is back in the header and in the device panel, and it comes
 * from `subscription.usage` — NOT from the `devices()` query it used to be
 * spread from. That is app data: a locked workspace has it refused with
 * `SUBSCRIPTION_TRIAL_EXPIRED`, and because `devices` is non-null the refusal
 * nulled this whole payload and crashed the one screen a locked workspace has to
 * be able to render. The same count, counted by billing, carries no such risk.
 */
const subscriptionSettingsViewQuery = graphql`
  query subscriptionSettingsViewQuery {
    billingPlan {
      id
      products {
        id
        name
        packageOptions { billingPeriod }
        # AI's metered rate. Read here rather than inside the AI card because the
        # spending limit it prices is owned by this page now — the card no longer
        # saves anything of its own. unitSize is what price is quoted per (AI:
        # a block of tokens), so both are needed to price one token.
        unitSize
        payAsYouGoOption { id price }
        ...devicePlanPickerProductFragment
      }
    }
    subscription {
      id
      aiSpendCapUsd
      # NOT aiTokensFree: that is the grant for the period the tenant is in
      # (5M on a trial), and this page previews the plan they are about to buy.
      # See FREE_TOKENS_BY_PLAN in the AI card for what stands in until a
      # prospective figure exists.
      usage {
        activeDevices
      }
      products {
        name
        ...devicePlanPickerSubscriptionFragment
      }
    }
  }
`;

/**
 * The paywall.
 *
 * There is no skeleton component beside this one: the page renders ITSELF while
 * the catalog loads. `PaywallBody` is the single layout, and it draws the same
 * heading, notes, cards and footer whether or not the data has landed — with
 * `null` refs the cards show their own pending rows (see `DeviceManagementCard`).
 * A parallel skeleton file is what this page used to have, and it drifted from
 * the real thing every time either was touched.
 */
export function SubscriptionSettingsView() {
  const { status } = useSubscriptionLock();
  // Resolved here rather than carried on the context, so the plan-lock wording
  // lives only in the modules that render plans (see subscription-lock-copy.ts).
  const copy = getPaywallCopy(status);

  return (
    <PageLayout className="px-[var(--spacing-system-l)] pb-28 md:pb-[var(--spacing-system-l)]" showHeader={false}>
      {/* This screen is what a locked workspace gets INSTEAD of the app, so a throw
          here has nowhere to land but the root — where it replaces the lock with
          Next's generic failure page and the user is left with no way out at all.
          A refused or failed catalog query degrades to the same screen the
          payment-free builds show: it needs no data, and it still offers a
          re-check and a sign-out. */}
      <ErrorBoundary fallback={<WorkspaceInactiveScreen {...PLANS_UNAVAILABLE_COPY} />}>
        <Suspense fallback={<PaywallBody copy={copy} data={null} />}>
          <SubscriptionSettingsContent copy={copy} />
        </Suspense>
      </ErrorBoundary>
    </PageLayout>
  );
}

/** Shown in place of the plans when their catalog cannot be loaded at all. */
const PLANS_UNAVAILABLE_COPY = {
  title: "We couldn't load the plans.",
  description: 'Something went wrong on our side. Try again in a moment, or contact support if it keeps happening.',
};

/** The page while its gates (feature flag, role) are still resolving. */
export function SubscriptionSettingsLoading() {
  const { status } = useSubscriptionLock();

  return (
    <PageLayout className="px-[var(--spacing-system-l)] pb-28 md:pb-[var(--spacing-system-l)]" showHeader={false}>
      <PaywallBody copy={getPaywallCopy(status)} data={null} />
    </PageLayout>
  );
}

function SubscriptionSettingsContent({ copy }: { copy: PaywallCopy }) {
  const data = useLazyLoadQuery<SubscriptionSettingsViewQueryType>(
    subscriptionSettingsViewQuery,
    {},
    {
      fetchPolicy: 'store-and-network',
      // This IS the lock screen. Gating it behind the subscription gate would
      // park the paywall on the very state it exists to get the user out of.
      networkCacheConfig: { metadata: { skipSubscriptionGate: true } },
    },
  );

  return <PaywallBody copy={copy} data={data} />;
}

interface PaywallBodyProps {
  copy: PaywallCopy;
  /** `null` while the catalog is on its way — every slot below handles that itself. */
  data: SubscriptionSettingsViewQueryType['response'] | null;
}

function PaywallBody({ copy, data }: PaywallBodyProps) {
  const { status } = useSubscriptionLock();
  const router = useRouter();
  // Paid from the lock screen: the mutation's response carries the subscription's
  // new status into the Relay store, which is what unlocks the app — and Billing
  // & Usage is where the plan just bought is worth looking at.
  const handleUpdated = useCallback(() => router.push(routes.settings.billingUsage), [router]);
  // No active paid subscription → create a new one via Stripe Checkout instead
  // of an update (no diff/validation gating in that flow).
  const needsCheckout =
    status === SubscriptionStatus.TRIAL ||
    status === SubscriptionStatus.TRIAL_EXPIRED ||
    status === SubscriptionStatus.CANCELED;

  const loading = data == null;
  const products = data?.billingPlan?.products ?? [];
  const subscriptionProducts = data?.subscription?.products ?? [];

  const deviceProduct = products.find(p => p.name === OpenframeProduct.MANAGED_DEVICES) ?? null;
  const aiProduct = products.find(p => p.name === OpenframeProduct.AI_ASSISTANCE) ?? null;
  const deviceSubscriptionProduct = subscriptionProducts.find(p => p.name === OpenframeProduct.MANAGED_DEVICES) ?? null;

  // Both cards are drawn while loading: this plan has always had the two, and
  // opening on one column only to reflow into two is a worse wait than a card
  // that fills in. Once the catalog answers, it decides.
  const showDeviceCard = loading || deviceProduct != null;
  const showAiCard = loading || aiProduct != null;

  /**
   * The devices this workspace is currently running — billing's own count
   * (`usage.activeDevices`), NOT the `devices()` query the paywall used to spread
   * (see the query above for why that one cannot come back).
   *
   * One number for the whole screen: the header names it, and the pay-as-you-go
   * panel prices it. A panel that counted one fleet and totalled another would be
   * two answers to the same question.
   */
  const deviceCount = data?.subscription?.usage?.activeDevices ?? null;

  // Only the device card takes a plan selection. AI is metered — there is no
  // package to choose (see `AiTokensUsageCard`).
  const [deviceUpdates, setDeviceUpdates] = useState<ProductUpdates | null>(null);

  /**
   * The AI spending limit, held HERE rather than in the card that draws it: it
   * is part of the same form as the plan, and the page's one button is what
   * stores it. The card used to write every click straight through, so simply
   * unticking the box to see the options changed the subscription.
   */
  const aiLimit = useAiSpendLimit({
    capUsd: data?.subscription?.aiSpendCapUsd ?? null,
    tokenPrice: aiTokenPrice(aiProduct?.payAsYouGoOption?.price, aiProduct?.unitSize),
  });

  /**
   * Every non-device product, entered as pay-as-you-go. A checkout session
   * describes the WHOLE target plan rather than a diff, so leaving these out
   * would activate a subscription with the AI assistants switched off — the same
   * entry the AI card used to contribute before it stopped selling packages.
   */
  const otherProducts = useMemo<ProductCheckoutInput[]>(
    () =>
      products
        .filter(p => p.name !== OpenframeProduct.MANAGED_DEVICES)
        .map(p => ({ productName: p.name, payAsYouGoEnabled: true })),
    [products],
  );

  const packageUpdates = deviceUpdates?.packageUpdates ?? [];
  const checkoutProducts = deviceUpdates?.checkout ? [deviceUpdates.checkout, ...otherProducts] : [];
  const hasInvalidCustom = deviceUpdates != null && !deviceUpdates.valid;
  const selectionTotal = deviceUpdates?.total ?? null;
  /**
   * `undefined` when the limit was left as the subscription already has it, so
   * the submit issues no cap mutation at all. `null` is a real value there — it
   * is how "no limit" is expressed — which is why this is not a falsy check.
   */
  const aiSpendCapUsd = aiLimit.changed ? aiLimit.capUsd : undefined;

  return (
    <>
      <PaywallHeader copy={copy} deviceCount={deviceCount} />

      {showAiCard && <AiAssistantsIncludedNote />}

      {/* `items-stretch`, not the `items-start` this had: side by side, two cards
          of different heights read as one unfinished. Each card keeps its content
          top-aligned (they are `flex-col`), so the shorter one gains empty space
          at the bottom rather than stretched rows. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {showDeviceCard && (
          <DeviceManagementCard
            productRef={deviceProduct}
            subscriptionProductRef={deviceSubscriptionProduct}
            deviceCount={deviceCount}
            onUpdatesChange={setDeviceUpdates}
          />
        )}
        {showAiCard && <AiTokensUsageCard loading={loading} deviceMode={deviceUpdates?.mode ?? null} limit={aiLimit} />}
      </div>

      {/* The mobile submit bar is fixed to the viewport, so the total it applies
          to rides in the page flow above it rather than inside it. */}
      <PlanTotalSummary total={selectionTotal} showAiNote={showAiCard} loading={loading} className="md:hidden" />

      <div className="hidden md:flex flex-row gap-6 items-center">
        <PlanTotalSummary
          total={selectionTotal}
          showAiNote={showAiCard}
          loading={loading}
          className="flex-1 max-w-[500px]"
        />
        <div className="flex flex-1 justify-end">
          <SubscriptionSubmitButton
            needsCheckout={needsCheckout}
            packageUpdates={packageUpdates}
            checkoutProducts={checkoutProducts}
            hasInvalidCustom={hasInvalidCustom}
            aiSpendCapUsd={aiSpendCapUsd}
            onUpdated={handleUpdated}
          />
        </div>
      </div>

      {/* Fixed (not sticky) so the bar always pins to the bottom of the viewport,
          even when the page is shorter than the screen — sticky only engages while
          scrolling, leaving the bar stranded mid-page on short content. The room
          it needs is reserved by this page's own `pb-28` below `md` rather than by
          `<main>`: the shell's bottom padding is per-route (`getMainClassNameOverride`
          gives `/settings` and `/tickets` `pb-0`), and as a lock screen this renders
          under whatever route the user was on. Its own reservation is the only one
          that holds on all of them. */}
      <div className="md:hidden fixed inset-x-0 bottom-0 z-20 border-t border-ods-border bg-ods-card p-[var(--spacing-system-l)]">
        <div className="flex">
          <SubscriptionSubmitButton
            needsCheckout={needsCheckout}
            packageUpdates={packageUpdates}
            checkoutProducts={checkoutProducts}
            hasInvalidCustom={hasInvalidCustom}
            aiSpendCapUsd={aiSpendCapUsd}
            onUpdated={handleUpdated}
            className="w-full"
          />
        </div>
      </div>
    </>
  );
}
