'use client';

import { DataTable, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { invitationStatusCell_invitation$key } from '@/__generated__/invitationStatusCell_invitation.graphql';
import { EmployeeStatusTag } from './employee-status-tag';

const invitationStatusCellFragment = graphql`
  fragment invitationStatusCell_invitation on Invitation {
    status
  }
`;

/**
 * The invitation's status for both of the column's cells. A row still being read (a loading scope) has no fragment to
 * read: `null`, and the tag draws its loading form.
 */
function useInvitationStatus(invitation: invitationStatusCell_invitation$key) {
  const data = useFragment(invitationStatusCellFragment, useLoadingScope() ? null : invitation);
  return data?.status ?? null;
}

/** STATUS column of the invitations table. */
export function InvitationStatusCell({ invitation }: { invitation: invitationStatusCell_invitation$key }) {
  const status = useInvitationStatus(invitation);
  // A row, not the cell's column: the chip keeps its own width instead of stretching across the cell.
  return (
    <div className="flex min-w-0 items-center">
      <EmployeeStatusTag status={status} />
    </div>
  );
}

/** STATUS column in the grid layout: the chip on the row's one line. */
export function InvitationStatusGridCell({ invitation }: { invitation: invitationStatusCell_invitation$key }) {
  return <DataTable.Cell tag={<EmployeeStatusTag status={useInvitationStatus(invitation)} />} />;
}
