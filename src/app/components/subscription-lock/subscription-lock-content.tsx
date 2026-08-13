'use client';

import dynamic from 'next/dynamic';
import { useBillingAccessGate } from '@/app/hooks/use-billing-access-gate';
import { SubscriptionStatus } from '@/generated/schema-enums';
import { isBillingHidden } from '@/lib/billing-visibility';
import { useSubscriptionLock } from './subscription-lock-context';
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
 * Copy for the viewer who cannot fix the lock themselves. Split by status because
 * "your trial ended" and "your subscription ended" are different facts, and the
 * one thing both need to say is who to go to.
 *
 * Not sourced from `subscription-lock-copy.ts`: that module is plan-and-purchase
 * wording, kept out of every non-purchasing bundle on purpose, and this path is
 * exactly a non-purchasing one.
 */
function noAccessCopy(status: SubscriptionStatus): { title: string; description: string } {
  const description =
    'Only the workspace owner or an admin can restore it. Contact one of them to bring the workspace back for your team.';

  return status === SubscriptionStatus.TRIAL_EXPIRED
    ? { title: 'The free trial has ended.', description }
    : { title: 'The subscription has ended.', description };
}

/**
 * Content rendered in place of the normal page content when the tenant is
 * locked out of the app (trial expired, subscription canceled, etc.).
 *
 * The lock itself applies to everyone in the workspace — `SubscriptionGuard` does
 * not consult the role, and it must not: the data is unavailable to the whole
 * tenant. Only the REMEDY is role-shaped, so this picks between three screens:
 *
 *   - payment UI hidden for the build (native) → `WorkspaceInactiveScreen`;
 *   - a role that cannot open billing → the same screen, with subscription
 *     wording, because every route that could fix this is owner-or-admin only
 *     (`use-billing-access-gate.ts`) and a plan picker leading to a refusal is
 *     worse than a plain explanation;
 *   - an owner or admin on a paying build → the plan picker, same cards as the
 *     subscription settings page.
 *
 * `'loading'` is grouped with "cannot open billing" deliberately. It should be
 * unreachable — every query that can produce a lock waits on the session latch,
 * which `/me` opens, so the role is known by the time a lock renders — and if that
 * ever stops holding, erring toward the screen with no prices on it is the safe
 * direction, not the one that flashes a purchase flow at someone.
 */
export function SubscriptionLockContent() {
  const access = useBillingAccessGate();
  const { status } = useSubscriptionLock();

  if (isBillingHidden()) {
    return <WorkspaceInactiveScreen />;
  }

  if (access !== 'allowed') {
    return <WorkspaceInactiveScreen {...noAccessCopy(status)} />;
  }

  return <SubscriptionPlanLockContent />;
}
