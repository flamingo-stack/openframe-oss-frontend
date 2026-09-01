'use client';

import {
  SubscriptionSettingsLoading,
  SubscriptionSettingsView,
} from '@/app/(app)/settings/billing-usage/subscription/components/subscription-settings-view';
import { useBillingAccessGate } from '@/app/hooks/use-billing-access-gate';
import { SubscriptionStatus } from '@/generated/schema-enums';
import { useSubscriptionLock } from './subscription-guard';
import { UnpaidInvoicesLoading, UnpaidInvoicesScreen } from './unpaid-invoices-screen';
import { WorkspaceInactiveScreen } from './workspace-inactive-screen';

/**
 * Copy for the viewer who cannot fix the lock themselves. Split by status because
 * "your trial ended" and "your subscription ended" are different facts, and the
 * one thing both need to say is who to go to.
 *
 * Not sourced from `subscription-lock-copy.ts`: that module is the plan picker's
 * own heading, and this path is the one where no plan is shown.
 */
function noAccessCopy(status: SubscriptionStatus): { title: string; description: string } {
  const description =
    'Only the workspace owner or an admin can restore it. Contact one of them to bring the workspace back for your team.';

  if (status === SubscriptionStatus.TRIAL_EXPIRED) {
    return { title: 'The free trial has ended.', description };
  }
  // Deliberately names no invoice and no amount: what this viewer can do about
  // it is identical either way, and a member has no business reading the
  // workspace's balance off a screen they cannot pay from.
  if (status === SubscriptionStatus.SUSPENDED) {
    return { title: 'This workspace has been suspended.', description };
  }
  return { title: 'The subscription has ended.', description };
}

/**
 * The lock screen on a build that may show payments. Three of them, in fact:
 * the paywall, the outstanding invoices of a suspended workspace, and the
 * explanation for someone whose role cannot open either.
 *
 * Its own module, loaded lazily by `subscription-lock-content.tsx`, so the plan
 * cards, prices, invoice amounts and Stripe entry points are not in the import
 * graph of every page that renders `AppLayout` — which is what pulled them into
 * the mobile bundles' shared chunk. Default export: `next/dynamic` entry point.
 *
 * The role check lives HERE, past the lazy boundary, for one reason: waiting on
 * it has to look like the paywall, and the paywall's markup only exists on this
 * side of that boundary. The lock renders as soon as the subscription status
 * resolves, while the role comes from `/me` on its own request, so on a cold
 * load the wait is routine rather than a rare race — and the two things this
 * decision can put on screen while it waits (a refusal, or a spinner) are both
 * worse than the page itself with its prices pending.
 *
 * The cost is that a viewer who turns out to have no access downloads this chunk
 * before being told so. That is a chunk fetch on a screen they cannot act on
 * anyway; the guarantee worth keeping is the build-level one, and that stays in
 * `subscription-lock-content.tsx` where no lazy import can defeat it.
 */
export default function SubscriptionPlanLockContent() {
  const access = useBillingAccessGate();
  const { status } = useSubscriptionLock();

  if (access === 'denied') {
    return <WorkspaceInactiveScreen {...noAccessCopy(status)} />;
  }

  // A suspension has a bill attached, so the remedy is that bill — not a plan.
  // Decided on the status alone, which the app shell resolved before this module
  // was fetched, so the screen is picked on the first paint and only its invoice
  // query has to land.
  const suspended = status === SubscriptionStatus.SUSPENDED;

  // Not yet known whether this viewer can pay — show the page they are most
  // likely about to get, unfilled. Each branch waits as ITSELF, which is why the
  // suspension case does not borrow the paywall's loading state: the two screens
  // are not the same screen, and reflowing from one to the other is a worse wait
  // than either.
  //
  // The invoice screen in particular must not be rendered with its DATA here.
  // Plan prices are a public catalog; an amount owed is the workspace's own
  // money, and this viewer may still turn out to be a member who never gets to
  // see it (the `denied` branch above). Waiting shows the screen, not the sum.
  if (access === 'loading') {
    return suspended ? <UnpaidInvoicesLoading /> : <SubscriptionSettingsLoading />;
  }

  return suspended ? <UnpaidInvoicesScreen /> : <SubscriptionSettingsView />;
}
