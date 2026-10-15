'use client';

import { useAuthSession } from '@/app/(auth)/auth/hooks/use-auth-session';

/** Three states, like the flag gates: "not answered yet" is not "no". */
export type AdminGate = 'loading' | 'admin' | 'not-admin';

// Plain gateway strings (`OWNER`, `ADMIN`, …), no schema enum — compared case-insensitively.
const ADMIN_ROLES = ['owner', 'admin'];

/**
 * Is the signed-in user an OWNER or ADMIN of this workspace — the two roles the backend's
 * `hasAnyAuthority('ADMIN','OWNER')` operations accept? Read from the `/me` payload rather than the
 * auth store, for the reason `use-owner-gate.ts` gives.
 */
export function useAdminGate(): AdminGate {
  const { isReady, isAuthenticated, user } = useAuthSession();

  if (!isReady || !isAuthenticated || !user) {
    return 'loading';
  }

  const roles = (user.roles ?? []).map(role => role?.toLowerCase());
  return roles.some(role => role != null && ADMIN_ROLES.includes(role)) ? 'admin' : 'not-admin';
}
