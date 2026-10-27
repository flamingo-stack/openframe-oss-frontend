'use client';

import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { employeeStatusCell_user$key } from '@/__generated__/employeeStatusCell_user.graphql';
import { EmployeeStatusTag } from './employee-status-tag';

const employeeStatusCellFragment = graphql`
  fragment employeeStatusCell_user on User {
    status
  }
`;

/** STATUS column of the users table. */
export function EmployeeStatusCell({ user }: { user: employeeStatusCell_user$key }) {
  // A row still being read (a loading scope) has no fragment to read: the cell draws its loading form.
  const data = useFragment(employeeStatusCellFragment, useLoadingScope() ? null : user);
  // A row, not the cell's column: the chip keeps its own width instead of stretching across the cell.
  return (
    <div className="flex min-w-0 items-center">
      <EmployeeStatusTag status={data?.status ?? null} />
    </div>
  );
}
