'use client';

import { Skeleton, SquareAvatar, TruncateText } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type React from 'react';
import { useUser } from '@/app/(app)/settings/hooks/use-user';
import type { UserRecord } from '@/app/(app)/settings/hooks/use-users';
import { DELETED_EMPLOYEE_LABEL, DeletedUserAvatar, isDeletedUserStatus } from '@/app/components/shared/deleted-user';
import { EmptyValue } from '@/app/components/shared/empty-value';
import { getFullImageUrl } from '@/lib/image-url';

const LABEL = 'Added by';

function userDisplayName(user: UserRecord): string {
  const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
  return fullName || user.email;
}

/** The cell frame: an optional avatar beside the [value, label] column. */
function AddedByFrame({ avatar, children }: { avatar?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-[var(--spacing-system-xs)]">
      {avatar}
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        {children}
        <p className="truncate text-ods-text-secondary text-h6">{LABEL}</p>
      </div>
    </div>
  );
}

/** Same frame with the avatar and the name as placeholders; the label is the real text. */
export function DeviceAddedByCellSkeleton() {
  return (
    <AddedByFrame avatar={<Skeleton className="size-8 shrink-0 rounded-full" />}>
      <span className="relative inline-block w-28 align-middle text-h4">
        {/* Invisible char establishes the real line-box height of the name. */}
        <span className="invisible" aria-hidden>
          &nbsp;
        </span>
        <Skeleton className="absolute left-0 right-0 top-1/2 h-[0.85em] -translate-y-1/2 rounded-[6px]" />
      </span>
    </AddedByFrame>
  );
}

interface DeviceAddedByCellProps {
  /** Id of the user whose install command enrolled the device. */
  userId?: string | null;
}

/**
 * Who added the device. The device carries only the user's id, so the name and
 * the avatar are read from the users API.
 *
 * - no id (enrolled before the install command carried one): the empty mark;
 * - a user the API no longer knows: the deleted-employee placeholder;
 * - a deleted account: the deleted avatar beside whatever name the API returns
 *   (the real one for an admin-deleted user, the anonymized one otherwise);
 * - a failed read: the empty mark, with no toast. The cell is one detail of a
 *   page that has loaded, and an error raised from it would read as the device
 *   failing to load.
 */
export function DeviceAddedByCell({ userId }: DeviceAddedByCellProps) {
  const { user, isLoading, error } = useUser(userId ?? '');

  if (!userId || error) {
    return (
      <AddedByFrame>
        <div className="min-w-0 text-h4">
          <EmptyValue />
        </div>
      </AddedByFrame>
    );
  }

  if (isLoading) {
    return <DeviceAddedByCellSkeleton />;
  }

  if (!user) {
    return (
      <AddedByFrame avatar={<DeletedUserAvatar size="sm" />}>
        <TruncateText>{DELETED_EMPLOYEE_LABEL}</TruncateText>
      </AddedByFrame>
    );
  }

  const name = userDisplayName(user);
  const avatar = isDeletedUserStatus(user.status) ? (
    <DeletedUserAvatar size="sm" accessibleLabel={`Deleted user: ${name}`} />
  ) : (
    <SquareAvatar
      src={getFullImageUrl(user.image?.imageUrl, user.image?.hash)}
      fallback={name}
      size="sm"
      variant="round"
    />
  );

  return (
    <AddedByFrame avatar={avatar}>
      <TruncateText>{name}</TruncateText>
    </AddedByFrame>
  );
}
