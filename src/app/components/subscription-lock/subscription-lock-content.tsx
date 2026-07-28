'use client';

import dynamic from 'next/dynamic';
import { isBillingHidden } from '@/lib/billing-visibility';
import { WorkspaceInactiveScreen } from './workspace-inactive-screen';

// Lazy on purpose, not for weight: a static import would put the plan cards,
// prices and Stripe Checkout entry point into the chunk every page loads,
// because `AppLayout` renders this on all of them. Lazy keeps that code out of
// the native builds' shared chunk entirely — the only build that can reach it
// is one where payments are allowed.
const SubscriptionPlanLockContent = dynamic(() => import('./subscription-plan-lock-content'), {
  ssr: false,
  loading: () => null,
});

/**
 * Content rendered in place of the normal page content when the tenant is
 * locked out of the app (trial expired, subscription canceled, etc.).
 *
 * Web/desktop get the plan picker — same data, same cards as the subscription
 * settings page. Builds with the payment UI hidden (the native app builds — see
 * `billing-visibility.ts`) get `WorkspaceInactiveScreen`: the lock stays, the
 * plans, prices and checkout CTA do not, and none of that code is even fetched.
 */
export function SubscriptionLockContent() {
  if (isBillingHidden()) {
    return <WorkspaceInactiveScreen />;
  }

  return <SubscriptionPlanLockContent />;
}
