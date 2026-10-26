'use client';

import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
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
  // A row still being read (a loading scope) has no fragment to read: the cell draws its loading form.
  const data = useFragment(invitationRolesCellFragment, useLoadingScope() ? null : invitation);
  return <ValueText value={data ? data.roles.join(', ') : null} />;
}
