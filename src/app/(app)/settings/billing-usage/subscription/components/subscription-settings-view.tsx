'use client';

import { ErrorBoundary } from '@flamingo-stack/openframe-frontend-core/components/features';
import { PageLayout } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useRouter } from 'next/navigation';
import { Suspense, useCallback } from 'react';
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
import { type PlanCheckoutData, usePlanCheckout, usePlanCheckoutData } from '../hooks/use-plan-checkout';
import { PlanCheckoutCards } from './plan-checkout-cards';
import { PlanTotalSummary } from './plan-total-summary';
import { SubscriptionSubmitButton } from './subscription-submit-button';

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
 * The form itself — the query, the choices, what the button sends — is
 * `usePlanCheckout`, shared with the billing page's Activate Subscription
 * modal. This file is only the page around it.
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
  const data = usePlanCheckoutData();
  return <PaywallBody copy={copy} data={data} />;
}

interface PaywallBodyProps {
  copy: PaywallCopy;
  /** `null` while the catalog is on its way — every slot below handles that itself. */
  data: PlanCheckoutData | null;
}

function PaywallBody({ copy, data }: PaywallBodyProps) {
  const { status } = useSubscriptionLock();
  const router = useRouter();
  // Paid from the lock screen: the mutation's response carries the subscription's
  // new status into the Relay store, which is what unlocks the app — and Billing
  // & Usage is where the plan just bought is worth looking at.
  const handleUpdated = useCallback(() => router.push(routes.settings.billingUsage()), [router]);
  // No active paid subscription → create a new one via Stripe Checkout instead
  // of an update (no diff/validation gating in that flow).
  const needsCheckout =
    status === SubscriptionStatus.TRIAL ||
    status === SubscriptionStatus.TRIAL_EXPIRED ||
    status === SubscriptionStatus.CANCELED;

  const form = usePlanCheckout(data);

  const submitButton = (className?: string) => (
    <SubscriptionSubmitButton
      needsCheckout={needsCheckout}
      packageUpdates={form.packageUpdates}
      checkoutProducts={form.checkoutProducts}
      hasInvalidCustom={form.hasInvalidCustom}
      tokenAmountUsd={form.tokenAmountUsd}
      validateTopUp={form.topUp.validate}
      onUpdated={handleUpdated}
      className={className}
    />
  );

  return (
    <>
      <PaywallHeader copy={copy} deviceCount={form.deviceCount} />

      <PlanCheckoutCards form={form} />

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
