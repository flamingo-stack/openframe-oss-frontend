'use client';

import { LoadingWhen, SquareAvatar, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type React from 'react';
import { useUser } from '@/app/(app)/settings/hooks/use-user';
import type { UserRecord } from '@/app/(app)/settings/hooks/use-users';
import { DELETED_EMPLOYEE_LABEL, DeletedUserAvatar, isDeletedUserStatus } from '@/app/components/shared/deleted-user';
import { InfoCell } from '@/app/components/shared/info-cell';
import { getFullImageUrl } from '@/lib/image-url';

/** The avatar's step of the shared avatar scale (`AVATAR_SIZE`), loaded and loading. */
const AVATAR = 'sm';

function userDisplayName(user: UserRecord): string {
  const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
  return fullName || user.email;
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
 *
 * While it loads the name is a bar of the `InfoCell`; the avatar's placeholder is drawn only once the id is known (a
 * device without one has no avatar), so in the page's loading scope the cell is the label and the bar.
 */
export function DeviceAddedByCell({ userId }: DeviceAddedByCellProps) {
  const { user, isLoading, error } = useUser(userId ?? '');
  // The device (the page's loading scope) or the user has not answered yet.
  const loading = useLoadingScope() || (Boolean(userId) && isLoading);

  let avatar: React.ReactNode = null;
  let name: string | null = null;
  if (loading) {
    if (userId) avatar = <SquareAvatar size={AVATAR} variant="round" className="shrink-0" />;
  } else if (userId && !error) {
    if (!user) {
      avatar = <DeletedUserAvatar size={AVATAR} />;
      name = DELETED_EMPLOYEE_LABEL;
    } else {
      name = userDisplayName(user);
      avatar = isDeletedUserStatus(user.status) ? (
        <DeletedUserAvatar size={AVATAR} accessibleLabel={`Deleted user: ${name}`} />
      ) : (
        <SquareAvatar
          src={getFullImageUrl(user.image?.imageUrl, user.image?.hash)}
          fallback={name}
          size={AVATAR}
          variant="round"
        />
      );
    }
  }

  return (
    <LoadingWhen loading={loading}>
      <div className="flex min-w-0 flex-1 items-center gap-[var(--spacing-system-xs)]">
        {avatar}
        <InfoCell value={name} label="Added by" skeletonWidth="w-28" />
      </div>
    </LoadingWhen>
  );
}
