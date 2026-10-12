'use client';

import { SquareAvatar, TruncateText } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { deviceAddedByUserQuery } from '@/__generated__/deviceAddedByUserQuery.graphql';
import { DELETED_EMPLOYEE_LABEL, DeletedUserAvatar, isDeletedUserStatus } from '@/app/components/shared/deleted-user';
import { getFullImageUrl } from '@/lib/image-url';
import { ensureGlobalIdForType } from '@/lib/relay-id';
import { AddedByFrame } from './device-added-by-frame';

const deviceAddedByUserQueryNode = graphql`
  query deviceAddedByUserQuery($id: ID!) {
    node(id: $id) {
      __typename
      ... on User {
        firstName
        lastName
        email
        status
        image {
          imageUrl
          hash
        }
      }
    }
  }
`;

/**
 * The user who added the device:
 * - a user the API no longer knows: the deleted-employee placeholder;
 * - a deleted account: the deleted avatar beside whatever name the API returns
 *   (the real one for an admin-deleted user, the anonymized one otherwise).
 */
export function DeviceAddedByUser({ userId }: { userId: string }) {
  const data = useLazyLoadQuery<deviceAddedByUserQuery>(
    deviceAddedByUserQueryNode,
    { id: ensureGlobalIdForType('User', userId) },
    { fetchPolicy: 'store-or-network' },
  );
  const user = data.node?.__typename === 'User' ? data.node : null;

  if (!user) {
    return (
      <AddedByFrame avatar={<DeletedUserAvatar size="sm" />}>
        <TruncateText>{DELETED_EMPLOYEE_LABEL}</TruncateText>
      </AddedByFrame>
    );
  }

  const name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || (user.email ?? '');
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
