'use client';

import {
  DataTable,
  SquareAvatar,
  TruncateText,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { invitationEmailCell_invitation$key } from '@/__generated__/invitationEmailCell_invitation.graphql';

const invitationEmailCellFragment = graphql`
  fragment invitationEmailCell_invitation on Invitation {
    email
  }
`;

/**
 * The invited email for both of the column's cells. A row still being read (a loading scope) has no fragment to read:
 * an empty text, which each cell draws as its loading form.
 */
function useInvitationEmail(invitation: invitationEmailCell_invitation$key): string {
  const data = useFragment(invitationEmailCellFragment, useLoadingScope() ? null : invitation);
  return data?.email ?? '';
}

/** USER column of the invitations block: nobody has a name yet, only the invited email. */
export function InvitationEmailCell({ invitation }: { invitation: invitationEmailCell_invitation$key }) {
  const email = useInvitationEmail(invitation);
  return (
    <div className="flex min-w-0 items-center gap-[var(--spacing-system-xs)]">
      <SquareAvatar fallback={email} size="sm" variant="round" />
      <TruncateText>{email}</TruncateText>
    </div>
  );
}

/** USER column in the grid layout: the same avatar and email, as the grid's one-line cell. */
export function InvitationEmailGridCell({ invitation }: { invitation: invitationEmailCell_invitation$key }) {
  const email = useInvitationEmail(invitation);
  return <DataTable.Cell leading={{ type: 'avatar', name: email }} text={email} />;
}
