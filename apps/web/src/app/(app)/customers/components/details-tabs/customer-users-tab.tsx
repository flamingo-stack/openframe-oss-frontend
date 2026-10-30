'use client';

import { UsersView } from '@/app/(app)/users/components/users-list/users-view';

/** Customer → Users (Figma 733:98943): the directory users this customer's rules claim. */
export function CustomerUsersTab({ organizationId }: { organizationId: string }) {
  return <UsersView organizationId={organizationId} embedded />;
}
