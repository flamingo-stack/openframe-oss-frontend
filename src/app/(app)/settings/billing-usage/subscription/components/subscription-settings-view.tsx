'use client';

import { ErrorBoundary } from '@flamingo-stack/openframe-frontend-core/components/features';
import { PageLayout } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useRouter } from 'next/navigation';
import { Suspense, useCallback, useState } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { subscriptionSettingsViewQuery as SubscriptionSettingsViewQueryType } from '@/__generated__/subscriptionSettingsViewQuery.graphql';
import { PaywallHeader } from '@/app/components/subscription-lock/paywall-header';
import { useSubscriptionLock } from '@/app/components/subscription-lock/subscription-guard';
import { getPaywallCopy, type PaywallCopy } from '@/app/components/subscription-lock/subscription-lock-copy';
import { SubscriptionStatus } from '@/app/components/subscription-lock/subscription-status';
import { WorkspaceInactiveScreen } from '@/app/components/subscription-lock/workspace-inactive-screen';
import { OpenframeProduct } from '@/generated/schema-enums';
import { routes } from '@/lib/routes';
import type { OpenframeProduct as OpenframeProductName, ProductUpdates } from '../types/subscription.types';
import { AiAssistantsIncludedNote } from './ai-assistants-included-note';
import { DeviceManagementCard } from './device-management-card';
import { ModelTokenRates } from './model-token-rates';
import { PlanTotalSummary } from './plan-total-summary';
import { ProductSubscriptionCard } from './product-subscription-card';
import { SubscriptionSubmitButton } from './subscription-submit-button';

/**
 * The AI add-on keeps the package-list card: it is pay-as-you-go only, so there
 * is nothing to prepay and nothing to step through — see the note the plan
 * picker shows above the cards. Being PAYG-only is also why the card no longer
 * carries a Custom Amount option: nothing here ever offered one.
 */
const AI_PRODUCT_DISPLAY = {
  title: 'AI Assistant Add-on',
  description: 'Buy OpenFrame tokens to power your AI assistants across all supported models. One unified balance.',
  packageUnitLabel: 'OpenFrame tokens',
};

/**
 * Billing data ONLY.
 *
 * This query used to also spread a `devices()` count, to name the fleet in the
 * header and price the monthly panel. That is app data, and a locked workspace
 * has app data refused with `SUBSCRIPTION_TRIAL_EXPIRED` — `devices` being
 * non-null, the refusal nulled this whole payload and crashed the one screen a
 * locked workspace has to be able to render. Nothing here may reach outside
 * billing again for that reason.
 */
const subscriptionSettingsViewQuery = graphql`
  query subscriptionSettingsViewQuery {
    billingPlan {
      id
      products {
        id
        name
        packageOptions { billingPeriod }
        payAsYouGoOption { id }
        ...productSubscriptionCardProductFragment
        ...devicePlanPickerProductFragment
      }
    }
    subscription {
      id
      products {
        name
        ...productSubscriptionCardSubscriptionFragment
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
    <PageLayout className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]" showHeader={false}>
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
    <PageLayout className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]" showHeader={false}>
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
  const aiSubscriptionProduct = subscriptionProducts.find(p => p.name === OpenframeProduct.AI_ASSISTANCE) ?? null;

  // Both cards are drawn while loading: this plan has always had the two, and
  // opening on one column only to reflow into two is a worse wait than a card
  // that fills in. Once the catalog answers, it decides.
  const showDeviceCard = loading || deviceProduct != null;
  const showAiCard = loading || aiProduct != null;

  // The devices card shows its Monthly/Annual toggle only when the catalog prices
  // both ways; the AI card reserves the same height so the two stay aligned.
  const deviceHasBillingToggle =
    loading ||
    (deviceProduct != null &&
      deviceProduct.payAsYouGoOption != null &&
      deviceProduct.packageOptions.some(opt => opt.billingPeriod === 'YEARLY'));

  const [updatesMap, setUpdatesMap] = useState<Partial<Record<OpenframeProductName, ProductUpdates>>>({});

  const handleUpdatesChange = useCallback((productName: OpenframeProductName, updates: ProductUpdates) => {
    setUpdatesMap(prev => ({ ...prev, [productName]: updates }));
  }, []);

  const packageUpdates = products.flatMap(p => updatesMap[p.name]?.packageUpdates ?? []);
  const checkoutProducts = products.map(p => updatesMap[p.name]?.checkout).filter(c => c != null);
  const hasInvalidCustom = products.some(p => {
    const updates = updatesMap[p.name];
    return updates != null && !updates.valid;
  });
  // Only the devices product prices a total; AI is metered, so it contributes none.
  const selectionTotal = products.map(p => updatesMap[p.name]?.total).find(total => total != null) ?? null;

  return (
    <>
      <PaywallHeader copy={copy} />

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
            onUpdatesChange={updates => handleUpdatesChange(OpenframeProduct.MANAGED_DEVICES, updates)}
          />
        )}
        {showAiCard && (
          <ProductSubscriptionCard
            productRef={aiProduct}
            subscriptionProductRef={aiSubscriptionProduct}
            reserveBillingPeriodSpace={deviceHasBillingToggle}
            helpText={<ModelTokenRates />}
            onUpdatesChange={updates => handleUpdatesChange(OpenframeProduct.AI_ASSISTANCE, updates)}
            {...AI_PRODUCT_DISPLAY}
          />
        )}
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
            onUpdated={handleUpdated}
          />
        </div>
      </div>

      {/* Fixed (not sticky) so the bar always pins to the bottom of the viewport,
          even when the page is shorter than the screen — sticky only engages while
          scrolling, leaving the bar stranded mid-page on short content. The app's
          <main> reserves pb-20 for exactly this bar. */}
      <div className="md:hidden fixed inset-x-0 bottom-0 z-20 border-t border-ods-border bg-ods-card p-[var(--spacing-system-l)]">
        <div className="flex">
          <SubscriptionSubmitButton
            needsCheckout={needsCheckout}
            packageUpdates={packageUpdates}
            checkoutProducts={checkoutProducts}
            hasInvalidCustom={hasInvalidCustom}
            onUpdated={handleUpdated}
            className="w-full"
          />
        </div>
      </div>
    </>
  );
}
