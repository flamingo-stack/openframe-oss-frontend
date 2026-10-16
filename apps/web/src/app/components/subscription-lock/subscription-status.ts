import { SubscriptionStatus } from '@/generated/schema-enums';

/**
 * `SubscriptionStatus` mirrors the backend enum (schema.graphql via
 * `npm run generate-enums`). `TRIAL` and `TRIAL_EXPIRED` are now first-class
 * backend values — the FE no longer derives them from a date.
 *
 * `TRIAL_EXPIRED`, `CANCELED`, `PAST_DUE` and `SUSPENDED` lock the app.
 *
 * The two debt statuses are two steps of one unpaid invoice. `PAST_DUE` is the
 * invoice past its due date: the dashboard is locked except Billing & Usage,
 * where it is paid (see `isRouteOpenWhileLocked`), while the agents keep
 * working — the gateway lets their traffic through. `SUSPENDED` is the step
 * after it, meant to follow 30 days on: the agents stop too, and Billing &
 * Usage locks with the rest. Both lock to a different screen from the other
 * two — the invoice is already written and waiting to be paid, so
 * `UnpaidInvoicesScreen` lists it instead of offering a plan to pick.
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
  SubscriptionStatus.PAST_DUE,
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

/**
 * Whether a locked workspace still gets this page instead of the lock screen.
 *
 * - The checkout result pages, on any lock: a payer lands there before the
 *   webhook flips the subscription to ACTIVE, and the page they need is a
 *   normal one.
 * - Billing & Usage, on `PAST_DUE` only: it is where the overdue invoice is
 *   paid. Its queries skip the subscription gate, which stays shut for the rest
 *   of the app (see `subscription-gate.ts`).
 *
 * Only the page area. The chrome's own traffic stays off on every route while
 * the workspace is locked — it gates on `isLocked`, which is route-blind.
 */
export function isRouteOpenWhileLocked(pathname: string | null, status: SubscriptionStatus): boolean {
  if (pathname == null) return false;
  if (pathname.startsWith('/checkout')) return true;
  return status === SubscriptionStatus.PAST_DUE && pathname.startsWith('/settings/billing-usage');
}
