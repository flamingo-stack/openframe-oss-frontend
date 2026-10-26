'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { SquareAvatar, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type React from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { deviceAddedByCellQuery } from '@/__generated__/deviceAddedByCellQuery.graphql';
import { ContentErrorBoundary } from '@/app/components/shared';
import { DELETED_EMPLOYEE_LABEL, DeletedUserAvatar } from '@/app/components/shared/deleted-user';
import { InfoCell } from '@/app/components/shared/info-cell';
import { toUserSummary } from '@/graphql/users/user-summary-fields';
import { ensureGlobalIdForType } from '@/lib/relay-id';

/** The avatar's step of the shared avatar scale (`AVATAR_SIZE`), loaded and loading. */
const AVATAR = 'sm';

const deviceAddedByCellQueryNode = graphql`
  query deviceAddedByCellQuery($id: ID!) {
    node(id: $id) {
      __typename
      ... on User {
        ...userSummaryFields_user
      }
    }
  }
`;

interface DeviceAddedByCellProps {
  /** Id of the user whose install command enrolled the device. */
  userId?: string | null;
}

/**
 * Who added the device. The device carries only the user's id, so the name and
 * the avatar are read from the user's node.
 *
 * - no id (enrolled before the install command carried one): the empty mark;
 * - a failed read: the empty mark, with no toast. The cell is one detail of a
 *   page that has loaded, and an error raised from it would read as the device
 *   failing to load.
 */
export function DeviceAddedByCell({ userId }: DeviceAddedByCellProps) {
  return (
    <ContentErrorBoundary resetKey={userId ?? ''} fallback={() => <AddedBy name={null} />}>
      <DeviceAddedByContent userId={userId} />
    </ContentErrorBoundary>
  );
}

function DeviceAddedByContent({ userId }: DeviceAddedByCellProps) {
  return (
    <LoadingSuspense label="Loading who added the device">
      <DeviceAddedByReader userId={userId} />
    </LoadingSuspense>
  );
}

/** In a loading scope (the device page's, or this cell's boundary) it reads nothing: the cell draws itself. */
function DeviceAddedByReader({ userId }: DeviceAddedByCellProps) {
  const loading = useLoadingScope();
  if (loading) {
    return <AddedBy avatar={userId ? <SquareAvatar size={AVATAR} variant="round" className="shrink-0" /> : null} />;
  }
  if (!userId) {
    return <AddedBy name={null} />;
  }
  return <DeviceAddedByQuery userId={userId} />;
}

/**
 * The user who added the device:
 * - a user the API no longer knows: the deleted-employee placeholder;
 * - a deleted account: the deleted avatar beside whatever name the API returns
 *   (the real one for an admin-deleted user, the anonymized one otherwise).
 */
function DeviceAddedByQuery({ userId }: { userId: string }) {
  const data = useLazyLoadQuery<deviceAddedByCellQuery>(
    deviceAddedByCellQueryNode,
    { id: ensureGlobalIdForType('User', userId) },
    { fetchPolicy: 'store-or-network' },
  );
  if (data.node?.__typename !== 'User') {
    return <AddedBy avatar={<DeletedUserAvatar size={AVATAR} />} name={DELETED_EMPLOYEE_LABEL} />;
  }

  const { name, avatarUrl, deleted } = toUserSummary(data.node);
  const avatar = deleted ? (
    <DeletedUserAvatar size={AVATAR} accessibleLabel={`Deleted user: ${name}`} />
  ) : (
    <SquareAvatar src={avatarUrl} fallback={name} size={AVATAR} variant="round" />
  );
  return <AddedBy avatar={avatar} name={name} />;
}

/** The cell: an optional avatar beside the name and its label. In a loading scope the name is a bar. */
function AddedBy({ avatar, name = null }: { avatar?: React.ReactNode; name?: string | null }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-[var(--spacing-system-xs)]">
      {avatar}
      <InfoCell value={name} label="Added by" skeletonWidth="w-28" />
    </div>
  );
}
