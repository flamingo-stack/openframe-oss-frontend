'use client';

import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
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
  // A row still being read (a loading scope) has no fragment to read: the cell draws its loading form.
  const data = useFragment(employeeRolesCellFragment, useLoadingScope() ? null : user);
  return <ValueText value={data ? data.roles.join(', ') : null} />;
}
