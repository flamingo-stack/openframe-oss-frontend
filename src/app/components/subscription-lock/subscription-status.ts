import { SubscriptionStatus } from '@/generated/schema-enums';

/**
 * `SubscriptionStatus` mirrors the backend enum (schema.graphql via
 * `npm run generate-enums`). `TRIAL` and `TRIAL_EXPIRED` are now first-class
 * backend values — the FE no longer derives them from a date.
 *
 * `TRIAL_EXPIRED`, `CANCELED` and `SUSPENDED` lock the app. `PAST_DUE` is
 * rendered inline on the billing page with a "Pay Overage" CTA — the user keeps
 * access to the rest of the app.
 *
 * `SUSPENDED` is the end of that grace period, not another shade of it: the
 * backend sets it once an invoice has gone unpaid long enough that access is
 * withdrawn, so the app has to be withdrawn with it. It locks to a different
 * screen from the other two — the invoice is already written and waiting to be
 * paid, so `UnpaidInvoicesScreen` lists it instead of offering a plan to pick.
 *
 * What the lock SHOWS lives in `subscription-lock-copy.ts`, deliberately not
 * here: this module is imported by the app-wide guard/context, so keeping the
 * plan-picker copy out of it keeps that wording off every page's import graph
 * (see `subscription-lock-content.tsx`).
 */
export { SubscriptionStatus };

const LOCKING_STATUSES: readonly SubscriptionStatus[] = [
  SubscriptionStatus.TRIAL_EXPIRED,
  SubscriptionStatus.CANCELED,
  SubscriptionStatus.SUSPENDED,
];

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
