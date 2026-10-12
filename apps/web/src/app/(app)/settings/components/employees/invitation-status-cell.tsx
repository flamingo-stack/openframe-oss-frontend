'use client';

import { graphql, useFragment } from 'react-relay';
import type { invitationStatusCell_invitation$key } from '@/__generated__/invitationStatusCell_invitation.graphql';
import { EmployeeStatusTag } from './employee-status-tag';

const invitationStatusCellFragment = graphql`
  fragment invitationStatusCell_invitation on Invitation {
    status
  }
`;

/** STATUS column of the invitations block. */
export function InvitationStatusCell({ invitation }: { invitation: invitationStatusCell_invitation$key }) {
  const { status } = useFragment(invitationStatusCellFragment, invitation);
  return <EmployeeStatusTag status={status} />;
}
