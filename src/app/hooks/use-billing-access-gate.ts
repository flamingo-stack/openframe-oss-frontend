'use client';

import { useWorkspaceAdminGate, type WorkspaceAdminGate } from './use-workspace-admin-gate';

export type BillingAccessGate = WorkspaceAdminGate;

/**
 * May the signed-in user manage this workspace's billing? Owners and admins — the
 * answer `use-workspace-admin-gate.ts` gives, under the name the billing surfaces ask by,
 * so the role list is spelled once.
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
  return useWorkspaceAdminGate();
}
