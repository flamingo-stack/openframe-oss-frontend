'use client';

import { useAdminGate } from '@/app/hooks/use-admin-gate';

/**
 * Three states, for the same reason feature flags have three: "we don't know yet" is
 * not "no". A surface that 404s or hides on a guessed `denied` would close itself for
 * the people it belongs to, and `notFound()` throws — nothing re-renders it once the
 * real answer lands.
 */
export type BillingAccessGate = 'loading' | 'allowed' | 'denied';

/**
 * May the signed-in user manage this workspace's billing? Owners and admins — the
 * roles `use-admin-gate.ts` answers for.
 *
 * Admins are in because they run the workspace day to day — the ones who add the
 * devices the plan is sized for, and the ones who hit the limits. Owners keep the
 * money; admins need to see and change what it buys. Everyone else is out: to a
 * member, billing is neither useful nor theirs.
 *
 * Narrower, owner-only questions (account deletion hands the workspace over) stay on
 * `use-owner-gate.ts` — this one is about billing, not about ownership.
 */
export function useBillingAccessGate(): BillingAccessGate {
  const gate = useAdminGate();
  if (gate === 'loading') return 'loading';
  return gate === 'admin' ? 'allowed' : 'denied';
}
