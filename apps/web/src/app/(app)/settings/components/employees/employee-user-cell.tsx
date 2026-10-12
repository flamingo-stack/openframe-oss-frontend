'use client';

import { SquareAvatar, TruncateText } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { employeeUserCell_user$key } from '@/__generated__/employeeUserCell_user.graphql';
import { DeletedUserAvatar, isDeletedUserStatus, isSelfDeletedUserStatus } from '@/app/components/shared/deleted-user';
import { getFullImageUrl } from '@/lib/image-url';

const employeeUserCellFragment = graphql`
  fragment employeeUserCell_user on User {
    firstName
    lastName
    email
    status
    image {
      imageUrl
      hash
    }
  }
`;

/** USER column: avatar, name, and the email underneath. */
export function EmployeeUserCell({ user }: { user: employeeUserCell_user$key }) {
  const { firstName, lastName, email, status, image } = useFragment(employeeUserCellFragment, user);
  const displayName = [firstName, lastName].filter(Boolean).join(' ') || email || '';

  return (
    <div className="flex min-w-0 items-center gap-[var(--spacing-system-xs)]">
      {isDeletedUserStatus(status) ? (
        <DeletedUserAvatar size="sm" />
      ) : (
        <SquareAvatar
          src={getFullImageUrl(image?.imageUrl, image?.hash)}
          fallback={displayName}
          size="sm"
          variant="round"
        />
      )}
      <div className="flex min-w-0 flex-col">
        <TruncateText>{displayName}</TruncateText>
        {/* A self-deleted user's email is a placeholder (`deleted-{id}@deleted.invalid`); an admin-deleted one keeps the real email. */}
        {!isSelfDeletedUserStatus(status) && email && (
          <TruncateText variant="h6" tone="secondary" mono>
            {email}
          </TruncateText>
        )}
      </div>
    </div>
  );
}
