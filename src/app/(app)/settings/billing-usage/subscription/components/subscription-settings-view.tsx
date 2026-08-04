'use client';

import { PageLayout } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { Suspense, useCallback, useState } from 'react';
import { graphql, useFragment, useLazyLoadQuery } from 'react-relay';
import type { managedDevicesCountRelay_query$key as ManagedDevicesCountFragmentType } from '@/__generated__/managedDevicesCountRelay_query.graphql';
import type { subscriptionSettingsViewQuery as SubscriptionSettingsViewQueryType } from '@/__generated__/subscriptionSettingsViewQuery.graphql';
import { DEFAULT_DEVICES_LIST_STATUSES } from '@/app/(app)/devices/constants/device-statuses';
import { PaywallHeader } from '@/app/components/subscription-lock/paywall-header';
import { useSubscriptionLock } from '@/app/components/subscription-lock/subscription-lock-context';
import { getPaywallCopy, type PaywallCopy } from '@/app/components/subscription-lock/subscription-lock-copy';
import { SubscriptionStatus } from '@/app/components/subscription-lock/subscription-status';
import { OpenframeProduct } from '@/generated/schema-enums';
import { managedDevicesCountFragment } from '@/graphql/devices/managed-devices-count-relay';
import type { RelayDeviceFilter } from '@/graphql/devices/to-relay-device-filter';
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
 * picker shows above the cards.
 */
const AI_PRODUCT_DISPLAY = {
  title: 'AI Assistant Add-on',
  description: 'Buy OpenFrame tokens to power your AI assistants across all supported models. One unified balance.',
  packageUnitLabel: 'OpenFrame tokens',
  customLabel: 'Custom Amount',
  customSubtitle: 'Choose your number of tokens',
  // AI tokens are pay-as-you-go only — no committed Custom Amount.
  allowCustom: false,
};

/**
 * What the plan has to cover: the same online + offline fleet the Devices page
 * lists, counted from the device registry. Module-level so the query variables
 * keep one identity across renders.
 */
const MANAGED_DEVICES_FILTER: RelayDeviceFilter = { statuses: [...DEFAULT_DEVICES_LIST_STATUSES] };
const SUBSCRIPTION_SETTINGS_VARIABLES = { deviceFilter: MANAGED_DEVICES_FILTER };

const subscriptionSettingsViewQuery = graphql`
  query subscriptionSettingsViewQuery($deviceFilter: DeviceFilterInput) {
    ...managedDevicesCountRelay_query @arguments(filter: $deviceFilter)
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
        payAsYouGoOption { id }
        packageOptions { packageOptionId status }
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
      <Suspense fallback={<PaywallBody copy={copy} data={null} />}>
        <SubscriptionSettingsContent copy={copy} />
      </Suspense>
    </PageLayout>
  );
}

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
    SUBSCRIPTION_SETTINGS_VARIABLES,
    { fetchPolicy: 'store-and-network' },
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
  const deviceCount = useFragment<ManagedDevicesCountFragmentType>(managedDevicesCountFragment, data);
  // No active paid subscription → create a new one via Stripe Checkout instead
  // of an update (no diff/validation gating in that flow).
  const needsCheckout =
    status === SubscriptionStatus.TRIAL ||
    status === SubscriptionStatus.TRIAL_EXPIRED ||
    status === SubscriptionStatus.CANCELED;

  const loading = data == null;
  const products = data?.billingPlan?.products ?? [];
  const subscriptionProducts = data?.subscription?.products ?? [];
  // Devices in the registry right now — the fleet a subscription has to cover, and
  // the basis pay-as-you-go bills against.
  const detectedDevices = deviceCount?.devices.filteredCount ?? null;

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
      <PaywallHeader copy={copy} detectedDevices={detectedDevices} />

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
            detectedDevices={detectedDevices}
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
            className="w-full"
          />
        </div>
      </div>
    </>
  );
}
