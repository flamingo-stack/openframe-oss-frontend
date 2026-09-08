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
  // Nothing, deliberately. The paywall's own loading state is the right thing to
  // show here, but it lives in the chunk being fetched — and a spinner in front
  // of it would only add a phase the user has to read. Holding the frame empty
  // for the fetch keeps the first thing they see the page itself.
  loading: () => null,
});

/**
 * Content rendered in place of the normal page content when the tenant is locked
 * out of the app (trial expired, subscription canceled, etc.).
 *
 * The lock applies to everyone in the workspace — `SubscriptionGuard` does not
 * consult the role, and it must not: the data is unavailable to the whole
 * tenant. Only the REMEDY is role-shaped, and deciding that is the lazily-loaded
 * module's job, not this one's (see `subscription-plan-lock-content.tsx`).
 *
 * What is decided HERE is the one thing that cannot wait and cannot be lazy: on
 * builds where the payment UI is hidden, the plan picker must not be reachable,
 * downloadable, or renderable at all (App Store Guideline 3.1.1 — see
 * `billing-visibility.ts`). Everything past this line implies a paying build.
 *
 * The role check moved into the lazy module so that WAITING on it can render the
 * paywall unpriced instead of a spinner. It used to sit here, where the paywall's
 * markup is unavailable, and the only two things this file could put on screen
 * were a spinner or — as it originally did — the "contact your administrator"
 * refusal, shown to owners for as long as `/me` took to answer.
 */
export function SubscriptionLockContent() {
  if (isBillingHidden()) {
    return <WorkspaceInactiveScreen />;
  }

  return <SubscriptionPlanLockContent />;
}
