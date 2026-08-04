import { SubscriptionStatus } from '@/generated/schema-enums';

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
   * Built from the devices found in this instance — what the page is really about
   * is the fleet that has to be paid for, so the count leads. Falls back to a plain
   * prompt when nothing is under management (or nothing is counted yet).
   */
  description: (detectedDevices: number) => string;
}

function devicesLine(detectedDevices: number, template: (count: string, noun: string) => string, fallback: string) {
  if (detectedDevices <= 0) return fallback;
  return template(detectedDevices.toLocaleString('en-US'), detectedDevices === 1 ? 'device' : 'devices');
}

/** Locked out, or on the way there: the fleet is what the subscription buys back. */
function needsSubscriptionLine(detectedDevices: number, fallback: string): string {
  return devicesLine(
    detectedDevices,
    (count, noun) =>
      `We've detected ${count} ${noun} in your OpenFrame instance that require a subscription to continue management.`,
    fallback,
  );
}

/** Already paying: the same count, stated as a fact rather than a threat. */
function underManagementLine(detectedDevices: number, fallback: string): string {
  return devicesLine(
    detectedDevices,
    (count, noun) => `${count} ${noun} in your OpenFrame instance are under management on this plan.`,
    fallback,
  );
}

/**
 * Every status this page can be opened with gets copy, because the page IS the
 * paywall now — there is no second layout with a plain "Subscription Settings"
 * heading to fall back to.
 */
const PAYWALL_COPY: Partial<Record<SubscriptionStatus, PaywallCopy>> = {
  [SubscriptionStatus.TRIAL_EXPIRED]: {
    title: 'Your trial has ended. We hope you loved it!',
    description: devices => needsSubscriptionLine(devices, 'Pick a plan to keep using OpenFrame.'),
  },
  [SubscriptionStatus.CANCELED]: {
    title: 'Subscribe to OpenFrame',
    description: devices => needsSubscriptionLine(devices, 'Choose a plan to pick up where you left off.'),
  },
  [SubscriptionStatus.TRIAL]: {
    title: 'Activate your subscription',
    description: devices =>
      needsSubscriptionLine(devices, 'Pick a plan now and keep everything running when the trial ends.'),
  },
};

const DEFAULT_COPY: PaywallCopy = {
  title: 'Your plan',
  description: devices => underManagementLine(devices, 'Choose how you want to be billed for your fleet.'),
};

export function getPaywallCopy(status: SubscriptionStatus): PaywallCopy {
  return PAYWALL_COPY[status] ?? DEFAULT_COPY;
}
