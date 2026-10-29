'use client';

import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { invitationStatusCell_invitation$key } from '@/__generated__/invitationStatusCell_invitation.graphql';
import { EmployeeStatusTag } from './employee-status-tag';

const invitationStatusCellFragment = graphql`
  fragment invitationStatusCell_invitation on Invitation {
    status
  }
`;

/** STATUS column of the invitations table. */
export function InvitationStatusCell({ invitation }: { invitation: invitationStatusCell_invitation$key }) {
  // A row still being read (a loading scope) has no fragment to read: the cell draws its loading form.
  const data = useFragment(invitationStatusCellFragment, useLoadingScope() ? null : invitation);
  // A row, not the cell's column: the chip keeps its own width instead of stretching across the cell.
  return (
    <div className="flex min-w-0 items-center">
      <EmployeeStatusTag status={data?.status ?? null} />
    </div>
  );
}
