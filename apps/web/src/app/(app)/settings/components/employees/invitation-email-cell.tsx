'use client';

import { SquareAvatar, TruncateText } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { invitationEmailCell_invitation$key } from '@/__generated__/invitationEmailCell_invitation.graphql';

const invitationEmailCellFragment = graphql`
  fragment invitationEmailCell_invitation on Invitation {
    email
  }
`;

/** USER column of the invitations block: nobody has a name yet, only the invited email. */
export function InvitationEmailCell({ invitation }: { invitation: invitationEmailCell_invitation$key }) {
  const { email } = useFragment(invitationEmailCellFragment, invitation);
  return (
    <div className="flex min-w-0 items-center gap-[var(--spacing-system-xs)]">
      <SquareAvatar fallback={email} size="sm" variant="round" />
      <TruncateText>{email}</TruncateText>
    </div>
  );
}
