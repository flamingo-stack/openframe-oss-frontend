'use client';

import { UserXmarkIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { UserStatus } from '@/app/(app)/settings/hooks/use-users';

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

/** Mirrors SquareAvatar's size buckets (sm 32 / md 40 / lg 48). */
const SIZE_CLASSES = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
} as const;

const ICON_CLASSES = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
} as const;

interface DeletedUserAvatarProps {
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}

/**
 * Red round user-x placeholder shown instead of the avatar for deleted users.
 * A dedicated component (not a `SquareAvatar` prop) because `SquareAvatar` has
 * no icon slot — its only fallback is text initials, and "DA" initials for a
 * deleted account is exactly what the design replaces.
 */
export function DeletedUserAvatar({ size = 'md', className }: DeletedUserAvatarProps) {
  return (
    <span
      role="img"
      aria-label="Deleted user"
      className={cn(
        'flex items-center justify-center rounded-full bg-ods-error/20 shrink-0',
        SIZE_CLASSES[size],
        className,
      )}
    >
      <UserXmarkIcon className={cn('text-ods-error', ICON_CLASSES[size])} />
    </span>
  );
}
