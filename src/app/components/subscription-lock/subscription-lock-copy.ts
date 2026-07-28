import { SubscriptionStatus } from '@/generated/schema-enums';

/**
 * Copy for the plan-picker lock screen (web / desktop).
 *
 * Split out of `subscription-status.ts` on purpose: that module is imported by
 * the app-wide `SubscriptionGuard`/context, so anything living there ends up in
 * the import graph of every page. This wording is plan-and-purchase specific and
 * must NOT reach the mobile bundles, which show `WorkspaceInactiveScreen`
 * instead — see `billing-visibility.ts`. Only the lazily-loaded plan lock
 * content imports this.
 */
export interface SubscriptionLockCopy {
  title: string;
  description: string;
  ctaLabel: string;
}

const LOCK_COPY: Partial<Record<SubscriptionStatus, SubscriptionLockCopy>> = {
  [SubscriptionStatus.TRIAL_EXPIRED]: {
    title: 'Your free trial has ended.',
    description: 'Pick a plan to keep using OpenFrame.',
    ctaLabel: 'Choose a Plan',
  },
  [SubscriptionStatus.CANCELED]: {
    title: 'Subscribe to OpenFrame',
    description: 'Choose a plan to pick up where you left off.',
    ctaLabel: 'Choose a Plan',
  },
};

export function getLockCopy(status: SubscriptionStatus): SubscriptionLockCopy | null {
  return LOCK_COPY[status] ?? null;
}
