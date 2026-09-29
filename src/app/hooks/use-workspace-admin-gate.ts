'use client';

import { useAuthSession } from '@/app/(auth)/auth/hooks/use-auth-session';

/**
 * Three states, for the same reason feature flags have three: "we don't know yet" is
 * not "no". A surface that 404s or hides on a guessed `denied` would close itself for
 * the people it belongs to, and `notFound()` throws — nothing re-renders it once the
 * real answer lands.
 */
export type WorkspaceAdminGate = 'loading' | 'allowed' | 'denied';

/**
 * The roles that administer a workspace: the owner and the admins. Owners keep the
 * workspace; admins run it day to day, and the surfaces this gate opens — billing,
 * tenant connections — are the ones running it needs. Everyone else is out.
 *
 * Roles are plain strings from the gateway (`OWNER`, `ADMIN`, …) — there is no schema
 * enum for them, so the comparison is case-insensitive, matching the existing check in
 * `employee-details-view.tsx`.
 */
const WORKSPACE_ADMIN_ROLES = ['owner', 'admin'];

/**
 * Is the signed-in user an OWNER or an ADMIN of this workspace?
 *
 * Read from the `/me` payload rather than the auth store: the store is filled by
 * `useAuthSession`'s effect, so a store-based check reports "denied" for the one
 * render between the query settling and the effect committing — long enough to 404 a
 * page the user is entitled to.
 *
 * Signed out answers `'loading'`, not `'denied'`: `AppLayoutInner` is already
 * redirecting (OSS) or replacing the app (SaaS), and a 404 flashed on the way out is
 * worse than the placeholder the page shows while it leaves.
 *
 * Owner-only questions — the ones where handing the workspace over is the point, such
 * as account deletion — stay on `use-owner-gate.ts`.
 */
export function useWorkspaceAdminGate(): WorkspaceAdminGate {
  const { isReady, isAuthenticated, user } = useAuthSession();

  if (!isReady || !isAuthenticated || !user) {
    return 'loading';
  }

  const roles = (user.roles ?? []).map(role => role?.toLowerCase());
  return roles.some(role => role != null && WORKSPACE_ADMIN_ROLES.includes(role)) ? 'allowed' : 'denied';
}
