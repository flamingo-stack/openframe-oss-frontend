import { SubscriptionStatus } from '@/generated/schema-enums';

/**
 * `SubscriptionStatus` mirrors the backend enum (schema.graphql via
 * `npm run generate-enums`). `TRIAL` and `TRIAL_EXPIRED` are now first-class
 * backend values — the FE no longer derives them from a date.
 *
 * `TRIAL_EXPIRED` and `CANCELED` lock the app. `PAST_DUE` and `SUSPENDED` are
 * rendered inline on the billing page with a "Pay Overage" CTA — the user keeps
 * access to the rest of the app.
 *
 * What the lock SHOWS lives in `subscription-lock-copy.ts`, deliberately not
 * here: this module is imported by the app-wide guard/context, so keeping the
 * plan-picker copy out of it keeps that wording off every page's import graph
 * (see `subscription-lock-content.tsx`).
 */
export { SubscriptionStatus };

const LOCKING_STATUSES: readonly SubscriptionStatus[] = [SubscriptionStatus.TRIAL_EXPIRED, SubscriptionStatus.CANCELED];

function isKnownStatus(value: string): value is SubscriptionStatus {
  return Object.hasOwn(SubscriptionStatus, value);
}

export function resolveSubscriptionStatus(rawStatus: string | null | undefined): SubscriptionStatus {
  return rawStatus && isKnownStatus(rawStatus) ? rawStatus : SubscriptionStatus.ACTIVE;
}

/** Whether this status locks the user out of the app content. */
export function isLockingStatus(status: SubscriptionStatus): boolean {
  return LOCKING_STATUSES.includes(status);
}
