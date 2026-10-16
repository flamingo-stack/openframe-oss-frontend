'use client';

import { SquareAvatar, TruncateText } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { deviceAddedByUserQuery } from '@/__generated__/deviceAddedByUserQuery.graphql';
import { DELETED_EMPLOYEE_LABEL, DeletedUserAvatar } from '@/app/components/shared/deleted-user';
import { toUserSummary } from '@/graphql/users/user-summary-fields';
import { ensureGlobalIdForType } from '@/lib/relay-id';
import { AddedByFrame } from './device-added-by-frame';

const deviceAddedByUserQueryNode = graphql`
  query deviceAddedByUserQuery($id: ID!) {
    node(id: $id) {
      __typename
      ... on User {
        ...userSummaryFields_user
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
  if (data.node?.__typename !== 'User') {
    return (
      <AddedByFrame avatar={<DeletedUserAvatar size="sm" />}>
        <TruncateText>{DELETED_EMPLOYEE_LABEL}</TruncateText>
      </AddedByFrame>
    );
  }

  const { name, avatarUrl, deleted } = toUserSummary(data.node);
  const avatar = deleted ? (
    <DeletedUserAvatar size="sm" accessibleLabel={`Deleted user: ${name}`} />
  ) : (
    <SquareAvatar src={avatarUrl} fallback={name} size="sm" variant="round" />
  );

  return (
    <AddedByFrame avatar={avatar}>
      <TruncateText>{name}</TruncateText>
    </AddedByFrame>
  );
}
