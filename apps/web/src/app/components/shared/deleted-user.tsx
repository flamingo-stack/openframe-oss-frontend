'use client';

import { UserStatus } from '@/app/(app)/settings/hooks/use-users';

/**
 * The red round user-x placeholder itself lives in the core lib (it is also
 * rendered inside lib components — board ticket cards, AssigneeDropdown — via
 * their `deleted` flags); re-exported here so app code keeps one import path
 * next to the status helpers below.
 */
export { DeletedUserAvatar } from '@flamingo-stack/openframe-frontend-core/components/ui';

/**
 * Display label for deleted users on surfaces that have no (or stale) user
 * data of their own — e.g. a ticket's denormalized assignee snapshot. Surfaces
 * that DO have fresh user data keep showing it (real name for admin-DELETED
 * users, the backend-anonymized "Deleted Account" for SELF_DELETED) — see the
 * per-surface call sites.
 */
export const DELETED_EMPLOYEE_LABEL = 'Deleted Employee';

/**
 * Whether a user status string means "this account is deleted" for display
 * purposes. Both DELETED (admin-deleted, revivable) and SELF_DELETED
 * (anonymized) get the same visual treatment per design; REMOVED (purged)
 * users never appear in any list, so it is intentionally not handled.
 */
export function isDeletedUserStatus(status?: string | null): boolean {
  if (!status) return false;
  const normalized = status.toUpperCase();
  return normalized === UserStatus.Deleted || normalized === UserStatus.SelfDeleted;
}

/**
 * SELF_DELETED specifically: personal data is anonymized server-side and the
 * email is a synthetic `deleted-{id}@deleted.invalid` — surfaces showing an
 * email line hide it for these users (admin-DELETED users keep showing their
 * real email; the account is revivable).
 */
export function isSelfDeletedUserStatus(status?: string | null): boolean {
  return !!status && status.toUpperCase() === UserStatus.SelfDeleted;
}
