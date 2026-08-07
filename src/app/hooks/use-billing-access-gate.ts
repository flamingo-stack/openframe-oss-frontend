'use client';

import { useAuthSession } from '@/app/(auth)/auth/hooks/use-auth-session';

/**
 * Three states, for the same reason feature flags have three: "we don't know yet" is
 * not "no". A surface that 404s or hides on a guessed `denied` would close itself for
 * the people it belongs to, and `notFound()` throws — nothing re-renders it once the
 * real answer lands.
 */
export type BillingAccessGate = 'loading' | 'allowed' | 'denied';

/**
 * Workspace roles allowed to open the Billing & Usage surfaces and the plan picker.
 *
 * Admins are in because they run the workspace day to day — the ones who add the
 * devices the plan is sized for, and the ones who hit the limits. Owners keep the
 * money; admins need to see and change what it buys. Everyone else is out: to a
 * member, billing is neither useful nor theirs.
 *
 * Roles are plain strings from the gateway (`OWNER`, `ADMIN`, …) — there is no schema
 * enum for them, so the comparison is case-insensitive, matching the existing check in
 * `employee-details-view.tsx`.
 */
const BILLING_ROLES = ['owner', 'admin'];

/**
 * May the signed-in user manage this workspace's billing?
 *
 * Read from the `/me` payload rather than the auth store: the store is filled by
 * `useAuthSession`'s effect, so a store-based check reports "denied" for the one
 * render between the query settling and the effect committing — long enough to 404 a
 * page the user is entitled to.
 *
 * Signed out answers `'loading'`, not `'denied'`: `AppLayoutInner` is already
 * redirecting (OSS) or replacing the app (SaaS), and a 404 flashed on the way out is
 * worse than the placeholder the page shows while it leaves.
 */
export function useBillingAccessGate(): BillingAccessGate {
  const { isReady, isAuthenticated, user } = useAuthSession();

  if (!isReady || !isAuthenticated || !user) {
    return 'loading';
  }

  const roles = (user.roles ?? []).map(role => role?.toLowerCase());
  return roles.some(role => role != null && BILLING_ROLES.includes(role)) ? 'allowed' : 'denied';
}
