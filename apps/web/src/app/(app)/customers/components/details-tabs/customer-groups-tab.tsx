'use client';

import { GroupsView } from '@/app/(app)/users/components/groups-list/groups-view';

/** Customer → Groups (Figma 733:99271): the directory groups that touch this customer. */
export function CustomerGroupsTab({ organizationId }: { organizationId: string }) {
  return <GroupsView organizationId={organizationId} />;
}
