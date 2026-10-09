import { SubscriptionStatus } from '@/generated/schema-enums';
import { pluralize } from '@/lib/pluralize';

/**
 * The plan picker's header copy (web / desktop).
 *
 * Split out of `subscription-status.ts` on purpose: that module is imported by
 * the app-wide `SubscriptionGuard`/context, so anything living there ends up in
 * the import graph of every page. This wording is plan-and-purchase specific and
 * must NOT reach the mobile bundles, which show `WorkspaceInactiveScreen`
 * instead — see `billing-visibility.ts`. Only the lazily-loaded plan lock
 * content and the subscription page import this.
 */
export interface PaywallCopy {
  title: string;
  /**
   * Plain text, deliberately naming no device count.
   *
   * It used to open with "We've detected N devices…", built from a `devices()`
   * query spread into the paywall's own query. That is app data: a locked
   * workspace has it refused with `SUBSCRIPTION_TRIAL_EXPIRED`, and because
   * `devices` is non-null the refusal nulled the whole payload — crashing the
   * one screen that must render on a locked workspace. The count went with it.
   */
  description: string;
}

/**
 * Every status this page can be opened with gets copy, because the page IS the
 * paywall now — there is no second layout with a plain "Subscription Settings"
 * heading to fall back to.
 */
const PAYWALL_COPY: Partial<Record<SubscriptionStatus, PaywallCopy>> = {
  [SubscriptionStatus.TRIAL_EXPIRED]: {
    title: 'Your trial has ended. We hope you loved it!',
    description: 'Pick a plan to keep using OpenFrame.',
  },
  [SubscriptionStatus.CANCELED]: {
    title: 'Subscribe to OpenFrame',
    description: 'Choose a plan to pick up where you left off.',
  },
  [SubscriptionStatus.TRIAL]: {
    title: 'Activate your subscription',
    description: 'Pick a plan now and keep everything running when the trial ends.',
  },
};

const DEFAULT_COPY: PaywallCopy = {
  title: 'Your plan',
  description: 'Choose how you want to be billed for your fleet.',
};

export function getPaywallCopy(status: SubscriptionStatus): PaywallCopy {
  return PAYWALL_COPY[status] ?? DEFAULT_COPY;
}

/**
 * The line under the paywall's title: the fleet the plan is for once billing
 * has counted it, and `copy.description` until then. One sentence either way,
 * not a number appearing into a gap left for it.
 */
export function paywallDescription(copy: PaywallCopy, deviceCount: number | null): string {
  if (deviceCount == null) return copy.description;
  return `We've detected ${pluralize(deviceCount, 'active device')} in your OpenFrame instance that ${deviceCount === 1 ? 'requires' : 'require'} a subscription to continue management.`;
}

/** Shown in place of the plans when their catalog cannot be loaded at all. */
export const PLANS_UNAVAILABLE_COPY = {
  title: "We couldn't load the plans.",
  description: 'Something went wrong on our side. Try again in a moment, or contact support if it keeps happening.',
};
