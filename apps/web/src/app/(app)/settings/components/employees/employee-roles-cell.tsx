'use client';

import { graphql, useFragment } from 'react-relay';
import type { employeeRolesCell_user$key } from '@/__generated__/employeeRolesCell_user.graphql';
import { ValueText } from '@/app/components/shared/value-text';

const employeeRolesCellFragment = graphql`
  fragment employeeRolesCell_user on User {
    roles
  }
`;

/** ROLE column of the users table. */
export function EmployeeRolesCell({ user }: { user: employeeRolesCell_user$key }) {
  const { roles } = useFragment(employeeRolesCellFragment, user);
  return <ValueText value={roles.join(', ')} />;
}
