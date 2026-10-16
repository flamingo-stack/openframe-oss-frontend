'use client';

import { graphql, useFragment } from 'react-relay';
import type { invitationRolesCell_invitation$key } from '@/__generated__/invitationRolesCell_invitation.graphql';
import { ValueText } from '@/app/components/shared/value-text';

const invitationRolesCellFragment = graphql`
  fragment invitationRolesCell_invitation on Invitation {
    roles
  }
`;

/** ROLE column of the invitations block: the roles the invitee will get. */
export function InvitationRolesCell({ invitation }: { invitation: invitationRolesCell_invitation$key }) {
  const { roles } = useFragment(invitationRolesCellFragment, invitation);
  return <ValueText value={roles.join(', ')} />;
}
