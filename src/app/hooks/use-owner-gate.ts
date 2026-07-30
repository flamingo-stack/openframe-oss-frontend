'use client';

import { useAuthSession } from '@/app/(auth)/auth/hooks/use-auth-session';

/**
 * Three states, for the same reason feature flags have three: "we don't know yet" is
 * not "no". A surface that 404s or hides on a guessed `false` would close itself for
 * the owner it belongs to, and `notFound()` throws — nothing re-renders it once the
 * real answer lands.
 */
export type OwnerGate = 'loading' | 'owner' | 'not-owner';

/**
 * Is the signed-in user an OWNER of this workspace?
 *
 * Read from the `/me` payload rather than the auth store: the store is filled by
 * `useAuthSession`'s effect, so a store-based check reports "not an owner" for the one
 * render between the query settling and the effect committing — long enough to 404 a
 * page the user is entitled to.
 *
 * Roles are plain strings from the gateway (`OWNER`, `ADMIN`, …) — there is no schema
 * enum for them, so the comparison is case-insensitive, matching the existing check in
 * `employee-details-view.tsx`.
 *
 * Signed out answers `'loading'`, not `'not-owner'`: `AppLayoutInner` is already
 * redirecting (OSS) or replacing the app (SaaS), and a 404 flashed on the way out is
 * worse than the placeholder the page shows while it leaves.
 */
export function useOwnerGate(): OwnerGate {
  const { isReady, isAuthenticated, user } = useAuthSession();

  if (!isReady || !isAuthenticated || !user) {
    return 'loading';
  }

  return (user.roles ?? []).some(role => role?.toLowerCase() === 'owner') ? 'owner' : 'not-owner';
}
