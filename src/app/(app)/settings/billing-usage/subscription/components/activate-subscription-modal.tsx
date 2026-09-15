'use client';

import { ErrorBoundary } from '@flamingo-stack/openframe-frontend-core/components/features';
import { ModalV2Content, ModalV2Footer } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { Suspense } from 'react';
import { SimpleModal } from '@/app/components/shared/simple-modal';
import {
  getPaywallCopy,
  type PaywallCopy,
  paywallDescription,
  PLANS_UNAVAILABLE_COPY,
} from '@/app/components/subscription-lock/subscription-lock-copy';
import type { SubscriptionStatus } from '@/generated/schema-enums';
import { type PlanCheckoutData, usePlanCheckout, usePlanCheckoutData } from '../hooks/use-plan-checkout';
import { PlanCheckoutCards } from './plan-checkout-cards';
import { PlanTotalSummary } from './plan-total-summary';
import { SubscriptionSubmitButton } from './subscription-submit-button';

interface ActivateSubscriptionModalProps {
  isOpen: boolean;
  /** Names the heading — an active trial, or a subscription that ended. */
  status: SubscriptionStatus;
  onClose: () => void;
}

/**
 * Starting the subscription before the trial runs out — the paywall, in a modal.
 *
 * The same form as the lock screen (`SubscriptionSettingsView`): the device
 * plan, the first AI top-up, and one "Proceed to Payment" that opens Stripe
 * Checkout with the whole plan. Nothing here is a different purchase; it is the
 * same one, made early. Over its own query, run only once the modal opens — the
 * billing page has no reason to hold the catalog's prices until then.
 *
 * The checkout leaves for Stripe in a new tab and never reports back to this
 * component, so the modal stays as it was; the user closes it, and the page's
 * next fetch reads the subscription Stripe activated.
 */
export function ActivateSubscriptionModal({ isOpen, status, onClose }: ActivateSubscriptionModalProps) {
  // Nothing mounts — and no query runs — until the modal is actually opened.
  if (!isOpen) return null;

  const copy = getPaywallCopy(status);

  return (
    <SimpleModal isOpen onClose={onClose} title={copy.title} className="md:max-w-[1040px]">
      {/* A failed catalog stays inside the modal. Unbounded, the throw would
          reach the page's boundary and replace the whole of Billing & Usage
          with an error over a dialog that could simply be closed. */}
      <ErrorBoundary fallback={<PlansUnavailable />}>
        <Suspense fallback={<ActivateSubscriptionBody copy={copy} data={null} />}>
          <ActivateSubscriptionContent copy={copy} />
        </Suspense>
      </ErrorBoundary>
    </SimpleModal>
  );
}

function ActivateSubscriptionContent({ copy }: { copy: PaywallCopy }) {
  const data = usePlanCheckoutData();
  return <ActivateSubscriptionBody copy={copy} data={data} />;
}

interface ActivateSubscriptionBodyProps {
  copy: PaywallCopy;
  /** `null` while the catalog is on its way — every slot below handles that itself. */
  data: PlanCheckoutData | null;
}

/**
 * Content and footer both, so the footer's total and button read the same
 * form state the cards write — `SimpleModal`'s own footer slot sits outside
 * this boundary and could not.
 */
function ActivateSubscriptionBody({ copy, data }: ActivateSubscriptionBodyProps) {
  const form = usePlanCheckout(data);

  return (
    <>
      <ModalV2Content className="flex flex-col gap-[var(--spacing-system-l)]">
        <p className="text-ods-text-secondary text-h6">{paywallDescription(copy, form.deviceCount)}</p>
        <PlanCheckoutCards form={form} />
      </ModalV2Content>
      <ModalV2Footer className="flex-col items-stretch gap-[var(--spacing-system-mf)] sm:flex-row sm:items-center">
        <PlanTotalSummary
          total={form.selectionTotal}
          topUpUsd={form.tokenAmountUsd}
          showAiNote={form.showAiCard}
          loading={form.loading}
          className="flex-1"
        />
        <SubscriptionSubmitButton
          needsCheckout
          packageUpdates={form.packageUpdates}
          checkoutProducts={form.checkoutProducts}
          hasInvalidCustom={form.hasInvalidCustom}
          tokenAmountUsd={form.tokenAmountUsd}
          validateTopUp={form.topUp.validate}
          className="shrink-0"
        />
      </ModalV2Footer>
    </>
  );
}

/** Same dialog, same close button — only the plans are replaced by why they are missing. */
function PlansUnavailable() {
  return (
    <ModalV2Content className="flex flex-col gap-[var(--spacing-system-xs)]">
      <p className="font-bold text-ods-text-primary text-h3">{PLANS_UNAVAILABLE_COPY.title}</p>
      <p className="text-ods-text-secondary text-h4">{PLANS_UNAVAILABLE_COPY.description}</p>
    </ModalV2Content>
  );
}
